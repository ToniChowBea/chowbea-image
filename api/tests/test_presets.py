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
    body = one.json()
    assert body["no_password"] is True
    assert body["h1"] == "Compress PDF for UCAS (5MB limit)"
    assert "5MB" in body["seo_title"]
    assert body["faq"]
    assert client.get("/presets/not-a-real-preset").status_code == 404


def test_portal_verification_matches_official_sources():
    ukvcas = get_preset("ukvcas")
    vfs = get_preset("vfs-global")
    nhs = get_preset("nhs-jobs")
    ucas = get_preset("ucas-documents")
    saas = get_preset("saas-documents")
    assert ukvcas is not None and ukvcas.verified is True
    assert ukvcas.max_bytes == 6 * 1024 * 1024
    assert "prepareDocuments" in (ukvcas.source_url or "")
    assert vfs is not None and vfs.verified is False
    assert vfs.max_bytes == 2 * 1024 * 1024
    assert nhs is not None and nhs.verified is True
    assert nhs.max_bytes == 1024 * 1024
    assert ucas is not None
    assert set(ucas.accepted_types) == {"pdf", "jpeg", "odt"}
    assert saas is not None and "edocs.saas.gov.uk" in (saas.source_url or "")


def test_every_preset_has_seo_copy():
    from app.services.presets import public_list

    for item in public_list():
        assert item.h1
        assert item.seo_title
        assert item.seo_description
        assert item.faq
