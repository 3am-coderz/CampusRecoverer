import os
from pydantic import BaseModel

class MatchingConfig(BaseModel):
    internal_api_key: str = os.getenv("INTERNAL_API_KEY", "internal-matching-key-xyz")
    ml_band_min: float = float(os.getenv("ML_BAND_MIN", "50.0"))
    ml_band_max: float = float(os.getenv("ML_BAND_MAX", "75.0"))
    confidence_high: float = float(os.getenv("CONFIDENCE_HIGH", "80.0"))
    confidence_medium: float = float(os.getenv("CONFIDENCE_MEDIUM", "50.0"))
    structured_weight: float = float(os.getenv("STRUCTURED_WEIGHT", "0.6"))
    semantic_weight: float = float(os.getenv("SEMANTIC_WEIGHT", "0.4"))

config = MatchingConfig()
