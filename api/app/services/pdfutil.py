"""Small PDF helpers for the fix job: wrap a JPEG, detect passwords, lightly compress.

Native Ghostscript distillation (used by chowbea-pdf) is not ported here — it
needs a system `gs` binary this image API does not ship. Image-to-PDF wrapping
plus pypdf stream compression cover the milestone-1 cases (photos and already
small documents). Large existing PDFs that still exceed the limit after a
rewrite raise a clear FixError so the user can export pages as images.
"""

from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError


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
        raise PdfError("The PDF could not be read.") from exc
    return bool(reader.is_encrypted)


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
