"""Rotate (multiples of 90°) and/or flip an image."""

from __future__ import annotations

from pathlib import Path

import pyvips

from app.services import imaging

_ANGLES = {0: None, 90: pyvips.Angle.D90, 180: pyvips.Angle.D180, 270: pyvips.Angle.D270}
_FLIPS = {"none": None, "horizontal": pyvips.Direction.HORIZONTAL, "vertical": pyvips.Direction.VERTICAL}


class RotateError(Exception):
    """A rotate/flip failed for a reason worth showing the user."""


def rotate_image(src: Path, dst: Path, *, rotation: int, flip: str) -> None:
    if rotation not in _ANGLES:
        raise RotateError("Rotation must be 0, 90, 180, or 270 degrees.")
    if flip not in _FLIPS:
        raise RotateError("Flip must be none, horizontal, or vertical.")
    try:
        image = imaging.load(src)
    except imaging.ImageError as exc:
        raise RotateError(str(exc)) from exc

    angle = _ANGLES[rotation]
    if angle is not None:
        image = image.rot(angle)
    direction = _FLIPS[flip]
    if direction is not None:
        image = image.flip(direction)
    try:
        imaging.save(image, dst)
    except imaging.ImageError as exc:
        raise RotateError(str(exc)) from exc
