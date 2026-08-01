"""Crop an image to an aspect-ratio (centred) or an exact pixel rectangle."""

from __future__ import annotations

from pathlib import Path

from app.services import imaging

ASPECT_RATIOS: dict[str, tuple[int, int]] = {
    "1:1": (1, 1),
    "4:3": (4, 3),
    "16:9": (16, 9),
    "9:16": (9, 16),
}


class CropError(Exception):
    """A crop failed for a reason worth showing the user."""


def _centered_box(w: int, h: int, ratio_w: int, ratio_h: int) -> tuple[int, int, int, int]:
    """Largest rectangle of ratio_w:ratio_h that fits in w×h, centred."""
    if w * ratio_h >= h * ratio_w:
        crop_h = h
        crop_w = round(h * ratio_w / ratio_h)
    else:
        crop_w = w
        crop_h = round(w * ratio_h / ratio_w)
    left = (w - crop_w) // 2
    top = (h - crop_h) // 2
    return left, top, crop_w, crop_h


def crop_image(src: Path, dst: Path, *, mode: str, aspect: str | None = None, rect: dict | None = None) -> None:
    try:
        image = imaging.load(src)
    except imaging.ImageError as exc:
        raise CropError(str(exc)) from exc

    if mode == "aspect":
        ratio = ASPECT_RATIOS.get(aspect or "")
        if ratio is None:
            raise CropError("Unknown aspect ratio.")
        left, top, box_w, box_h = _centered_box(image.width, image.height, *ratio)
    elif mode == "rect":
        if not rect:
            raise CropError("A crop rectangle is required.")
        left, top = int(rect["x"]), int(rect["y"])
        box_w, box_h = int(rect["width"]), int(rect["height"])
        if left < 0 or top < 0 or box_w <= 0 or box_h <= 0 or left + box_w > image.width or top + box_h > image.height:
            raise CropError("The crop rectangle is outside the image.")
    else:
        raise CropError("Unknown crop mode.")

    cropped = image.crop(left, top, box_w, box_h)
    try:
        imaging.save(cropped, dst)
    except imaging.ImageError as exc:
        raise CropError(str(exc)) from exc
