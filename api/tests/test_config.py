from app.core.config import Settings


def test_defaults():
    s = Settings()
    assert s.app_name == "Chowbea Image API"
    assert s.max_upload_mb == 100
    assert s.max_image_megapixels == 300
    assert s.result_ttl_minutes == 60
    assert s.job_concurrency == 3
    assert s.commit_sha == "dev"


def test_cors_origin_list_splits_and_strips():
    s = Settings(cors_origins="http://a.com, http://b.com ,")
    assert s.cors_origin_list == ["http://a.com", "http://b.com"]


def test_paywall_off_by_default():
    s = Settings()
    assert s.paywall_enabled is False
    assert s.stripe_secret_key == ""


def test_stripe_keys_from_unprefixed_env(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_abc")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_abc")
    monkeypatch.setenv("STRIPE_PRICE_BATCH", "price_batch")
    monkeypatch.setenv("STRIPE_PRICE_PASS", "price_pass")
    monkeypatch.setenv("PUBLIC_WEB_URL", "https://example.test")
    s = Settings()
    assert s.stripe_secret_key == "sk_test_abc"
    assert s.public_web_url == "https://example.test"
    assert s.paywall_enabled is True
    assert s.token_signing_secret == "whsec_abc"
