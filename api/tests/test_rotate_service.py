from pathlib import Path

import pyvips
import pytest

from app.services.rotate import RotateError, rotate_image


def _png(path: Path, w=40, h=20) -> Path:
    pyvips.Image.black(w, h).add(100).cast("uchar").write_to_file(str(path))
    return path


def test_rotate_90_swaps_dimensions(tmp_path):
    src = _png(tmp_path / "in.png", 40, 20)
    dst = tmp_path / "out.png"
    rotate_image(src, dst, rotation=90, flip="none")
    out = pyvips.Image.new_from_file(str(dst))
    assert (out.width, out.height) == (20, 40)


def test_rotate_180_keeps_dimensions(tmp_path):
    src = _png(tmp_path / "in.png", 40, 20)
    dst = tmp_path / "out.png"
    rotate_image(src, dst, rotation=180, flip="horizontal")
    out = pyvips.Image.new_from_file(str(dst))
    assert (out.width, out.height) == (40, 20)


def test_rotate_bad_angle_raises(tmp_path):
    src = _png(tmp_path / "in.png")
    with pytest.raises(RotateError):
        rotate_image(src, tmp_path / "o.png", rotation=45, flip="none")
