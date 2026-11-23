"""Unit tests for preset SEO copy: size labels, fallbacks and FAQ rules."""

from app.services.preset_seo import _COPY, _limit_label, _portal_faq, resolve_seo
from app.services.presets import Preset, load_presets


def _preset(**overrides) -> Preset:
    """A minimal preset with no curated copy, so fallbacks are exercised."""
    data = {
        "id": "test-portal-not-in-copy",
        "name": "Test Portal",
        "accepted_types": ["jpeg", "pdf"],
        "max_bytes": 2 * 1024 * 1024,
        "verified": True,
    }
    data.update(overrides)
    return Preset.model_validate(data)


def test_limit_label_formats_whole_units():
    assert _limit_label(None) == ""
    assert _limit_label(5 * 1024 * 1024) == "5MB"
    assert _limit_label(500 * 1024) == "500KB"
    # 1.5MB is not a whole MB, so it falls back to KB.
    assert _limit_label(1536 * 1024) == "1536KB"
    assert _limit_label(1000) == "1000B"


def test_every_curated_copy_key_is_a_real_preset():
    # Catches copy left behind after a preset id is renamed or removed.
    assert set(_COPY) <= set(load_presets())


def test_resolve_seo_falls_back_for_uncurated_preset():
    seo = resolve_seo(_preset())
    assert seo["h1"] == "Fix a file for Test Portal (2MB limit)"
    assert seo["seo_title"] == "Fix a file for Test Portal (2MB limit) | Chowbea Image"
    assert "Test Portal" in str(seo["seo_description"])


def test_fallback_h1_omits_limit_when_preset_has_no_cap():
    assert resolve_seo(_preset(max_bytes=None))["h1"] == "Fix a file for Test Portal"


def test_portal_faq_lists_types_and_limit():
    first = _portal_faq(_preset())[0]
    assert first["q"] == "What does Test Portal accept?"
    assert first["a"].startswith("JPG, PDF. Maximum 2MB.")


def test_official_limit_question_only_for_unverified_presets():
    def asks_official(preset: Preset) -> bool:
        return any("official" in row["q"].lower() for row in _portal_faq(preset))

    assert not asks_official(_preset(verified=True))
    assert asks_official(_preset(verified=False))


def test_portal_faq_is_capped_at_five_questions():
    faq = _portal_faq(_preset(verified=False, no_password=True, do_not_crop=True))
    assert len(faq) == 5
    assert any("password" in row["q"].lower() for row in faq)
    assert any("crop" in row["q"].lower() for row in faq)
