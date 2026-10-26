from functools import lru_cache
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "local-development-secret-do-not-use-in-aws"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"
    log_level: str = "INFO"

    # Either a full DATABASE_URL, or the DB_* parts (how ECS injects RDS credentials).
    database_url: str | None = None
    db_host: str | None = None
    db_port: int = 5432
    db_name: str = "ticket2prize"
    db_user: str = "ticket2prize"
    db_password: str | None = None

    jwt_secret: str = DEV_JWT_SECRET
    token_ttl_minutes: int = 60 * 24 * 30
    # Comma-separated list of keys kiosks use to issue ticket stubs.
    kiosk_keys: str = "dev-kiosk-key"
    # Where a scanned QR code should send the customer.
    public_base_url: str = "http://localhost:8080"
    cors_origins: str = ""
    seed_demo_data: bool = False

    @model_validator(mode="after")
    def _no_dev_secrets_in_the_cloud(self):
        if self.environment not in ("local", "test") and self.jwt_secret == DEV_JWT_SECRET:
            raise ValueError("JWT_SECRET must be set outside local development")
        return self

    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        if self.db_host:
            password = quote_plus(self.db_password or "")
            return (
                f"postgresql+psycopg://{self.db_user}:{password}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}"
            )
        return "sqlite:///./ticket2prize.db"

    @property
    def kiosk_key_set(self) -> set[str]:
        return {k.strip() for k in self.kiosk_keys.split(",") if k.strip()}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
