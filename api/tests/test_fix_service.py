"""Fix job: passport photo, UCAS PDF, generic 1 MB JPG, and worker wiring."""

from pathlib import Path

import pyvips
import pytest
from pypdf import PdfWriter

from app.jobs.registry import JobRegistry
from app.jobs.worker import run_job
from app.services.fix import FixError, fix_files
from app.services.pdfutil import ghostscript_available, wrap_jpeg_as_pdf
from app.services.presets import get_preset


def _colour_jpeg(path: Path, width: int, height: int, quality: int = 95) -> Path:
    """Write a noisy RGB JPEG so size reduction is measurable."""
    red = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
    green = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
    blue = pyvips.Image.gaussnoise(width, height, sigma=60).cast("uchar")
    red.bandjoin([green, blue]).write_to_file(str(path), Q=quality)
    return path


def _rule_map(report) -> dict[str, object]:
    """Index the first file's rules by id for assertions."""
    return {rule.id: rule for rule in report.files[0].rules}


def test_fix_passport_photo_meets_govuk_rules(tmp_path):
    src = _colour_jpeg(tmp_path / "photo.jpg", 800, 1000)
    preset = get_preset("uk-passport-online")
    assert preset is not None
    result = fix_files([src], ["photo.jpg"], tmp_path, preset)

    out, name = result.outputs[0]
    assert name.endswith(".jpg")
    image = pyvips.Image.new_from_file(str(out))
    assert image.width >= 600
    assert image.height >= 750
    # Aspect preserved — we must not crop; GOV.UK crops.
    assert abs((800 / 1000) - (image.width / image.height)) < 0.02
    size = out.stat().st_size
    assert 50 * 1024 <= size <= 10 * 1024 * 1024
    assert result.report.passed is True
    rules = _rule_map(result.report)
    assert rules["file_type"].passed
    assert rules["file_size"].passed
    assert rules["min_pixels"].passed
    assert rules["colour"].passed
    assert rules["crop"].passed


def test_fix_ucas_pdf_under_5mb_and_unlocked(tmp_path):
    jpeg = pyvips.Image.black(200, 200, bands=3).add(40).cast("uchar").write_to_buffer(".jpg")
    src = tmp_path / "transcript.pdf"
    wrap_jpeg_as_pdf(jpeg, 200, 200, src)
    preset = get_preset("ucas-documents")
    assert preset is not None
    result = fix_files([src], ["transcript.pdf"], tmp_path, preset)

    out, name = result.outputs[0]
    assert name.endswith(".pdf")
    assert out.stat().st_size <= 5 * 1024 * 1024
    rules = _rule_map(result.report)
    assert rules["file_type"].passed
    assert rules["file_size"].passed
    assert rules["password"].passed
    assert result.report.passed is True


def test_fix_ucas_rejects_password_pdf(tmp_path):
    locked = tmp_path / "locked.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    writer.encrypt("secret")
    writer.write(str(locked))
    preset = get_preset("ucas-documents")
    assert preset is not None
    with pytest.raises(FixError, match="password"):
        fix_files([locked], ["locked.pdf"], tmp_path, preset)


def test_fix_generic_jpg_under_1mb(tmp_path):
    src = _colour_jpeg(tmp_path / "big.jpg", 2400, 1800, quality=95)
    assert src.stat().st_size > 1024 * 1024
    preset = get_preset("jpg-1mb")
    assert preset is not None
    result = fix_files([src], ["big.jpg"], tmp_path, preset)

    out, name = result.outputs[0]
    assert name.endswith(".jpg")
    assert out.stat().st_size <= 1024 * 1024
    # Aim ~10% under the max so portals with binary/decimal MB disagreement still pass.
    assert out.stat().st_size <= int(1024 * 1024 * 0.9)
    assert pyvips.Image.new_from_file(str(out)).get("vips-loader") == "jpegload"
    assert _rule_map(result.report)["file_size"].passed
    assert result.report.passed is True


def test_run_fix_job_attaches_report(tmp_path):
    preset = get_preset("jpg-1mb")
    assert preset is not None
    workspace = tmp_path / "job"
    workspace.mkdir()
    _colour_jpeg(workspace / "input-0.jpg", 800, 600)
    registry = JobRegistry()
    record = registry.create(
        tool="fix",
        workspace=workspace,
        file_count=1,
        total_bytes=0,
        params={"names": ["snap.jpg"], "exts": [".jpg"], "preset": "jpg-1mb"},
    )
    run_job(record)
    assert record.result_path is not None
    assert record.media_type == "image/jpeg"
    assert record.report is not None
    assert record.report["preset_id"] == "jpg-1mb"
    assert record.report["passed"] is True
    assert record.report.get("merged") is False


def test_fix_oversized_pdf_does_not_error(tmp_path):
    """Oversized PDFs are distilled (or best-effort copied), never rejected with FixError."""
    jpeg = (
        pyvips.Image.gaussnoise(1600, 1200, sigma=60)
        .cast("uchar")
        .bandjoin(
            [
                pyvips.Image.gaussnoise(1600, 1200, sigma=60).cast("uchar"),
                pyvips.Image.gaussnoise(1600, 1200, sigma=60).cast("uchar"),
            ]
        )
        .write_to_buffer(".jpg", Q=95)
    )
    src = tmp_path / "chunky.pdf"
    wrap_jpeg_as_pdf(jpeg, 1600, 1200, src, bands=3)
    preset = get_preset("pdf-100kb")
    assert preset is not None
    result = fix_files([src], ["chunky.pdf"], tmp_path, preset)
    out, name = result.outputs[0]
    assert name.endswith(".pdf")
    assert out.exists()
    # Rule card may still fail size if Ghostscript cannot reach 100 KB.
    rules = _rule_map(result.report)
    assert "file_size" in rules


def test_fix_merge_two_images_into_one_pdf(tmp_path):
    a = _colour_jpeg(tmp_path / "a.jpg", 80, 80, quality=40)
    b = _colour_jpeg(tmp_path / "b.jpg", 80, 80, quality=40)
    preset = get_preset("ucas-documents")
    assert preset is not None
    result = fix_files([a, b], ["a.jpg", "b.jpg"], tmp_path, preset, merge=True)
    assert result.media_type == "application/pdf"
    assert len(result.outputs) == 1
    out, name = result.outputs[0]
    assert name == "evidence-pack.pdf"
    from pypdf import PdfReader

    assert len(PdfReader(str(out)).pages) == 2
    assert result.report.merged is True
    assert len(result.report.files) == 3  # two individuals + the pack


@pytest.mark.skipif(not ghostscript_available(), reason="ghostscript (gs) is not installed")
def test_fix_pdf_under_2mb_with_ghostscript(tmp_path):
    jpeg = (
        pyvips.Image.gaussnoise(2000, 1500, sigma=70)
        .cast("uchar")
        .bandjoin(
            [
                pyvips.Image.gaussnoise(2000, 1500, sigma=70).cast("uchar"),
                pyvips.Image.gaussnoise(2000, 1500, sigma=70).cast("uchar"),
            ]
        )
        .write_to_buffer(".jpg", Q=95)
    )
    src = tmp_path / "scan.pdf"
    wrap_jpeg_as_pdf(jpeg, 2000, 1500, src, bands=3)
    preset = get_preset("pdf-2mb")
    assert preset is not None
    assert src.stat().st_size > 0
    result = fix_files([src], ["scan.pdf"], tmp_path, preset)
    out, _name = result.outputs[0]
    assert out.stat().st_size <= 2 * 1024 * 1024
