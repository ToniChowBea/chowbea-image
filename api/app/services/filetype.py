"""Detect real file types from magic bytes, never from the filename alone.

Used at upload intake so a renamed extension cannot sneak past the decoder
guards. Never logs file bytes or names.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

# Canonical kind -> stored extension. Worker paths are input-{i}{ext}.
KIND_TO_EXT: dict[str, str] = {
    "png": ".png",
    "jpeg": ".jpg",
    "webp": ".webp",
    "avif": ".avif",
    "heif": ".heic",
    "gif": ".gif",
    "tiff": ".tiff",
    "bmp": ".bmp",
    "pdf": ".pdf",
    "doc": ".doc",
    "docx": ".docx",
    "odt": ".odt",
}

# ISO-BMFF brands inside the ftyp box (offset 8).
_HEIF_BRANDS = {b"heic", b"heix", b"heif", b"hevc", b"mif1", b"msf1", b"heim", b"heis"}
_AVIF_BRANDS = {b"avif", b"avis", b"avio"}

# OLE Compound File used by legacy .doc (and other Office 97 binaries).
_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def detect_kind(head: bytes) -> str | None:
    """Return a canonical kind from the start of a file, or None if unknown."""
    if not head:
        return None
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if head.startswith(b"GIF87a") or head.startswith(b"GIF89a"):
        return "gif"
    if head.startswith(b"II*\x00") or head.startswith(b"MM\x00*"):
        return "tiff"
    if head.startswith(b"BM"):
        return "bmp"
    if head.startswith(b"%PDF"):
        return "pdf"
    if head.startswith(_OLE_MAGIC):
        return "doc"
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    if len(head) >= 12 and head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in _AVIF_BRANDS:
            return "avif"
        if brand in _HEIF_BRANDS:
            return "heif"
        # Compatible brands follow; scan a little further when we have them.
        rest = head[16:64]
        if any(tag in rest for tag in _AVIF_BRANDS):
            return "avif"
        if any(tag in rest for tag in _HEIF_BRANDS):
            return "heif"
        return "heif"
    if head.startswith(b"PK"):
        return "zip"
    return None


def refine_office_zip(path: Path) -> str | None:
    """Distinguish DOCX vs ODT from a ZIP container. None if it is neither."""
    try:
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
            if "word/document.xml" in names or any(name.startswith("word/") for name in names):
                return "docx"
            if "mimetype" in names:
                mime = archive.read("mimetype").decode("utf-8", errors="ignore")
                if "opendocument.text" in mime:
                    return "odt"
            if any(name.startswith("content.xml") or name == "content.xml" for name in names):
                return "odt"
    except (OSError, zipfile.BadZipFile):
        return None
    return None


def kind_extension(kind: str) -> str:
    """Stored suffix for a detected kind, including the leading dot."""
    ext = KIND_TO_EXT.get(kind)
    if ext is None:
        raise ValueError(f"Unknown kind '{kind}'")
    return ext
