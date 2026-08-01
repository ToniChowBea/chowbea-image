"""Convert an image to another format via libvips."""

from __future__ import annotations

from pathlib import Path

from app.services import imaging


class ConvertError(Exception):
    """A conversion failed for a reason worth showing the user."""


def convert_image(src: Path, dst: Path, target: str, quality: int | None) -> None:
    if target not in imaging.ENCODE_TARGETS:
        raise ConvertError(f"Cannot convert to '{target}'.")
    try:
        imaging.save(imaging.load(src), dst, quality=quality)
    except imaging.ImageError as exc:
        raise ConvertError(str(exc)) from exc
