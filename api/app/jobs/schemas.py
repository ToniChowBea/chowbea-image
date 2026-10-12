"""Response models for job submission, status polling, and the queue board."""

from __future__ import annotations

from pydantic import BaseModel

from app.jobs.registry import JobStatus


class JobAccepted(BaseModel):
    job_id: str
    position: int | None
    queue_size: int


class RuleCheck(BaseModel):
    """One preset rule compared against the actual output."""

    id: str
    label: str
    passed: bool
    actual: str
    expected: str


class FileReport(BaseModel):
    """Pass/fail for every rule on one output file."""

    filename: str
    passed: bool
    rules: list[RuleCheck]


class FixReport(BaseModel):
    """Whole-job report returned on GET /jobs/{id} for tool=fix."""

    preset_id: str
    preset_name: str
    passed: bool
    files: list[FileReport]
    # True when the job also merged every file into one PDF evidence pack.
    merged: bool = False


class JobStatusResponse(BaseModel):
    id: str
    tool: str
    status: JobStatus
    position: int | None
    queue_size: int
    error: str | None
    file_count: int
    total_bytes: int
    created_at: float
    report: FixReport | None = None


class BoardEntry(BaseModel):
    """Anonymized public view of one job. Never includes filenames."""

    id_prefix: str
    tool: str
    file_count: int
    total_bytes: int
    created_at: float


class QueueBoard(BaseModel):
    concurrency: int
    jobs_completed: int
    processing: list[BoardEntry]
    waiting: list[BoardEntry]
