"""Search-intent titles, descriptions, and FAQs for each upload-fixer preset."""

from __future__ import annotations

from app.services.presets import Preset


def _limit_label(max_bytes: int | None) -> str:
    """Short size string for titles, e.g. '5MB' or '500KB'."""
    if max_bytes is None:
        return ""
    if max_bytes >= 1024 * 1024 and max_bytes % (1024 * 1024) == 0:
        return f"{max_bytes // (1024 * 1024)}MB"
    if max_bytes >= 1024 and max_bytes % 1024 == 0:
        return f"{max_bytes // 1024}KB"
    return f"{max_bytes}B"


def _privacy_faq() -> list[dict[str, str]]:
    """Shared privacy answers so every preset page says the same thing."""
    return [
        {
            "q": "Do you keep my file?",
            "a": "No. Files are deleted 1 hour after processing. We never log file contents, only generic errors.",
        },
        {
            "q": "Is a single file free?",
            "a": "Yes. Fixing one file is free. An evidence pack (several files, optionally merged to one PDF) is a paid one-off when payments are configured.",
        },
    ]


# Curated H1 / title / description keyed by preset id (search intent).
_COPY: dict[str, dict[str, str]] = {
    "uk-passport-online": {
        "h1": "Resize a UK passport photo for GOV.UK (10MB limit)",
        "title": "UK passport photo resizer (GOV.UK 50KB–10MB) | Chowbea",
        "description": "Convert HEIC to JPEG, meet GOV.UK's 600×750 minimum, and stay between 50KB and 10MB. We do not crop — GOV.UK crops for you. Files deleted after 1 hour.",
    },
    "uk-visa-face": {
        "h1": "Resize a UK visa photo to JPEG (6MB limit)",
        "title": "UK visa photo to JPEG (50KB–6MB, portrait) | Chowbea",
        "description": "Turn a phone photo into a colour JPEG for a UK visa application: 50KB–6MB, at least 600×750, portrait. No crop. Files deleted after 1 hour.",
    },
    "ucas-documents": {
        "h1": "Compress PDF for UCAS (5MB limit)",
        "title": "Compress PDF for UCAS (5MB upload limit) | Chowbea",
        "description": "Shrink a transcript or reference to UCAS's 5MB limit. Password-protected PDFs are rejected. Single files are free; evidence packs are a one-off payment.",
    },
    "saas-documents": {
        "h1": "Compress documents for SAAS (5MB limit)",
        "title": "Compress JPG, TIFF or PDF for SAAS (5MB) | Chowbea",
        "description": "Fit Student Awards Agency Scotland uploads under 5MB. JPG, TIFF or PDF. Files deleted 1 hour after processing.",
    },
    "ukvcas": {
        "h1": "Compress files for UKVCAS (6MB limit)",
        "title": "Compress PDF or photos for UKVCAS (6MB) | Chowbea",
        "description": "Get a PDF, JPG or PNG under UKVCAS's 6MB upload limit. Unverified limit — check the portal. Files deleted after 1 hour.",
    },
    "vfs-global": {
        "h1": "Compress files for VFS Global (2MB limit)",
        "title": "Compress PDF or photos for VFS Global (2MB) | Chowbea",
        "description": "Shrink a PDF, JPG or PNG to VFS Global's 2MB limit. Unverified limit — check the portal. Files deleted after 1 hour.",
    },
    "nhs-jobs": {
        "h1": "Compress a CV for NHS Jobs (1MB limit)",
        "title": "Compress PDF or Word for NHS Jobs (1MB) | Chowbea",
        "description": "Fit a CV or supporting statement under NHS Jobs' 1MB limit. Word files over the limit should be exported to PDF first.",
    },
    "jpg-100kb": {
        "h1": "Compress a JPG to under 100 KB",
        "title": "Compress JPG to 100 KB | Chowbea Image",
        "description": "Shrink a JPEG to under 100 KB for tight portal limits. No account. Files deleted after 1 hour.",
    },
    "jpg-200kb": {
        "h1": "Compress a JPG to under 200 KB",
        "title": "Compress JPG to 200 KB | Chowbea Image",
        "description": "Shrink a JPEG to under 200 KB. No account. Files deleted after 1 hour.",
    },
    "jpg-500kb": {
        "h1": "Compress a JPG to under 500 KB",
        "title": "Compress JPG to 500 KB | Chowbea Image",
        "description": "Shrink a JPEG to under 500 KB. No account. Files deleted after 1 hour.",
    },
    "jpg-1mb": {
        "h1": "Compress a JPG to under 1 MB",
        "title": "Compress JPG to 1 MB | Chowbea Image",
        "description": "Shrink a JPEG to under 1 MB for portal uploads. No account. Files deleted after 1 hour.",
    },
    "jpg-2mb": {
        "h1": "Compress a JPG to under 2 MB",
        "title": "Compress JPG to 2 MB | Chowbea Image",
        "description": "Shrink a JPEG to under 2 MB. No account. Files deleted after 1 hour.",
    },
    "pdf-100kb": {
        "h1": "Compress a PDF to under 100 KB",
        "title": "Compress PDF to 100 KB | Chowbea Image",
        "description": "Distill a PDF to under 100 KB with Ghostscript. Password-protected files are rejected. Files deleted after 1 hour.",
    },
    "pdf-200kb": {
        "h1": "Compress a PDF to under 200 KB",
        "title": "Compress PDF to 200 KB | Chowbea Image",
        "description": "Distill a PDF to under 200 KB. Files deleted after 1 hour.",
    },
    "pdf-500kb": {
        "h1": "Compress a PDF to under 500 KB",
        "title": "Compress PDF to 500 KB | Chowbea Image",
        "description": "Distill a PDF to under 500 KB. Files deleted after 1 hour.",
    },
    "pdf-1mb": {
        "h1": "Compress a PDF to under 1 MB",
        "title": "Compress PDF to 1 MB | Chowbea Image",
        "description": "Distill a PDF to under 1 MB for portal uploads. Files deleted after 1 hour.",
    },
    "pdf-2mb": {
        "h1": "Compress a PDF to under 2 MB",
        "title": "Compress PDF to 2 MB | Chowbea Image",
        "description": "Distill a PDF to under 2 MB. Files deleted after 1 hour.",
    },
}


def _fallback_h1(preset: Preset) -> str:
    """Generic H1 when a preset has no curated copy."""
    limit = _limit_label(preset.max_bytes)
    suffix = f" ({limit} limit)" if limit else ""
    return f"Fix a file for {preset.name}{suffix}"


def _portal_faq(preset: Preset) -> list[dict[str, str]]:
    """Two or three questions that match this preset's rules."""
    limit = _limit_label(preset.max_bytes) or "the portal"
    types = ", ".join("JPG" if t == "jpeg" else t.upper() for t in preset.accepted_types)
    questions = [
        {
            "q": f"What does {preset.name} accept?",
            "a": f"{types}. Maximum {limit}. This tool only fixes format, size and pixels — it does not check faces, backgrounds or content.",
        }
    ]
    if preset.no_password:
        questions.append(
            {
                "q": "Can I upload a password-protected PDF?",
                "a": "No. Unlock the PDF first. Portals such as UCAS reject password-protected files.",
            }
        )
    if preset.do_not_crop:
        questions.append(
            {
                "q": "Will you crop my photo?",
                "a": "No. We keep the aspect ratio. GOV.UK crops the photo on their side.",
            }
        )
    questions.extend(_privacy_faq())
    return questions[:4]


def resolve_seo(preset: Preset) -> dict[str, object]:
    """H1, title, description and FAQ the API (and web JSON-LD) expose."""
    copy = _COPY.get(preset.id, {})
    h1 = copy.get("h1") or _fallback_h1(preset)
    title = copy.get("title") or f"{h1} | Chowbea Image"
    description = copy.get("description") or (
        f"Convert, resize and compress a file to {preset.name} rules. "
        "No account. Files deleted 1 hour after processing."
    )
    return {
        "h1": h1,
        "seo_title": title,
        "seo_description": description,
        "faq": _portal_faq(preset),
    }
