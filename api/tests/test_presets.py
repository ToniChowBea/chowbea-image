"""Bundled portal presets load with the fields the fix job depends on."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import presets as presets_router
from app.services.presets import get_preset, load_presets


def test_seeded_presets_are_present():
    loaded = load_presets()
    expected = {
        "uk-passport-online",
        "uk-visa-face",
        "ucas-documents",
        "saas-documents",
        "ukvcas",
        "vfs-global",
        "nhs-jobs",
        "jpg-100kb",
        "jpg-200kb",
        "jpg-500kb",
        "jpg-1mb",
        "jpg-2mb",
        "pdf-100kb",
        "pdf-200kb",
        "pdf-500kb",
        "pdf-1mb",
        "pdf-2mb",
    }
    assert expected <= set(loaded)


def test_passport_preset_matches_govuk():
    preset = get_preset("uk-passport-online")
    assert preset is not None
    assert preset.min_bytes == 50 * 1024
    assert preset.max_bytes == 10 * 1024 * 1024
    assert preset.min_width == 600
    assert preset.min_height == 750
    assert preset.colour is True
    assert preset.do_not_crop is True
    assert preset.verified is True
    assert preset.target_bytes == int(preset.max_bytes * 0.9)


def test_presets_http_list_and_get():
    app = FastAPI()
    app.include_router(presets_router.router)
    client = TestClient(app)
    listing = client.get("/presets")
    assert listing.status_code == 200
    ids = {item["id"] for item in listing.json()["presets"]}
    assert "uk-visa-face" in ids
    one = client.get("/presets/ucas-documents")
    assert one.status_code == 200
    assert one.json()["no_password"] is True
    assert client.get("/presets/not-a-real-preset").status_code == 404
