"""Bundled portal presets load with the fields the fix job depends on."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import presets as presets_router
from app.services.presets import all_presets, get_preset, load_presets

# Categories listed on /portals. Generic size targets are not UK portals.
_PORTAL_CATEGORIES = {
    "immigration",
    "tax-government",
    "jobs",
    "education",
    "housing",
    "health",
}


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
        "ukvi-evidence",
        "eu-settlement",
        "student-visa-cas",
        "dvla-photo",
        "hmrc-compliance",
        "hmrc-cds",
        "student-finance-england",
        "trac-jobs",
        "civil-service-jobs",
        "universal-credit",
        "council-housing-benefits",
        "land-registry",
        "companies-house",
        "ofsted",
        "sra",
        "gmc",
        "nmc",
        "dbs",
        "indeed-cv",
        "linkedin-cv",
        "rightmove",
        "openrent",
        "hmcts-efiling",
        "pip-evidence",
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


def test_no_duplicate_preset_slugs():
    ids = [preset.id for preset in all_presets()]
    assert ids, "catalogue must not be empty"
    assert len(ids) == len(set(ids))


def test_every_preset_has_a_limit_and_types():
    for preset in all_presets():
        assert preset.max_bytes and preset.max_bytes > 0, preset.id
        assert preset.accepted_types, preset.id
        assert preset.category in _PORTAL_CATEGORIES | {"generic"}, preset.id


def test_portal_presets_have_sources():
    portals = [preset for preset in all_presets() if preset.category != "generic"]
    assert len(portals) >= 27
    for preset in portals:
        assert preset.source_url, preset.id
        assert preset.source_url.startswith("https://"), preset.id
        assert preset.category in _PORTAL_CATEGORIES, preset.id
        assert preset.notes, preset.id
        if not preset.verified:
            assert "commonly reported" in (preset.notes or "").lower(), preset.id


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
    assert "eu-settlement" in ids
    one = client.get("/presets/ucas-documents")
    assert one.status_code == 200
    body = one.json()
    assert body["no_password"] is True
    assert body["h1"] == "Compress PDF for UCAS (5MB limit)"
    assert "5MB" in body["seo_title"]
    assert body["faq"]
    assert body["category"] == "education"
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

    eu = get_preset("eu-settlement")
    assert eu is not None and eu.verified is True
    assert eu.max_bytes == 6 * 1024 * 1024

    sfe = get_preset("student-finance-england")
    assert sfe is not None and sfe.verified is True
    assert sfe.max_bytes == 16 * 1024 * 1024

    hmrc = get_preset("hmrc-compliance")
    assert hmrc is not None and hmrc.verified is True
    assert hmrc.max_bytes == 15 * 1024 * 1024

    cds = get_preset("hmrc-cds")
    assert cds is not None and cds.verified is True
    assert cds.max_bytes == 10 * 1024 * 1024

    ch = get_preset("companies-house")
    assert ch is not None and ch.verified is True
    assert ch.max_bytes == 4 * 1024 * 1024
    assert ch.accepted_types == ["pdf"]

    lr = get_preset("land-registry")
    assert lr is not None and lr.verified is True
    assert lr.max_bytes == 40 * 1024 * 1024

    dbs = get_preset("dbs")
    assert dbs is not None and dbs.verified is True
    assert dbs.max_bytes == 10 * 1024 * 1024

    hmcts = get_preset("hmcts-efiling")
    assert hmcts is not None and hmcts.verified is True
    assert hmcts.max_bytes == 50 * 1024 * 1024

    linkedin = get_preset("linkedin-cv")
    assert linkedin is not None and linkedin.verified is True
    assert linkedin.max_bytes == 2 * 1024 * 1024


def test_unverified_presets_are_labelled_commonly_reported():
    ukvi = get_preset("ukvi-evidence")
    assert ukvi is not None and ukvi.verified is False
    assert ukvi.max_bytes == 6 * 1024 * 1024
    assert "commonly reported" in (ukvi.notes or "").lower()


def test_every_preset_has_seo_copy():
    from app.services.presets import public_list

    for item in public_list():
        assert item.h1
        assert item.seo_title
        assert item.seo_description
        assert item.faq
        if item.category != "generic" and not item.verified:
            assert any("official" in row.q.lower() for row in item.faq)
