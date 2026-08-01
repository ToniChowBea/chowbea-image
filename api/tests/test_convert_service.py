from pathlib import Path

import pyvips
import pytest

from app.services.convert import ConvertError, convert_image


def _png(path: Path, w=24, h=12) -> Path:
    pyvips.Image.black(w, h).add(120).cast("uchar").write_to_file(str(path))
    return path


def test_convert_png_to_jpeg(tmp_path):
    src = _png(tmp_path / "in.png")
    dst = tmp_path / "out.jpg"
    convert_image(src, dst, "jpeg", 82)
    assert dst.exists()
    assert pyvips.Image.new_from_file(str(dst)).get("vips-loader") == "jpegload"


def test_convert_unknown_target_raises(tmp_path):
    src = _png(tmp_path / "in.png")
    with pytest.raises(ConvertError):
        convert_image(src, tmp_path / "out.xyz", "xyz", None)
