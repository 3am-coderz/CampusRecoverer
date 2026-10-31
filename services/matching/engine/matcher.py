from ..config import config
from .deterministic import calculate_deterministic_score
from .semantic import calculate_semantic_similarity
from .ml_fallback import predict_ml_probability

def score_item_and_claim(item: dict, claim: dict) -> dict:
    # 1. Deterministic Layer
    structured_score, explanations, breakdown = calculate_deterministic_score(item, claim)

    # 2. Semantic Layer
    item_text = f"{item.get('category', '')} {item.get('hidden_description', '')}"
    claim_text = f"{claim.get('category', '')} {claim.get('description', '')}"
    semantic_score, tf_used = calculate_semantic_similarity(item_text, claim_text)

    if tf_used:
        explanations.append("semantic: transformer embeddings applied")
    else:
        explanations.append("semantic: tf-idf cosine similarity applied")

    # Linear combination
    combined_score = (
        config.structured_weight * structured_score +
        config.semantic_weight * semantic_score
    )
    combined_score = round(min(100.0, max(0.0, combined_score)), 1)

    ml_used = False
    final_score = combined_score

    # 3. ML Fallback inside uncertain band
    if config.ml_band_min <= structured_score <= config.ml_band_max:
        ml_used = True
        feat_vector = [
            breakdown.get("category", 0.0),
            breakdown.get("brand", 0.0),
            breakdown.get("model", 0.0),
            breakdown.get("color", 0.0),
            breakdown.get("location", 0.0),
            breakdown.get("date", 0.0),
            breakdown.get("unique_features", 0.0),
            semantic_score / 100.0,
        ]
        ml_prob = predict_ml_probability(feat_vector)
        ml_score = round(ml_prob * 100.0, 1)
        final_score = round(0.5 * combined_score + 0.5 * ml_score, 1)
        explanations.append("ml_fallback: evaluated via logistic regression in uncertainty band")

    # Threshold mapping
    if final_score >= config.confidence_high:
        confidence = "HIGH"
    elif final_score >= config.confidence_medium:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    return {
        "structured_score": structured_score,
        "semantic_score": semantic_score,
        "final_score": final_score,
        "match_score": final_score,
        "confidence": confidence,
        "ml_used": ml_used,
        "explanation": explanations,
    }
