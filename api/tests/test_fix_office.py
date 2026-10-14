"""Word pass-through when compliant; convert to PDF when the portal wants PDF."""

import zipfile
from pathlib import Path

import pytest

from app.services.fix import FixError, fix_files
from app.services.presets import get_preset


def _docx(path: Path, pad: int = 0) -> Path:
    """Minimal DOCX (ZIP + word/) so magic-byte refine treats it as Word."""
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", "<w:document/>")
        if pad:
            archive.writestr("word/pad.bin", b"x" * pad)
    return path


def test_compliant_docx_passed_through_for_nhs_jobs(tmp_path):
    src = _docx(tmp_path / "cv.docx")
    preset = get_preset("nhs-jobs")
    assert preset is not None
    result = fix_files([src], ["cv.docx"], tmp_path, preset)
    out, name = result.outputs[0]
    assert name.endswith(".docx")
    assert out.read_bytes() == src.read_bytes()
    assert result.report.passed is True


def test_oversize_docx_converts_to_pdf_when_portal_accepts_pdf(tmp_path, monkeypatch):
    src = _docx(tmp_path / "big.docx", pad=2 * 1024 * 1024)
    preset = get_preset("nhs-jobs")
    assert preset is not None
    assert src.stat().st_size > preset.max_bytes

    def fake_convert(source: Path, dest: Path) -> None:
        import pyvips

        from app.services.pdfutil import wrap_jpeg_as_pdf

        jpeg = pyvips.Image.black(24, 24).add(40).cast("uchar").write_to_buffer(".jpg")
        wrap_jpeg_as_pdf(jpeg, 24, 24, dest)

    monkeypatch.setattr("app.services.fix.convert_office_to_pdf", fake_convert)
    result = fix_files([src], ["big.docx"], tmp_path, preset)
    out, name = result.outputs[0]
    assert name.endswith(".pdf")
    assert out.read_bytes().startswith(b"%PDF")


def test_word_rejected_when_portal_wants_only_jpeg(tmp_path):
    src = _docx(tmp_path / "photo.docx")
    preset = get_preset("uk-passport-online")
    assert preset is not None
    with pytest.raises(FixError, match="does not accept Word"):
        fix_files([src], ["photo.docx"], tmp_path, preset)


def test_merge_converts_docx_via_office(tmp_path, monkeypatch):
    a = _docx(tmp_path / "a.docx")
    b = _docx(tmp_path / "b.docx")
    preset = get_preset("ucas-documents")
    assert preset is not None
    calls: list[Path] = []

    def fake_convert(source: Path, dest: Path) -> None:
        import pyvips

        from app.services.pdfutil import wrap_jpeg_as_pdf

        calls.append(source)
        jpeg = pyvips.Image.black(24, 24).add(40).cast("uchar").write_to_buffer(".jpg")
        wrap_jpeg_as_pdf(jpeg, 24, 24, dest)

    monkeypatch.setattr("app.services.fix.convert_office_to_pdf", fake_convert)
    # Under-limit DOCX is not in UCAS accepted_types (pdf/jpeg/odt), so each file
    # converts to PDF in _fix_one; merge then copies those PDFs.
    result = fix_files([a, b], ["a.docx", "b.docx"], tmp_path, preset, merge=True)
    assert result.media_type == "application/pdf"
    assert result.outputs[0][1] == "evidence-pack.pdf"
    assert calls
