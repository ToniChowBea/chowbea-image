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

    # Reject requests with more than this many files, to bound disk writes per request.
    max_files_per_request: int = 100

    # Fixer packs: tighter caps than the general image tools.
    fix_max_files: int = 20
    fix_max_upload_mb: int = 50

    # Per-IP cap on free /img/fix submissions (sliding window, one minute).
    fix_free_rate_per_minute: int = 10

    # When True, consume RabbitMQ jobs in this process. Set false on an HTTP-only replica.
    run_worker: bool = True

    # Trust X-Forwarded-For (Railway / compose reverse proxy). Off locally so clients cannot spoof.
    trust_forwarded_ip: bool = False

    # Reject images whose pixel count (w*h) exceeds this many megapixels; a cheap,
    # header-only guard against decompression bombs.
    max_image_megapixels: int = 300

    # AMQP URL of the RabbitMQ broker that carries the job queue.
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"

    # Finished job results (and abandoned uploads) are kept this long before
    # being swept from disk. One hour matches the fix-tool privacy promise.
    result_ttl_minutes: int = 60

    # How many jobs may be processed at the same time (RabbitMQ prefetch count).
    job_concurrency: int = 3

    # Git SHA of the running deploy; Railway injects this on git-connected deploys.
    commit_sha: str = Field(default="dev", validation_alias="RAILWAY_GIT_COMMIT_SHA")

    # Directory for small durable state (the jobs counter); a Railway volume is
    # mounted here in production so the data survives redeploys.
    data_dir: str = "./data"

    # Stripe Checkout (unprefixed env names). Empty → paywall is off.
    stripe_secret_key: str = Field(default="", validation_alias="STRIPE_SECRET_KEY")
    stripe_webhook_secret: str = Field(default="", validation_alias="STRIPE_WEBHOOK_SECRET")
    stripe_price_batch: str = Field(default="", validation_alias="STRIPE_PRICE_BATCH")
    stripe_price_pass: str = Field(default="", validation_alias="STRIPE_PRICE_PASS")
    # HMAC secret for one-time / 24h tokens. Falls back to the webhook secret.
    fix_token_secret: str = Field(default="", validation_alias="FIX_TOKEN_SECRET")
    # Public origin of the web app, used for Stripe success/cancel redirects.
    public_web_url: str = Field(default="http://localhost:3000", validation_alias="PUBLIC_WEB_URL")

    # Optional PostHog. Empty key → no events are sent. Never include file contents.
    posthog_api_key: str = Field(default="", validation_alias="POSTHOG_API_KEY")
    posthog_host: str = Field(default="https://us.i.posthog.com", validation_alias="POSTHOG_HOST")

    model_config = SettingsConfigDict(env_file=".env", env_prefix="CHOWBEA_")

    @property
    def paywall_enabled(self) -> bool:
        """Paywall is on only when every Stripe key the Checkout flow needs is set."""
        return bool(
            self.stripe_secret_key.strip()
            and self.stripe_webhook_secret.strip()
            and self.stripe_price_batch.strip()
            and self.stripe_price_pass.strip()
        )

    @property
    def token_signing_secret(self) -> str:
        """HMAC key for entitlement tokens. Never a hardcoded default secret."""
        return (self.fix_token_secret or self.stripe_webhook_secret).strip()

    @property
    def cors_origin_list(self) -> list[str]:
        """Return the configured CORS origins as a clean list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


# A single shared settings instance for the whole app.
settings = Settings()
