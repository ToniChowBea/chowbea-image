from app.core.config import Settings


def test_defaults():
    s = Settings()
    assert s.app_name == "Chowbea Image API"
    assert s.max_upload_mb == 100
    assert s.max_image_megapixels == 300
    assert s.result_ttl_minutes == 30
    assert s.job_concurrency == 3
    assert s.commit_sha == "dev"


def test_cors_origin_list_splits_and_strips():
    s = Settings(cors_origins="http://a.com, http://b.com ,")
    assert s.cors_origin_list == ["http://a.com", "http://b.com"]
