"""libvips load/save helpers shared by every image tool.

Centralizes two cross-cutting concerns so they live in exactly one place:
the decompression-bomb guard (on load) and the metadata policy (on save) —
strip everything a source carried, then stamp our own attribution.
"""

from __future__ import annotations

from pathlib import Path

import pyvips

from app.core.config import settings

ATTRIBUTION = "Chowbea Image - img.chowbea.com"

# Minimal XMP packet carrying the same attribution, written verbatim.
_XMP_PACKET = (
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>'
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">'
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">'
    f"<xmp:CreatorTool>{ATTRIBUTION}</xmp:CreatorTool>"
    "</rdf:Description></rdf:RDF></x:xmpmeta>"
    '<?xpacket end="w"?>'
).encode("utf-8")

# Convert target name -> output extension and MIME type.
ENCODE_TARGETS: dict[str, str] = {
    "png": ".png",
    "jpeg": ".jpg",
    "webp": ".webp",
    "avif": ".avif",
    "tiff": ".tiff",
}
MEDIA_TYPES: dict[str, str] = {
    "png": "image/png",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "avif": "image/avif",
    "tiff": "image/tiff",
}

# File extension (with dot, lowercase) -> MIME type, for keep-format outputs
# whose content-type must match the *source* extension rather than a convert
# target. Covers everything the loaders can read, including formats with no
# ENCODE_TARGETS/MEDIA_TYPES entry (gif, bmp) and both tiff spellings.
MEDIA_TYPE_BY_EXT: dict[str, str] = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif",
    ".tif": "image/tiff", ".tiff": "image/tiff", ".bmp": "image/bmp",
}

# Metadata field-name prefixes we drop on save (everything a source can carry
# that could leak GPS/camera/timestamps or crafted payloads). The ICC profile
# is deliberately kept for colour fidelity.
_STRIP_PREFIXES = ("exif-", "xmp", "iptc", "ipct", "photoshop", "png-comment", "gif-comment")


class ImageError(Exception):
    """A user-facing imaging failure (bad image, unsupported operation)."""


class TooManyPixelsError(ImageError):
    """The image exceeds the configured megapixel ceiling."""


def load(src: Path) -> pyvips.Image:
    """Open an image for streaming processing.

    Applies EXIF orientation into the pixels (so nothing downstream has to think
    about rotation) and rejects images whose pixel count exceeds the configured
    ceiling — a cheap, header-only guard against decompression bombs.
    """
    try:
        image = pyvips.Image.new_from_file(str(src), access="sequential")
    except pyvips.Error as exc:  # unreadable / unsupported / corrupt
        raise ImageError("The image could not be read.") from exc

    megapixels = (image.width * image.height) / 1_000_000
    if megapixels > settings.max_image_megapixels:
        raise TooManyPixelsError(
            f"Image is too large to process ({megapixels:.0f} MP; "
            f"limit is {settings.max_image_megapixels} MP)."
        )
    return image.autorot()


def _stamp_and_strip(image: pyvips.Image) -> pyvips.Image:
    """Return a copy with inherited metadata removed and our attribution set."""
    image = image.copy()
    for field in image.get_fields():
        if field.startswith(_STRIP_PREFIXES):
            image.remove(field)
    # ATTRIBUTION intentionally avoids a trailing "(...)" — libvips' ASCII-tag
    # writer (drop_tail() in libvips/foreign/exif.c) strips a trailing
    # " (...)" from any value ending in ")", assuming it's the annotation
    # libvips itself appends when *displaying* an EXIF string via get().
    image.set_type(pyvips.GValue.gstr_type, "exif-ifd0-Software", ATTRIBUTION)
    image.set_type(pyvips.GValue.blob_type, "xmp-data", _XMP_PACKET)
    return image


def save(image: pyvips.Image, dst: Path, *, quality: int | None = None) -> None:
    """Write `image` to `dst`, choosing the encoder from the extension.

    Keeps only EXIF, XMP, and the ICC profile (our attribution rides in EXIF +
    XMP); everything else is stripped by `_stamp_and_strip` beforehand.

    Note: on libvips 8.18.4, `tiffsave` drops the custom `exif-ifd0-Software`
    tag even with `keep=EXIF` — TIFF output carries attribution via XMP only.
    This is accepted behavior (see test_tiff_attribution_in_xmp_only).
    """
    image = _stamp_and_strip(image)
    keep = pyvips.ForeignKeep.EXIF | pyvips.ForeignKeep.XMP | pyvips.ForeignKeep.ICC

    opts: dict[str, object] = {"keep": keep}
    suffix = dst.suffix.lower()
    if quality is not None and suffix in (".jpg", ".jpeg", ".webp", ".avif", ".heic", ".heif"):
        opts["Q"] = quality
    if suffix == ".png" and quality is not None:
        # For PNG, "quality" means lossy palette quantisation.
        opts["palette"] = True
        opts["Q"] = quality
    try:
        image.write_to_file(str(dst), **opts)
    except pyvips.Error as exc:
        raise ImageError("The image could not be written.") from exc
