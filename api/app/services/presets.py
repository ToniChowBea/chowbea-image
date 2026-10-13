"""Load and look up upload-limit presets from the bundled YAML file."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, field_validator

# Bundled next to this package so Docker's `COPY app` picks it up.
_PRESETS_PATH = Path(__file__).resolve().parent.parent / "presets.yaml"

# Canonical type names used in YAML and throughout the fix pipeline.
Orientation = Literal["portrait", "landscape", "any"]

# Map aliases so "jpg" in YAML or user input still matches "jpeg".
_TYPE_ALIASES = {"jpg": "jpeg", "tif": "tiff"}


def normalize_type(value: str) -> str:
    """Return the canonical type name for a YAML/extension string."""
    key = value.strip().lower().lstrip(".")
    return _TYPE_ALIASES.get(key, key)


class Preset(BaseModel):
    """One portal or generic size target the fix job can aim for."""

    id: str
    name: str
    accepted_types: list[str]
    min_bytes: int | None = None
    max_bytes: int | None = None
    min_width: int | None = None
    min_height: int | None = None
    orientation: Orientation = "any"
    colour: bool = False
    do_not_crop: bool = False
    no_password: bool = False
    preferred_type: str | None = None
    source_url: str | None = None
    last_checked: str | None = None
    verified: bool = False
    notes: str | None = None

    @field_validator("accepted_types")
    @classmethod
    def _normalize_types(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("accepted_types must not be empty")
        return [normalize_type(item) for item in value]

    @field_validator("preferred_type")
    @classmethod
    def _normalize_preferred(cls, value: str | None) -> str | None:
        return None if value is None else normalize_type(value)

    @property
    def target_bytes(self) -> int | None:
        """Encode target: ~10% under the portal max, when a max exists."""
        if self.max_bytes is None:
            return None
        return max(1, int(self.max_bytes * 0.9))


class FaqItem(BaseModel):
    """One question on a preset's SEO FAQ."""

    q: str
    a: str


class PresetPublic(BaseModel):
    """Preset fields the web page needs — no internal encode-target math."""

    id: str
    name: str
    accepted_types: list[str]
    min_bytes: int | None = None
    max_bytes: int | None = None
    min_width: int | None = None
    min_height: int | None = None
    orientation: Orientation
    colour: bool
    do_not_crop: bool
    no_password: bool
    preferred_type: str | None = None
    source_url: str | None = None
    last_checked: str | None = None
    verified: bool
    notes: str | None = None
    h1: str
    seo_title: str
    seo_description: str
    faq: list[FaqItem]


class PresetList(BaseModel):
    """Envelope for GET /presets."""

    presets: list[PresetPublic]


def _to_public(preset: Preset) -> PresetPublic:
    """Project a loaded preset to the API-facing shape, with resolved SEO copy."""
    from app.services.preset_seo import resolve_seo

    data = preset.model_dump()
    data.update(resolve_seo(preset))
    return PresetPublic.model_validate(data)


@lru_cache(maxsize=1)
def load_presets() -> dict[str, Preset]:
    """Read presets.yaml once per process. Never logs file contents."""
    raw = yaml.safe_load(_PRESETS_PATH.read_text(encoding="utf-8"))
    items = raw.get("presets") if isinstance(raw, dict) else None
    if not isinstance(items, list):
        raise RuntimeError("presets.yaml is missing a 'presets' list.")
    loaded: dict[str, Preset] = {}
    for item in items:
        preset = Preset.model_validate(item)
        loaded[preset.id] = preset
    return loaded


def get_preset(preset_id: str) -> Preset | None:
    """Look up one preset by id, or None if it is unknown."""
    return load_presets().get(preset_id)


def all_presets() -> list[Preset]:
    """Return presets in YAML order."""
    return list(load_presets().values())


def public_list() -> list[PresetPublic]:
    """All presets in the shape the web page consumes."""
    return [_to_public(preset) for preset in all_presets()]


def public_one(preset_id: str) -> PresetPublic | None:
    """One public preset, or None if the id is unknown."""
    preset = get_preset(preset_id)
    return None if preset is None else _to_public(preset)
