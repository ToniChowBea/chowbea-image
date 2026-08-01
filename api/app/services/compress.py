"""Shrink an image's file size without changing its format."""

from __future__ import annotations

from pathlib import Path

from app.services import imaging


class CompressError(Exception):
    """Compression failed for a reason worth showing the user."""


def compress_image(src: Path, dst: Path, quality: int) -> None:
    """Re-encode `src` into `dst` (same format, chosen by dst's extension) at
    the given quality. For lossy formats this is the Q factor; for PNG it drives
    palette quantisation (see imaging.save)."""
    try:
        imaging.save(imaging.load(src), dst, quality=quality)
    except imaging.ImageError as exc:
        raise CompressError(str(exc)) from exc
