"""Application configuration loaded from the environment."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the API.

    Values are read from environment variables (and a local .env file when present),
    so the same image can be configured differently per deployment.
    """

    app_name: str = "Chowbea Image API"
    app_version: str = "0.1.0"

    # Origins allowed to call the API from a browser. Comma-separated in the env var.
    cors_origins: str = "http://localhost:3000"

    # Reject uploads larger than this (in megabytes) to protect the server.
    max_upload_mb: int = 100

    # Reject images whose pixel count (w*h) exceeds this many megapixels; a cheap,
    # header-only guard against decompression bombs.
    max_image_megapixels: int = 300

    # AMQP URL of the RabbitMQ broker that carries the job queue.
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"

    # Finished job results are kept this long before being swept from disk.
    result_ttl_minutes: int = 30

    # How many jobs may be processed at the same time (RabbitMQ prefetch count).
    job_concurrency: int = 3

    # Git SHA of the running deploy; Railway injects this on git-connected deploys.
    commit_sha: str = Field(default="dev", validation_alias="RAILWAY_GIT_COMMIT_SHA")

    # Directory for small durable state (the jobs counter); a Railway volume is
    # mounted here in production so the data survives redeploys.
    data_dir: str = "./data"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="CHOWBEA_")

    @property
    def cors_origin_list(self) -> list[str]:
        """Return the configured CORS origins as a clean list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


# A single shared settings instance for the whole app.
settings = Settings()
