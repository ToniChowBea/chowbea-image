"""Resize an image by dimensions, percentage, or a named width preset."""

from __future__ import annotations

from pathlib import Path

import pyvips

from app.services import imaging

WIDTH_PRESETS: dict[str, int] = {"1920": 1920, "1280": 1280, "640": 640}


class ResizeError(Exception):
    """A resize failed for a reason worth showing the user."""


def _target_dimensions(
    src_w: int,
    src_h: int,
    *,
    mode: str,
    width: int | None,
    height: int | None,
    lock_aspect: bool,
    percent: float | None,
    preset: str | None,
) -> tuple[int, int]:
    if mode == "percent":
        if not percent or percent <= 0:
            raise ResizeError("A positive percentage is required.")
        return max(1, round(src_w * percent / 100)), max(1, round(src_h * percent / 100))
    if mode == "preset":
        target_w = WIDTH_PRESETS.get(preset or "")
        if target_w is None:
            raise ResizeError("Unknown size preset.")
        return target_w, max(1, round(src_h * target_w / src_w))
    if mode == "dimensions":
        if lock_aspect:
            if width:
                return width, max(1, round(src_h * width / src_w))
            if height:
                return max(1, round(src_w * height / src_h)), height
            raise ResizeError("A width or height is required.")
        if not width or not height:
            raise ResizeError("Both width and height are required when aspect is unlocked.")
        return width, height
    raise ResizeError("Unknown resize mode.")


def resize_image(
    src: Path,
    dst: Path,
    *,
    mode: str,
    width: int | None = None,
    height: int | None = None,
    lock_aspect: bool = True,
    percent: float | None = None,
    preset: str | None = None,
) -> None:
    try:
        image = imaging.load(src)
    except imaging.ImageError as exc:
        raise ResizeError(str(exc)) from exc

    target_w, target_h = _target_dimensions(
        image.width,
        image.height,
        mode=mode,
        width=width,
        height=height,
        lock_aspect=lock_aspect,
        percent=percent,
        preset=preset,
    )
    # thumbnail_image is libvips' fast, high-quality resizer; force the exact
    # box (no upscale guard) so unlocked dimensions are honoured precisely.
    resized = image.thumbnail_image(target_w, height=target_h, size=pyvips.Size.FORCE)
    try:
        imaging.save(resized, dst)
    except imaging.ImageError as exc:
        raise ResizeError(str(exc)) from exc
