import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "DAI-Guard Research Platform"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dai-guard-research-secret-key-32-chars-min!!")
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    ARTIFACTS_DIR: Path = BASE_DIR / "artifacts"
    
    # Database (SQLite default for zero-config, PostgreSQL compatible)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite+aiosqlite:///{BASE_DIR}/dai_guard.db"
    )
    
    # Paper Specifications
    IF_N_ESTIMATORS: int = 200
    IF_MAX_SAMPLES: int = 256
    IF_CONTAMINATION: float = 0.0018
    
    DAE_INPUT_DIM: int = 30
    DAE_LATENT_DIM: int = 8
    DAE_DROPOUT: float = 0.1
    DAE_NOISE_STD: float = 0.05
    DAE_LEARNING_RATE: float = 0.001
    DAE_BATCH_SIZE: int = 256
    DAE_MAX_EPOCHS: int = 50
    DAE_PATIENCE: int = 5
    
    # Reference Settings from Paper
    DEFAULT_DELTA: float = 0.6  # Agreement gate threshold
    DEFAULT_T1: float = 0.25    # Approve / Step-up threshold
    DEFAULT_T2: float = 0.55    # Step-up / Review threshold
    DEFAULT_T3: float = 0.75    # Review / Decline threshold
    
    # Random Seed
    RANDOM_SEED: int = 42

    model_config = {
        "env_file": ".env",
        "extra": "allow"
    }

settings = Settings()

# Ensure directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.ARTIFACTS_DIR, exist_ok=True)
