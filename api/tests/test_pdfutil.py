"""Ghostscript compress-to-target and PDF merge helpers."""

from pathlib import Path

import pyvips
import pytest
from pypdf import PdfWriter

from app.services.pdfutil import (
    PdfError,
    compress_pdf_to_target,
    ghostscript_available,
    merge_pdfs,
    wrap_jpeg_as_pdf,
)


def _jpeg_pdf(path: Path, width: int, height: int, quality: int = 95) -> Path:
    """Wrap a noisy JPEG in a one-page PDF so size reduction is measurable."""
    red = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
    green = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
    blue = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
    jpeg = red.bandjoin([green, blue]).write_to_buffer(".jpg", Q=quality)
    wrap_jpeg_as_pdf(jpeg, width, height, path, bands=3)
    return path


def test_compress_pdf_to_target_does_not_raise_when_still_over(tmp_path):
    src = _jpeg_pdf(tmp_path / "big.pdf", 1800, 1400)
    dest = tmp_path / "out.pdf"
    # Tiny target: we still write a file instead of erroring.
    compress_pdf_to_target(src, dest, target_bytes=1024)
    assert dest.exists()
    assert dest.stat().st_size > 0


@pytest.mark.skipif(not ghostscript_available(), reason="ghostscript (gs) is not installed")
def test_ghostscript_shrinks_oversized_pdf(tmp_path):
    src = _jpeg_pdf(tmp_path / "photo.pdf", 2200, 1600, quality=95)
    assert src.stat().st_size > 100_000
    dest = tmp_path / "small.pdf"
    compress_pdf_to_target(src, dest, target_bytes=100_000)
    assert dest.exists()
    assert dest.stat().st_size <= src.stat().st_size
    assert dest.read_bytes()[:4] == b"%PDF"


def test_merge_pdfs_concatenates_pages(tmp_path):
    a = _jpeg_pdf(tmp_path / "a.pdf", 40, 40, quality=40)
    b = _jpeg_pdf(tmp_path / "b.pdf", 40, 40, quality=40)
    dest = tmp_path / "merged.pdf"
    merge_pdfs([a, b], dest)
    from pypdf import PdfReader

    assert len(PdfReader(str(dest)).pages) == 2


def test_corrupt_pdf_has_clear_error(tmp_path):
    from app.services.pdfutil import pdf_is_encrypted

    bogus = tmp_path / "broken.pdf"
    bogus.write_bytes(b"%PDF-1.4\nthis is not a valid pdf")
    with pytest.raises(PdfError, match="corrupt"):
        pdf_is_encrypted(bogus)


def test_merge_pdfs_rejects_empty_list(tmp_path):
    with pytest.raises(PdfError, match="No PDFs"):
        merge_pdfs([], tmp_path / "x.pdf")


@pytest.mark.skipif(not ghostscript_available(), reason="ghostscript (gs) is not installed")
def test_pdf_first_page_to_image(tmp_path):
    """Convert the first page of a PDF to a JPEG image."""
    from app.services.pdfutil import pdf_first_page_to_image
    
    jpeg = pyvips.Image.black(400, 600, bands=3).add(128).cast("uchar").write_to_buffer(".jpg", Q=95)
    src = tmp_path / "document.pdf"
    wrap_jpeg_as_pdf(jpeg, 400, 600, src, bands=3)
    dest = tmp_path / "page.jpg"
    pdf_first_page_to_image(src, dest, dpi=150)
    
    assert dest.exists()
    assert dest.stat().st_size > 0
    image = pyvips.Image.new_from_file(str(dest))
    assert image.width > 0
    assert image.height > 0
    assert image.get("vips-loader") == "jpegload"


def test_pdf_first_page_to_image_rejects_encrypted(tmp_path):
    """Encrypted PDFs are rejected with a clear error."""
    from app.services.pdfutil import pdf_first_page_to_image
    
    locked = tmp_path / "locked.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    writer.encrypt("secret")
    writer.write(str(locked))
    dest = tmp_path / "page.jpg"
    
    with pytest.raises(PdfError, match="password"):
        pdf_first_page_to_image(locked, dest)
