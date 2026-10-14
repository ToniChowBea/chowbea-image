"""Convert Word/OpenDocument files to PDF with LibreOffice headless.

The worker image installs `libreoffice-writer`. Locally: `sudo apt-get install
libreoffice-writer` (Debian/Ubuntu) or `brew install --cask libreoffice` (macOS).
Never logs file bytes, names, or soffice stdout.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


class OfficeError(Exception):
    """A user-facing Word/OpenDocument conversion failure."""


def libreoffice_binary() -> str | None:
    """Path of `soffice` or `libreoffice`, or None when neither is installed."""
    return shutil.which("soffice") or shutil.which("libreoffice")


def libreoffice_available() -> bool:
    """True when a LibreOffice binary is on PATH (worker image or local install)."""
    return libreoffice_binary() is not None


def convert_office_to_pdf(src: Path, dest: Path) -> None:
    """Write a PDF conversion of `src` (DOC/DOCX/ODT) to `dest`.

    Uses a throwaway HOME so soffice does not need a real user profile.
    """
    binary = libreoffice_binary()
    if binary is None:
        raise OfficeError(
            "Word conversion is unavailable on this server. Export to PDF and try again."
        )
    work = Path(tempfile.mkdtemp(prefix="chowbea-lo-"))
    try:
        env = {
            **os.environ,
            "HOME": str(work),
            "SAL_USE_VCLPLUGIN": "svp",
        }
        cmd = [
            binary,
            "--headless",
            "--norestore",
            "--nolockcheck",
            "--convert-to",
            "pdf",
            "--outdir",
            str(work),
            str(src),
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=120, check=False, env=env)
        except subprocess.TimeoutExpired as exc:
            raise OfficeError("Word conversion timed out.") from exc
        produced = sorted(work.glob("*.pdf"))
        if proc.returncode != 0 or not produced or produced[0].stat().st_size == 0:
            logger.warning("LibreOffice convert-to pdf failed (exit %s)", proc.returncode)
            raise OfficeError("The Word document could not be converted to PDF.")
        dest.write_bytes(produced[0].read_bytes())
    finally:
        shutil.rmtree(work, ignore_errors=True)
