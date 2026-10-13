"""PostHog capture is a no-op without a key and never includes filenames."""

import json

from app.core.config import Settings
from app.services import analytics


def test_capture_does_nothing_without_key(monkeypatch):
    monkeypatch.delenv("POSTHOG_API_KEY", raising=False)
    monkeypatch.setattr(analytics, "settings", Settings())
    called = []
    monkeypatch.setattr(analytics.threading, "Thread", lambda **_kwargs: called.append("thread"))
    analytics.capture("fix_started", {"preset": "ucas-documents", "filename": "secret.pdf"})
    assert called == []


def test_capture_strips_filename_and_posts(monkeypatch):
    monkeypatch.setenv("POSTHOG_API_KEY", "phc_test")
    monkeypatch.setenv("POSTHOG_HOST", "https://example.test")
    monkeypatch.setattr(analytics, "settings", Settings())

    sent: dict = {}

    class _Resp:
        def read(self, _n: int) -> bytes:
            return b"{}"

        def __enter__(self):
            return self

        def __exit__(self, *_args) -> None:
            return None

    def fake_urlopen(request, timeout=2):
        sent["url"] = request.full_url
        sent["body"] = json.loads(request.data.decode("utf-8"))
        return _Resp()

    monkeypatch.setattr(analytics.urllib.request, "urlopen", fake_urlopen)

    class ImmediateThread:
        def __init__(self, target, daemon=True):
            self._target = target

        def start(self) -> None:
            self._target()

    monkeypatch.setattr(analytics.threading, "Thread", ImmediateThread)
    analytics.capture("fix_succeeded", {"preset": "ukvcas", "filename": "nope.pdf", "file_type": "pdf"})
    assert sent["url"] == "https://example.test/capture/"
    assert sent["body"]["event"] == "fix_succeeded"
    assert sent["body"]["properties"]["preset"] == "ukvcas"
    assert sent["body"]["properties"]["file_type"] == "pdf"
    assert "filename" not in sent["body"]["properties"]
    assert sent["body"]["distinct_id"] == "anonymous"
