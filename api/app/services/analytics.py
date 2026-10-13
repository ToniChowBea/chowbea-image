"""Optional PostHog capture. Off when POSTHOG_API_KEY is missing.

Never sends file names, file bytes, or job payloads — only preset id, file
type, counts, and pass/fail. Failures are swallowed so analytics cannot break
a job.
"""

from __future__ import annotations

import json
import logging
import threading
import urllib.error
import urllib.request
from typing import Mapping

from app.core.config import settings

logger = logging.getLogger(__name__)


def capture(event: str, properties: Mapping[str, str | int | bool | None] | None = None) -> None:
    """Fire-and-forget a PostHog event when a project key is configured."""
    key = settings.posthog_api_key.strip()
    if not key:
        return
    host = (settings.posthog_host or "https://us.i.posthog.com").rstrip("/")
    clean = {
        name: value
        for name, value in (properties or {}).items()
        if value is not None and name not in {"filename", "name", "path", "bytes"}
    }
    payload = {
        "api_key": key,
        "event": event,
        "distinct_id": "anonymous",
        "properties": {**clean, "$process_person_profile": False},
    }
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{host}/capture/",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    def _send() -> None:
        try:
            with urllib.request.urlopen(request, timeout=2) as response:
                response.read(64)
        except (urllib.error.URLError, TimeoutError, OSError):
            logger.warning("PostHog capture skipped")

    threading.Thread(target=_send, daemon=True).start()
