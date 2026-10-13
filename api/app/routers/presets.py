"""Public preset catalogue for the /fix/[preset] page."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.presets import PresetList, PresetPublic, public_list, public_one

router = APIRouter(prefix="/presets", tags=["presets"])


@router.get("", summary="List upload-limit presets", response_model=PresetList)
def list_presets() -> PresetList:
    """Return every bundled portal and generic size target."""
    return PresetList(presets=public_list())


@router.get("/{preset_id}", summary="Get one upload-limit preset", response_model=PresetPublic)
def get_one_preset(preset_id: str) -> PresetPublic:
    """Look up a preset by id; 404 if it is not in the catalogue."""
    preset = public_one(preset_id)
    if preset is None:
        raise HTTPException(status_code=404, detail="Unknown preset.")
    return preset
