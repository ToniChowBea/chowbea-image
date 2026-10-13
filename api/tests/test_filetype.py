"""Magic-byte detection ignores the filename extension."""

from pathlib import Path

import pyvips

from app.services.filetype import detect_kind, kind_extension, refine_office_zip


def test_detects_png_jpeg_pdf_and_rejects_text():
    png = pyvips.Image.black(8, 8).add(40).cast("uchar").write_to_buffer(".png")
    jpeg = pyvips.Image.black(8, 8).add(40).cast("uchar").write_to_buffer(".jpg")
    assert detect_kind(png) == "png"
    assert detect_kind(jpeg) == "jpeg"
    assert detect_kind(b"%PDF-1.7\n") == "pdf"
    assert detect_kind(b"not a file") is None
    assert detect_kind(b"") is None


def test_riff_wave_is_not_webp():
    fake = b"RIFF" + (36).to_bytes(4, "little") + b"WAVE" + b"\x00" * 32
    assert detect_kind(fake) is None


def test_ole_is_doc_and_pk_is_zip():
    assert detect_kind(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 16) == "doc"
    assert detect_kind(b"PK\x03\x04" + b"\x00" * 16) == "zip"


def test_refine_docx_and_odt(tmp_path):
    import zipfile

    docx = tmp_path / "a.docx"
    with zipfile.ZipFile(docx, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", "<w:document/>")
    assert refine_office_zip(docx) == "docx"

    odt = tmp_path / "a.odt"
    with zipfile.ZipFile(odt, "w") as archive:
        archive.writestr("mimetype", "application/vnd.oasis.opendocument.text")
        archive.writestr("content.xml", "<office/>")
    assert refine_office_zip(odt) == "odt"

    random_zip = tmp_path / "a.zip"
    with zipfile.ZipFile(random_zip, "w") as archive:
        archive.writestr("readme.txt", "hi")
    assert refine_office_zip(random_zip) is None


def test_kind_extension_for_known_types():
    assert kind_extension("jpeg") == ".jpg"
    assert kind_extension("docx") == ".docx"
    assert kind_extension("heif") == ".heic"
