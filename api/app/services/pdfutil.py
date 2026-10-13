"""PDF helpers for the fix job: wrap a JPEG, detect passwords, distill, merge.

Ghostscript (`gs`) does compress-to-target distillation. The worker image
installs it via apt (`ghostscript` in the Dockerfile). Locally install the
same package (`sudo apt-get install ghostscript` or `brew install ghostscript`).
When `gs` is missing, we fall back to a pypdf rewrite and return the smallest
file we can — callers report a size-rule fail instead of crashing.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError

logger = logging.getLogger(__name__)

def _downsample_args(dpi: int) -> tuple[str, ...]:
    """Force image downsampling. Threshold 1.0 so a 72 dpi wrap still shrinks."""
    return (
        "-dPDFSETTINGS=/screen",
        "-dDownsampleColorImages=true",
        "-dDownsampleGrayImages=true",
        "-dDownsampleMonoImages=true",
        "-dColorImageDownsampleType=/Bicubic",
        "-dGrayImageDownsampleType=/Bicubic",
        "-dMonoImageDownsampleType=/Subsample",
        f"-dColorImageResolution={dpi}",
        f"-dGrayImageResolution={dpi}",
        f"-dMonoImageResolution={dpi}",
        "-dColorImageDownsampleThreshold=1.0",
        "-dGrayImageDownsampleThreshold=1.0",
        "-dMonoImageDownsampleThreshold=1.0",
        "-dAutoFilterColorImages=false",
        "-dColorImageFilter=/DCTEncode",
    )


# Highest quality first. Stop at the first output that fits the byte target.
_GS_LADDER: tuple[tuple[str, ...], ...] = (
    ("-dPDFSETTINGS=/printer",),
    ("-dPDFSETTINGS=/ebook",),
    ("-dPDFSETTINGS=/screen",),
    _downsample_args(72),
    _downsample_args(50),
    _downsample_args(36),
    _downsample_args(24),
)


class PdfError(Exception):
    """A user-facing PDF failure (password, corrupt file, write error)."""


def is_pdf(path: Path) -> bool:
    """True when the file starts with a PDF magic header. Never logs bytes."""
    try:
        with path.open("rb") as handle:
            head = handle.read(5)
    except OSError as exc:
        raise PdfError("The PDF could not be read.") from exc
    return head.startswith(b"%PDF")


def pdf_is_encrypted(path: Path) -> bool:
    """Return True if the PDF requires a password to open."""
    try:
        reader = PdfReader(str(path), strict=False)
    except PdfReadError as exc:
        raise PdfError(
            "This PDF is corrupt or unreadable. Export it again and try again."
        ) from exc
    return bool(reader.is_encrypted)


def ghostscript_available() -> bool:
    """True when a `gs` binary is on PATH (worker image or local install)."""
    return shutil.which("gs") is not None


def wrap_jpeg_as_pdf(jpeg: bytes, width: int, height: int, dest: Path, *, bands: int = 3) -> None:
    """Write a one-page PDF that embeds `jpeg` at its pixel size (72 dpi).

    Does not log or include the JPEG bytes in errors.
    """
    if not jpeg.startswith(b"\xff\xd8"):
        raise PdfError("The image could not be written as a PDF.")
    w, h = max(1, int(width)), max(1, int(height))
    colorspace = "/DeviceGray" if bands == 1 else "/DeviceRGB"
    contents = f"q {w} 0 0 {h} 0 0 cm /Im0 Do Q\n".encode("ascii")

    def obj(number: int, body: bytes) -> bytes:
        return f"{number} 0 obj\n".encode("ascii") + body + b"\nendobj\n"

    objects = [
        obj(1, b"<< /Type /Catalog /Pages 2 0 R >>"),
        obj(2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
        obj(
            3,
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {w} {h}] "
                f"/Contents 5 0 R /Resources << /XObject << /Im0 4 0 R >> >> >>"
            ).encode("ascii"),
        ),
        obj(
            4,
            (
                f"<< /Type /XObject /Subtype /Image /Width {w} /Height {h} "
                f"/ColorSpace {colorspace} /BitsPerComponent 8 /Filter /DCTDecode "
                f"/Length {len(jpeg)} >>\nstream\n"
            ).encode("ascii")
            + jpeg
            + b"\nendstream",
        ),
        obj(
            5,
            f"<< /Length {len(contents)} >>\nstream\n".encode("ascii") + contents + b"endstream",
        ),
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for item in objects:
        offsets.append(len(out))
        out.extend(item)
    xref_pos = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.extend(b"0000000000 65535 f \n")
    for offset in offsets:
        out.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    out.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_pos}\n%%EOF\n"
        ).encode("ascii")
    )
    dest.write_bytes(bytes(out))


def rewrite_pdf(src: Path, dest: Path) -> None:
    """Clone `src` through pypdf, compressing content streams where possible.

    Rejects password-protected files. If the rewrite is larger than the
    original, keep the original bytes so we never inflate.
    """
    if pdf_is_encrypted(src):
        raise PdfError("This PDF is password-protected. Unlock it and try again.")
    try:
        writer = PdfWriter(clone_from=str(src))
        for page in writer.pages:
            page.compress_content_streams()
        writer.write(str(dest))
    except PdfError:
        raise
    except Exception as exc:  # noqa: BLE001 - pypdf raises a wide set of errors
        raise PdfError("The PDF could not be rewritten.") from exc
    original = src.stat().st_size
    if dest.stat().st_size >= original and src.resolve() != dest.resolve():
        dest.write_bytes(src.read_bytes())


def merge_pdfs(paths: list[Path], dest: Path) -> None:
    """Concatenate unlocked PDFs into `dest`. Never logs page contents."""
    if not paths:
        raise PdfError("No PDFs to merge.")
    writer = PdfWriter()
    try:
        for path in paths:
            if pdf_is_encrypted(path):
                raise PdfError("This PDF is password-protected. Unlock it and try again.")
            reader = PdfReader(str(path), strict=False)
            for page in reader.pages:
                writer.add_page(page)
        writer.write(str(dest))
    except PdfError:
        raise
    except Exception as exc:  # noqa: BLE001 - pypdf raises a wide set of errors
        raise PdfError("The PDFs could not be merged.") from exc


def _run_gs(src: Path, dest: Path, extra: tuple[str, ...]) -> None:
    """Run Ghostscript pdfwrite. Errors stay generic — never include gs output."""
    cmd = [
        "gs",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dSAFER",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        *extra,
        f"-sOutputFile={dest}",
        str(src),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=120, check=False)
    except FileNotFoundError as exc:
        raise PdfError("PDF compression is unavailable on this server.") from exc
    except subprocess.TimeoutExpired as exc:
        raise PdfError("PDF compression timed out.") from exc
    if proc.returncode != 0 or not dest.exists() or dest.stat().st_size == 0:
        logger.warning("Ghostscript pdfwrite failed (exit %s)", proc.returncode)
        raise PdfError("The PDF could not be compressed.")


def compress_pdf_to_target(src: Path, dest: Path, target_bytes: int) -> None:
    """Shrink `src` toward `target_bytes` and write the best result to `dest`.

    Tries a pypdf rewrite, then Ghostscript settings from printer → screen,
    then heavier image downsampling. Keeps the smallest valid PDF. If nothing
    fits the target, still writes that smallest file (the caller reports fail).
    """
    if pdf_is_encrypted(src):
        raise PdfError("This PDF is password-protected. Unlock it and try again.")
    if target_bytes <= 0:
        raise PdfError("The PDF could not be compressed.")

    best: Path | None = None
    best_size: int | None = None

    def consider(path: Path) -> bool:
        """Remember `path` if it is the smallest so far. True when it fits."""
        nonlocal best, best_size
        size = path.stat().st_size
        if size <= 0:
            return False
        if best_size is None or size < best_size:
            best = path
            best_size = size
        return size <= target_bytes

    work = Path(tempfile.mkdtemp(prefix="chowbea-gs-"))
    try:
        rewritten = work / "rewrite.pdf"
        try:
            rewrite_pdf(src, rewritten)
            if consider(rewritten) and best is not None:
                _copy_best(best, dest, src)
                return
        except PdfError:
            logger.warning("pypdf rewrite skipped before Ghostscript")

        if ghostscript_available():
            for index, extra in enumerate(_GS_LADDER):
                candidate = work / f"gs-{index}.pdf"
                try:
                    _run_gs(src, candidate, extra)
                except PdfError:
                    continue
                if consider(candidate) and best is not None:
                    _copy_best(best, dest, src)
                    return
            # Image-only PDFs sometimes ignore pdfwrite; rasterize pages to JPEG.
            for dpi, quality in ((72, 40), (50, 35), (36, 30), (24, 25)):
                candidate = work / f"raster-{dpi}-{quality}.pdf"
                try:
                    _rasterize_pdf(src, candidate, work / f"pages-{dpi}-{quality}", dpi, quality)
                except PdfError:
                    continue
                if consider(candidate) and best is not None:
                    _copy_best(best, dest, src)
                    return

        if best is None:
            # Last resort: copy the original so the job still produces a file.
            dest.write_bytes(src.read_bytes())
            return
        _copy_best(best, dest, src)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def _rasterize_pdf(src: Path, dest: Path, page_dir: Path, dpi: int, quality: int) -> None:
    """Render each page to JPEG and wrap them back into a PDF under `dest`."""
    page_dir.mkdir(parents=True, exist_ok=True)
    pattern = page_dir / "page-%d.jpg"
    cmd = [
        "gs",
        "-sDEVICE=jpeg",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dSAFER",
        f"-dJPEGQ={quality}",
        f"-r{dpi}",
        f"-sOutputFile={pattern}",
        str(src),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=120, check=False)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        raise PdfError("The PDF could not be compressed.") from exc
    pages = sorted(page_dir.glob("page-*.jpg"), key=lambda p: p.name)
    if proc.returncode != 0 or not pages:
        raise PdfError("The PDF could not be compressed.")
    pdf_pages: list[Path] = []
    try:
        import pyvips
    except ImportError as exc:  # pragma: no cover - pyvips is a runtime dep
        raise PdfError("The PDF could not be compressed.") from exc
    for index, jpeg_path in enumerate(pages):
        try:
            image = pyvips.Image.new_from_file(str(jpeg_path), access="sequential")
            pdf_path = page_dir / f"wrap-{index}.pdf"
            wrap_jpeg_as_pdf(jpeg_path.read_bytes(), image.width, image.height, pdf_path, bands=image.bands)
            pdf_pages.append(pdf_path)
        except (pyvips.Error, PdfError, OSError) as exc:
            raise PdfError("The PDF could not be compressed.") from exc
    if len(pdf_pages) == 1:
        dest.write_bytes(pdf_pages[0].read_bytes())
        return
    merge_pdfs(pdf_pages, dest)


def _copy_best(best: Path, dest: Path, original: Path) -> None:
    """Write `best` to `dest`, preferring the original when it is smaller."""
    if original.stat().st_size < best.stat().st_size:
        dest.write_bytes(original.read_bytes())
        return
    if best.resolve() == dest.resolve():
        return
    dest.write_bytes(best.read_bytes())
