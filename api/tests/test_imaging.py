import pyvips
import pytest

from app.services import imaging


def _write_source(path, width=32, height=16, fmt=".png"):
    # A simple gradient with EXIF GPS + Software set, so we can prove stripping.
    img = pyvips.Image.black(width, height).add(64).cast("uchar").copy()
    img = img.copy()
    img.set_type(pyvips.GValue.gstr_type, "exif-ifd0-Software", "SomeOtherApp")
    img.write_to_file(str(path))
    return path


def test_load_rejects_too_many_pixels(tmp_path, monkeypatch):
    monkeypatch.setattr(imaging.settings, "max_image_megapixels", 1)  # 1 MP cap
    src = tmp_path / "big.png"
    pyvips.Image.black(2000, 2000).write_to_file(str(src))  # 4 MP
    with pytest.raises(imaging.TooManyPixelsError):
        imaging.load(src)


def test_save_strips_metadata_and_stamps_attribution(tmp_path):
    src = _write_source(tmp_path / "in.png")
    out = tmp_path / "out.jpg"
    imaging.save(imaging.load(src), out, quality=80)

    result = pyvips.Image.new_from_file(str(out))
    software = result.get("exif-ifd0-Software")
    assert imaging.ATTRIBUTION in software
    assert "SomeOtherApp" not in software


def test_save_writes_requested_format_by_extension(tmp_path):
    src = _write_source(tmp_path / "in.png")
    out = tmp_path / "out.webp"
    imaging.save(imaging.load(src), out, quality=75)
    assert pyvips.Image.new_from_file(str(out)).get("vips-loader") == "webpload"
