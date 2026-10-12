"""Fix a file against a portal preset: convert, meet min pixels, shrink, validate.

Never logs file bytes, filenames, or image contents — passport and visa photos
are sensitive. Errors are generic user-facing strings.
"""

from __future__ import annotations

import math
import shutil
from dataclasses import dataclass
from pathlib import Path

import pyvips

from app.jobs.schemas import FileReport, FixReport, RuleCheck
from app.services import imaging
from app.services.pdfutil import PdfError, pdf_is_encrypted, rewrite_pdf, wrap_jpeg_as_pdf
from app.services.presets import Preset, normalize_type

# JPEG/WebP/AVIF quality ladder, highest first. Stop as soon as we are under target.
_QUALITY_STEPS = (85, 75, 65, 55, 45, 35, 25, 15, 10, 5)

# Office types we can only pass through, never generate.
_OFFICE = {"doc", "docx"}
_IMAGE_OUT = {"jpeg", "png", "tiff", "gif", "webp"}
_EXT_FOR_TYPE = {
    "jpeg": ".jpg",
    "png": ".png",
    "tiff": ".tiff",
    "gif": ".gif",
    "webp": ".webp",
    "pdf": ".pdf",
    "doc": ".doc",
    "docx": ".docx",
}
_MEDIA_FOR_TYPE = {
    "jpeg": "image/jpeg",
    "png": "image/png",
    "tiff": "image/tiff",
    "gif": "image/gif",
    "webp": "image/webp",
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class FixError(Exception):
    """A user-facing failure while fixing a file to a preset."""


@dataclass
class FileFix:
    """One output file plus its per-rule report."""

    path: Path
    download_name: str
    media_type: str
    report: FileReport


@dataclass
class JobFix:
    """All outputs of a fix job, ready for the worker to finish."""

    outputs: list[tuple[Path, str]]
    media_type: str
    report: FixReport


def _kind_from_ext(ext: str) -> str:
    """Map a stored input extension to a canonical type name."""
    return normalize_type(ext)


def _is_colour(image: pyvips.Image) -> bool:
    """True when the image has a colour interpretation (not grey / b-w)."""
    interp = (image.interpretation or "").lower()
    if interp in {"b-w", "grey16", "grey"}:
        return False
    return image.bands >= 3


def _orientation_of(width: int, height: int) -> str:
    """portrait, landscape, or square (treated as not-portrait / not-landscape)."""
    if height > width:
        return "portrait"
    if width > height:
        return "landscape"
    return "square"


def _format_bytes(n: int) -> str:
    """Human-readable size for the report (1024-based)."""
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        value = n / 1024
        return f"{value:.0f} KB" if value >= 10 else f"{value:.1f} KB"
    value = n / (1024 * 1024)
    return f"{value:.0f} MB" if value >= 10 else f"{value:.1f} MB"


def _flatten(image: pyvips.Image) -> pyvips.Image:
    """Drop alpha onto white so JPEG/PDF encodes stay opaque."""
    if image.hasalpha():
        return image.flatten(background=[255, 255, 255])
    return image


def _meet_min_pixels(image: pyvips.Image, preset: Preset) -> pyvips.Image:
    """Upscale (never crop) so width/height meet the preset minimums."""
    min_w = preset.min_width or 0
    min_h = preset.min_height or 0
    if min_w <= 0 and min_h <= 0:
        return image
    if image.width >= min_w and image.height >= min_h:
        return image
    scale = 1.0
    if min_w > 0:
        scale = max(scale, min_w / image.width)
    if min_h > 0:
        scale = max(scale, min_h / image.height)
    target_w = max(1, math.ceil(image.width * scale))
    target_h = max(1, math.ceil(image.height * scale))
    return image.thumbnail_image(target_w, height=target_h, size=pyvips.Size.FORCE)


def _scale_down(image: pyvips.Image, preset: Preset, factor: float = 0.9) -> pyvips.Image | None:
    """Shrink by `factor`, refusing to go below min pixels. None if we cannot."""
    min_w = preset.min_width or 1
    min_h = preset.min_height or 1
    new_w = max(1, int(image.width * factor))
    new_h = max(1, int(image.height * factor))
    if new_w < min_w or new_h < min_h:
        return None
    if new_w == image.width and new_h == image.height:
        return None
    return image.thumbnail_image(new_w, height=new_h, size=pyvips.Size.FORCE).copy_memory()


def _choose_output_type(input_kind: str, preset: Preset) -> str:
    """Keep the input type when the portal accepts it; otherwise the preferred/first."""
    accepted = preset.accepted_types
    if input_kind in accepted:
        return input_kind
    if preset.preferred_type and preset.preferred_type in accepted:
        return preset.preferred_type
    # Prefer a still-image type we can generate before falling back to PDF.
    for candidate in ("jpeg", "png", "tiff", "pdf"):
        if candidate in accepted:
            return candidate
    return accepted[0]


def _save_image(image: pyvips.Image, dest: Path, kind: str, quality: int) -> None:
    """Encode `image` to `dest` without stamping attribution (privacy)."""
    image = _flatten(image)
    try:
        if kind == "jpeg":
            if image.bands == 1:
                pass
            elif image.bands != 3:
                image = image.colourspace("srgb")
            imaging.save(image, dest, quality=quality, stamp=False)
        elif kind == "png":
            imaging.save(image, dest, quality=quality, stamp=False)
        elif kind == "tiff":
            imaging.save(image, dest, stamp=False)
        elif kind == "webp":
            imaging.save(image, dest, quality=quality, stamp=False)
        else:
            imaging.save(image, dest, quality=quality, stamp=False)
    except imaging.ImageError as exc:
        raise FixError(str(exc)) from exc


def _save_pdf_from_image(image: pyvips.Image, dest: Path, quality: int) -> None:
    """JPEG-encode the image, then wrap it in a one-page PDF."""
    image = _flatten(image)
    tmp = dest.with_suffix(".tmp.jpg")
    try:
        _save_image(image, tmp, "jpeg", quality)
        jpeg = tmp.read_bytes()
        wrap_jpeg_as_pdf(jpeg, image.width, image.height, dest, bands=image.bands)
    except PdfError as exc:
        raise FixError(str(exc)) from exc
    finally:
        tmp.unlink(missing_ok=True)


def _encode(image: pyvips.Image, dest: Path, kind: str, quality: int) -> None:
    """Write `image` as `kind` at `quality`."""
    if kind == "pdf":
        _save_pdf_from_image(image, dest, quality)
        return
    if kind in _OFFICE:
        raise FixError("This portal wants a Word document. Export to PDF and try again.")
    _save_image(image, dest, kind, quality)


def _shrink_image_to_target(image: pyvips.Image, dest: Path, kind: str, preset: Preset) -> pyvips.Image:
    """Iteratively drop quality (then pixels) until the file is under target."""
    target = preset.target_bytes
    max_bytes = preset.max_bytes
    min_bytes = preset.min_bytes or 0
    ceiling = target if target is not None else max_bytes
    current = image
    last_ok: tuple[Path, pyvips.Image] | None = None

    def attempt(img: pyvips.Image, quality: int) -> int:
        _encode(img, dest, kind, quality)
        return dest.stat().st_size

    qualities = _QUALITY_STEPS if kind in {"jpeg", "pdf", "webp", "png"} else (85,)
    for quality in qualities:
        size = attempt(current, quality)
        if min_bytes and size < min_bytes:
            # Too small — keep the previous larger encode if we have one.
            if last_ok is not None:
                break
            continue
        last_ok = (dest, current)
        if ceiling is None or size <= ceiling:
            return current

    # Still over the ceiling: shrink pixels (aspect preserved, never below mins).
    if not preset.do_not_crop:
        # do_not_crop forbids cropping, not uniform downscale; skip aggressive
        # downscale only when a min-pixel floor would be violated.
        pass
    guard = 0
    while ceiling is not None and dest.exists() and dest.stat().st_size > ceiling and guard < 12:
        guard += 1
        shrunk = _scale_down(current, preset)
        if shrunk is None:
            break
        current = shrunk
        size = attempt(current, qualities[-1])
        if min_bytes and size < min_bytes:
            break
        last_ok = (dest, current)
        if size <= ceiling:
            return current

    if not dest.exists() and last_ok is None:
        _encode(image, dest, kind, qualities[0])
    return current


def _pass_through_office(src: Path, dest: Path, preset: Preset) -> None:
    """Copy a Word file if it already fits; otherwise tell the user we cannot shrink it."""
    size = src.stat().st_size
    if preset.max_bytes is not None and size > preset.max_bytes:
        raise FixError(
            "Word documents over the size limit cannot be compressed here. "
            "Export to PDF and try again."
        )
    shutil.copyfile(src, dest)


def _fix_existing_pdf(src: Path, dest: Path, preset: Preset) -> None:
    """Rewrite a PDF (reject passwords) and fail clearly if it still exceeds max."""
    try:
        if pdf_is_encrypted(src):
            raise FixError("This PDF is password-protected. Unlock it and try again.")
        ceiling = preset.target_bytes or preset.max_bytes
        if ceiling is None or src.stat().st_size <= ceiling:
            shutil.copyfile(src, dest)
            return
        rewrite_pdf(src, dest)
    except PdfError as exc:
        raise FixError(str(exc)) from exc
    size = dest.stat().st_size
    if preset.max_bytes is not None and size > preset.max_bytes:
        raise FixError(
            "This PDF is still over the size limit. Convert its pages to images "
            "and run Fix again — full Ghostscript PDF compression is not in this tool yet."
        )


def _inspect_output(path: Path, kind: str) -> tuple[int, int | None, int | None, bool | None, bool]:
    """Return (bytes, width, height, is_colour, encrypted) without logging contents."""
    size = path.stat().st_size
    encrypted = False
    width = height = None
    colour: bool | None = None
    if kind == "pdf":
        try:
            encrypted = pdf_is_encrypted(path)
        except PdfError:
            encrypted = False
        return size, width, height, colour, encrypted
    if kind in _OFFICE:
        return size, None, None, None, False
    try:
        image = pyvips.Image.new_from_file(str(path), access="sequential")
        width, height = image.width, image.height
        colour = _is_colour(image)
    except pyvips.Error:
        pass
    return size, width, height, colour, False


def _build_rules(
    preset: Preset,
    *,
    kind: str,
    size: int,
    width: int | None,
    height: int | None,
    colour: bool | None,
    encrypted: bool,
    cropped: bool,
) -> list[RuleCheck]:
    """Compare the output against every rule the preset declares."""
    rules: list[RuleCheck] = []
    accepted = ", ".join(t.upper() if t != "jpeg" else "JPEG" for t in preset.accepted_types)
    actual_type = "JPEG" if kind == "jpeg" else kind.upper()
    rules.append(
        RuleCheck(
            id="file_type",
            label="File type",
            passed=kind in preset.accepted_types,
            actual=actual_type,
            expected=accepted,
        )
    )
    if preset.min_bytes is not None or preset.max_bytes is not None:
        low = _format_bytes(preset.min_bytes) if preset.min_bytes else None
        high = _format_bytes(preset.max_bytes) if preset.max_bytes else None
        if low and high:
            expected = f"{low} – {high}"
        elif high:
            expected = f"up to {high}"
        else:
            expected = f"at least {low}"
        in_min = preset.min_bytes is None or size >= preset.min_bytes
        in_max = preset.max_bytes is None or size <= preset.max_bytes
        rules.append(
            RuleCheck(
                id="file_size",
                label="File size",
                passed=in_min and in_max,
                actual=_format_bytes(size),
                expected=expected,
            )
        )
    if preset.min_width or preset.min_height:
        need_w = preset.min_width or 1
        need_h = preset.min_height or 1
        actual = "unknown" if width is None or height is None else f"{width} × {height} px"
        passed = width is not None and height is not None and width >= need_w and height >= need_h
        rules.append(
            RuleCheck(
                id="min_pixels",
                label="Minimum pixels",
                passed=passed,
                actual=actual,
                expected=f"at least {need_w} × {need_h} px",
            )
        )
    if preset.orientation in {"portrait", "landscape"} and width and height:
        actual = _orientation_of(width, height)
        rules.append(
            RuleCheck(
                id="orientation",
                label="Orientation",
                passed=actual == preset.orientation,
                actual=actual,
                expected=preset.orientation,
            )
        )
    if preset.colour:
        actual = "unknown" if colour is None else ("colour" if colour else "greyscale")
        rules.append(
            RuleCheck(
                id="colour",
                label="Colour",
                passed=colour is True,
                actual=actual,
                expected="colour",
            )
        )
    if preset.do_not_crop:
        rules.append(
            RuleCheck(
                id="crop",
                label="Crop",
                passed=not cropped,
                actual="not cropped" if not cropped else "cropped",
                expected="not cropped (GOV.UK crops)",
            )
        )
    if preset.no_password:
        rules.append(
            RuleCheck(
                id="password",
                label="Password",
                passed=not encrypted,
                actual="password-protected" if encrypted else "not password-protected",
                expected="no password",
            )
        )
    return rules


def _fix_one(src: Path, dest_dir: Path, index: int, name: str, preset: Preset) -> FileFix:
    """Convert/resize/compress one input and return its report. Never logs the file."""
    input_kind = _kind_from_ext(src.suffix)
    output_kind = _choose_output_type(input_kind, preset)
    dest = dest_dir / f"output-{index}{_EXT_FOR_TYPE[output_kind]}"
    cropped = False
    wrapped: tuple[int, int, bool] | None = None

    if input_kind in _OFFICE:
        if output_kind not in _OFFICE:
            raise FixError("Word documents cannot be converted here. Export to PDF and try again.")
        _pass_through_office(src, dest, preset)
    elif input_kind == "pdf" and output_kind == "pdf":
        _fix_existing_pdf(src, dest, preset)
    else:
        if input_kind == "pdf":
            raise FixError(
                "This preset wants an image, and PDF-to-image is not available yet. "
                "Export a page as JPEG and try again."
            )
        try:
            image = imaging.load(src)
        except imaging.ImageError as exc:
            raise FixError(str(exc)) from exc
        before_w, before_h = image.width, image.height
        # Sequential pipelines can only be encoded once; quality iteration
        # needs a random-access copy in memory.
        image = _meet_min_pixels(image, preset).copy_memory()
        current = _shrink_image_to_target(image, dest, output_kind, preset)
        wrapped = (current.width, current.height, _is_colour(current))
        if preset.do_not_crop:
            # Uniform scale keeps aspect; a crop would change it.
            cropped = abs((before_w / before_h) - (current.width / current.height)) > 0.02

    size, width, height, colour, encrypted = _inspect_output(dest, output_kind)
    # Image-wrapped PDFs have no pixel header; use the raster we encoded.
    if wrapped is not None and (width is None or height is None):
        width, height, colour = wrapped
    rules = _build_rules(
        preset,
        kind=output_kind,
        size=size,
        width=width,
        height=height,
        colour=colour,
        encrypted=encrypted,
        cropped=cropped,
    )
    download = f"{Path(name).stem or 'file'}{_EXT_FOR_TYPE[output_kind]}"
    return FileFix(
        path=dest,
        download_name=download,
        media_type=_MEDIA_FOR_TYPE[output_kind],
        report=FileReport(
            filename=download,
            passed=all(rule.passed for rule in rules),
            rules=rules,
        ),
    )


def fix_files(inputs: list[Path], names: list[str], workspace: Path, preset: Preset) -> JobFix:
    """Fix every input against `preset`. Raises FixError on unrecoverable failures."""
    if not inputs:
        raise FixError("No files were uploaded.")
    results: list[FileFix] = []
    for index, (src, name) in enumerate(zip(inputs, names)):
        results.append(_fix_one(src, workspace, index, name, preset))
    report = FixReport(
        preset_id=preset.id,
        preset_name=preset.name,
        passed=all(item.report.passed for item in results),
        files=[item.report for item in results],
    )
    media_type = results[0].media_type if len(results) == 1 else "application/zip"
    return JobFix(
        outputs=[(item.path, item.download_name) for item in results],
        media_type=media_type,
        report=report,
    )
