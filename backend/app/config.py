from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@db:5432/harbor"

    # Bootstrap admin: if set and no manager exists yet, one is created on startup.
    DEFAULT_MANAGER_NAME: str = "Admin"
    DEFAULT_MANAGER_PIN: str = ""

settings = Settings()