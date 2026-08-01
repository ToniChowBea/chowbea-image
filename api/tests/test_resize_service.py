from pathlib import Path

import pyvips
import pytest

from app.services.resize import ResizeError, resize_image


def _png(path: Path, w=400, h=200) -> Path:
    pyvips.Image.black(w, h).add(90).cast("uchar").write_to_file(str(path))
    return path


def test_resize_percent_halves(tmp_path):
    src = _png(tmp_path / "in.png", 400, 200)
    dst = tmp_path / "out.png"
    resize_image(src, dst, mode="percent", percent=50)
    out = pyvips.Image.new_from_file(str(dst))
    assert (out.width, out.height) == (200, 100)


def test_resize_dimensions_lock_aspect_uses_width(tmp_path):
    src = _png(tmp_path / "in.png", 400, 200)
    dst = tmp_path / "out.png"
    resize_image(src, dst, mode="dimensions", width=100, height=999, lock_aspect=True)
    out = pyvips.Image.new_from_file(str(dst))
    assert (out.width, out.height) == (100, 50)


def test_resize_preset(tmp_path):
    src = _png(tmp_path / "in.png", 3840, 2160)
    dst = tmp_path / "out.png"
    resize_image(src, dst, mode="preset", preset="1920")
    assert pyvips.Image.new_from_file(str(dst)).width == 1920


def test_resize_bad_mode_raises(tmp_path):
    src = _png(tmp_path / "in.png")
    with pytest.raises(ResizeError):
        resize_image(src, tmp_path / "o.png", mode="nope")
