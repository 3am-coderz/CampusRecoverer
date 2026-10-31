from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel
from .config import config
from .engine.ml_fallback import init_ml_model
from .engine.matcher import score_item_and_claim
from .engine.semantic import calculate_semantic_similarity

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize ML model on startup
    init_ml_model()
    yield

app = FastAPI(
    title="Campus Recoverer Matching Engine",
    version="1.0.0",
    lifespan=lifespan,
)

def verify_internal_key(x_internal_key: str | None = Header(default=None, alias="X-Internal-Key")):
    if not x_internal_key or x_internal_key != config.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: invalid or missing X-Internal-Key",
        )

class ScoreRequest(BaseModel):
    item: dict
    claim: dict

class ScoreResponse(BaseModel):
    structured_score: float
    semantic_score: float
    final_score: float
    match_score: float
    confidence: str
    ml_used: bool
    explanation: list[str]

class SimilarityPair(BaseModel):
    expected: str
    given: str

class SimilarityRequest(BaseModel):
    pairs: list[SimilarityPair]

class SimilarityResult(BaseModel):
    similarity: float
    matched: bool

class SimilarityResponse(BaseModel):
    results: list[SimilarityResult]

@app.get("/healthz")
async def healthz():
    return {"status": "ok", "service": "matching"}

@app.post("/matching/score", response_model=ScoreResponse)
async def score_endpoint(
    req: ScoreRequest,
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
):
    verify_internal_key(x_internal_key)
    result = score_item_and_claim(req.item, req.claim)
    return result

@app.post("/matching/similarity", response_model=SimilarityResponse)
async def similarity_endpoint(
    req: SimilarityRequest,
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
):
    verify_internal_key(x_internal_key)
    results = []
    for pair in req.pairs:
        # Note: Never log expected answer to preserve privacy!
        sim_score, _ = calculate_semantic_similarity(pair.expected, pair.given)
        matched = sim_score >= 60.0
        results.append(SimilarityResult(
            similarity=round(sim_score / 100.0, 2),
            matched=matched,
        ))
    return {"results": results}
