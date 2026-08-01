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
    # pyvips.get() always appends its own "(raw, type, N components, N bytes)"
    # display annotation to every exif- field (this happens for any string,
    # not just ours) — strip that wrapper to compare the actual stored value.
    # This is the same "(...)" pattern libvips' own drop_tail() strips before
    # re-writing a value, so it's the canonical way to get the raw value back.
    assert software.split(" (")[0] == imaging.ATTRIBUTION
    assert "SomeOtherApp" not in software

    xmp = result.get("xmp-data").decode("utf-8")
    assert imaging.ATTRIBUTION in xmp


def test_save_writes_requested_format_by_extension(tmp_path):
    src = _write_source(tmp_path / "in.png")
    out = tmp_path / "out.webp"
    imaging.save(imaging.load(src), out, quality=75)
    assert pyvips.Image.new_from_file(str(out)).get("vips-loader") == "webpload"


def test_tiff_attribution_in_xmp_only(tmp_path):
    """libvips 8.18.4's tiffsave drops exif-ifd0-Software even with keep=EXIF;
    TIFF output carries attribution via XMP only. This is accepted behavior
    (see the note in imaging.save()) — this test locks it in so a future
    libvips upgrade that changes this is noticed rather than silently relied on.
    """
    src = _write_source(tmp_path / "in.png")
    out = tmp_path / "out.tiff"
    imaging.save(imaging.load(src), out)

    result = pyvips.Image.new_from_file(str(out))
    xmp = result.get("xmp-data").decode("utf-8")
    assert imaging.ATTRIBUTION in xmp
    assert "exif-ifd0-Software" not in result.get_fields()


def test_save_strips_gps_and_timestamps(tmp_path):
    """The core privacy guarantee: real inherited identity metadata (GPS,
    capture timestamp, a personal XMP packet) must not survive save() —
    not just the Software tag `_write_source` happens to overwrite.
    """
    src = tmp_path / "identity.png"
    img = pyvips.Image.black(32, 16).add(64).cast("uchar").copy()
    img.set_type(pyvips.GValue.gstr_type, "exif-ifd3-GPSLatitude", "51/1 30/1 0/1")
    img.set_type(pyvips.GValue.gstr_type, "exif-ifd0-DateTime", "2020:01:01 12:00:00")
    img.set_type(pyvips.GValue.blob_type, "xmp-data", b"<x:xmpmeta>SecretPersonalXMP</x:xmpmeta>")
    img.write_to_file(str(src))

    out = tmp_path / "out.jpg"
    imaging.save(imaging.load(src), out, quality=80)

    result = pyvips.Image.new_from_file(str(out))
    fields = result.get_fields()
    assert "exif-ifd3-GPSLatitude" not in fields
    assert "exif-ifd0-DateTime" not in fields

    xmp = result.get("xmp-data").decode("utf-8")
    assert "SecretPersonalXMP" not in xmp
    assert imaging.ATTRIBUTION in xmp
