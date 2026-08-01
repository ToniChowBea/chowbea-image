from pathlib import Path

import pyvips
import pytest

from app.services.crop import CropError, crop_image


def _png(path: Path, w=400, h=200) -> Path:
    pyvips.Image.black(w, h).add(70).cast("uchar").write_to_file(str(path))
    return path


def test_crop_aspect_square_centers(tmp_path):
    src = _png(tmp_path / "in.png", 400, 200)
    dst = tmp_path / "out.png"
    crop_image(src, dst, mode="aspect", aspect="1:1")
    out = pyvips.Image.new_from_file(str(dst))
    assert out.width == out.height == 200  # largest centred square of a 400x200


def test_crop_rect_exact_box(tmp_path):
    src = _png(tmp_path / "in.png", 400, 200)
    dst = tmp_path / "out.png"
    crop_image(src, dst, mode="rect", rect={"x": 10, "y": 20, "width": 100, "height": 50})
    out = pyvips.Image.new_from_file(str(dst))
    assert (out.width, out.height) == (100, 50)


def test_crop_rect_out_of_bounds_raises(tmp_path):
    src = _png(tmp_path / "in.png", 400, 200)
    with pytest.raises(CropError):
        crop_image(src, tmp_path / "o.png", mode="rect",
                   rect={"x": 380, "y": 0, "width": 100, "height": 50})
