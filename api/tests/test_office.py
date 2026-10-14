"""LibreOffice conversion, including a PATH stub when soffice is not installed."""

import os
import stat
from pathlib import Path

import pytest

from app.services.office import OfficeError, convert_office_to_pdf, libreoffice_available


def _stub_soffice(tmp_path: Path) -> Path:
    """Write a soffice-compatible stub that emits a tiny PDF into --outdir."""
    script = tmp_path / "soffice"
    script.write_text(
        "#!/usr/bin/env python3\n"
        "import sys\n"
        "from pathlib import Path\n"
        "args = sys.argv[1:]\n"
        "outdir = Path(args[args.index('--outdir') + 1])\n"
        "src = Path(args[-1])\n"
        "(outdir / f'{src.stem}.pdf').write_bytes(b'%PDF-1.4\\n%%EOF\\n')\n"
    )
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    return script


def test_convert_office_to_pdf_with_stub(tmp_path, monkeypatch):
    stub_dir = tmp_path / "bin"
    stub_dir.mkdir()
    _stub_soffice(stub_dir)
    monkeypatch.setenv("PATH", f"{stub_dir}{os.pathsep}{os.environ.get('PATH', '')}")
    src = tmp_path / "letter.docx"
    src.write_bytes(b"PK\x03\x04fake")
    dest = tmp_path / "letter.pdf"
    convert_office_to_pdf(src, dest)
    assert dest.read_bytes().startswith(b"%PDF")


def test_convert_office_missing_binary(tmp_path, monkeypatch):
    monkeypatch.setenv("PATH", str(tmp_path / "empty"))
    src = tmp_path / "letter.docx"
    src.write_bytes(b"PK")
    with pytest.raises(OfficeError, match="unavailable"):
        convert_office_to_pdf(src, tmp_path / "out.pdf")


@pytest.mark.skipif(not libreoffice_available(), reason="LibreOffice is not installed")
def test_real_libreoffice_converts_minimal_docx(tmp_path):
    import zipfile

    src = tmp_path / "n.docx"
    with zipfile.ZipFile(src, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr(
            "word/document.xml",
            '<?xml version="1.0"?><w:document xmlns:w='
            '"http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:body><w:p><w:r><w:t>Hi</w:t></w:r></w:p></w:body></w:document>",
        )
    dest = tmp_path / "n.pdf"
    convert_office_to_pdf(src, dest)
    assert dest.read_bytes()[:4] == b"%PDF"
