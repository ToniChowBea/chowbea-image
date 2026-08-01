from pathlib import Path

import pyvips

from app.services.compress import compress_image


def _jpeg(path: Path, w=256, h=256) -> Path:
    # High-frequency noise so a lower Q measurably shrinks the file.
    pyvips.Image.gaussnoise(w, h).cast("uchar").write_to_file(str(path), Q=95)
    return path


def test_compress_shrinks_jpeg_and_keeps_format(tmp_path):
    src = _jpeg(tmp_path / "in.jpg")
    dst = tmp_path / "out.jpg"
    compress_image(src, dst, quality=30)
    assert dst.exists()
    assert dst.stat().st_size < src.stat().st_size
    assert pyvips.Image.new_from_file(str(dst)).get("vips-loader") == "jpegload"
