from datetime import datetime
from rapidfuzz import fuzz

def normalize(text: str) -> str:
    return (text or "").lower().strip()

def score_date_decay(found_date_str: str, lost_date_str: str) -> tuple[float, str]:
    try:
        # Handle ISO strings
        d1 = datetime.fromisoformat(found_date_str.replace("Z", "+00:00"))
        d2 = datetime.fromisoformat(lost_date_str.replace("Z", "+00:00"))
        days_apart = abs((d1 - d2).total_seconds()) / 86400.0

        if days_apart <= 0.5:
            return 10.0, "date: exact match"
        elif days_apart <= 1.5:
            return 8.0, "date: close match"
        elif days_apart <= 2.5:
            return 6.0, "date: moderate match"
        elif days_apart <= 4.0:
            return 4.0, "date: loose match"
        elif days_apart <= 7.0:
            return 2.0, "date: distant match"
        else:
            return 0.0, "date: mismatch"
    except Exception:
        return 5.0, "date: unparsed fallback"

def score_location(item_loc: str, claim_loc: str) -> tuple[float, str]:
    l1 = normalize(item_loc)
    l2 = normalize(claim_loc)
    if not l1 or not l2:
        return 0.0, "location: missing"

    ratio = fuzz.token_set_ratio(l1, l2)
    if ratio >= 80:
        return 10.0, "location: match"
    elif ratio >= 50:
        return 7.0, "location: partial match"
    elif ratio >= 30:
        return 4.0, "location: weak match"
    return 0.0, "location: mismatch"

def score_unique_features(item_features: list, claim_features: list) -> tuple[float, str]:
    if not item_features or not claim_features:
        return 0.0, "unique_features: none"

    matches = []
    for cf in claim_features:
        cf_norm = normalize(str(cf))
        best_score = max(
            [fuzz.token_set_ratio(cf_norm, normalize(str(itf))) for itf in item_features],
            default=0
        )
        matches.append(best_score)

    if not matches:
        return 0.0, "unique_features: none"

    avg_ratio = sum(matches) / len(matches)
    score = (avg_ratio / 100.0) * 20.0
    score = round(min(20.0, max(0.0, score)), 1)

    if score >= 16.0:
        return score, "unique_features: match"
    elif score >= 10.0:
        return score, "unique_features: partial match"
    return score, "unique_features: weak match"

def calculate_deterministic_score(item: dict, claim: dict) -> tuple[float, list[str], dict]:
    explanations: list[str] = []
    feature_breakdown = {}

    # 1. Category (20 pts)
    item_cat = normalize(item.get("category", ""))
    claim_cat = normalize(claim.get("category", "") or item.get("category", ""))
    claim_desc = normalize(claim.get("description", ""))
    
    cat_match = fuzz.token_set_ratio(item_cat, claim_cat) >= 80 or item_cat in claim_desc
    cat_score = 20.0 if cat_match else 0.0
    if cat_match:
        explanations.append("category: match")
    else:
        explanations.append("category: mismatch")
    feature_breakdown["category"] = cat_score / 20.0

    # Attributes
    item_attr = item.get("hidden_attributes", {}) or {}
    claim_attr = claim.get("claimed_attributes", {}) or {}

    # 2. Brand (15 pts)
    item_brand = normalize(str(item_attr.get("brand", "")))
    claim_brand = normalize(str(claim_attr.get("brand", "")))
    if item_brand and claim_brand:
        b_ratio = fuzz.token_sort_ratio(item_brand, claim_brand)
        if b_ratio >= 80:
            brand_score = 15.0
            explanations.append("brand: match")
        elif b_ratio >= 50:
            brand_score = 8.0
            explanations.append("brand: partial match")
        else:
            brand_score = 0.0
            explanations.append("brand: mismatch")
    else:
        brand_score = 0.0
        explanations.append("brand: not specified")
    feature_breakdown["brand"] = brand_score / 15.0

    # 3. Model (15 pts)
    item_model = normalize(str(item_attr.get("model", "")))
    claim_model = normalize(str(claim_attr.get("model", "")))
    if item_model and claim_model:
        m_ratio = fuzz.token_set_ratio(item_model, claim_model)
        if m_ratio >= 80:
            model_score = 15.0
            explanations.append("model: match")
        elif m_ratio >= 50:
            model_score = 8.0
            explanations.append("model: partial match")
        else:
            model_score = 0.0
            explanations.append("model: mismatch")
    else:
        model_score = 0.0
        explanations.append("model: not specified")
    feature_breakdown["model"] = model_score / 15.0

    # 4. Color (10 pts)
    item_color = normalize(str(item_attr.get("color", "")))
    claim_color = normalize(str(claim_attr.get("color", "")))
    if item_color and claim_color:
        c_ratio = fuzz.ratio(item_color, claim_color)
        if c_ratio >= 80 or item_color in claim_color or claim_color in item_color:
            color_score = 10.0
            explanations.append("color: match")
        else:
            color_score = 0.0
            explanations.append("color: mismatch")
    else:
        color_score = 0.0
        explanations.append("color: not specified")
    feature_breakdown["color"] = color_score / 10.0

    # 5. Location (10 pts)
    loc_score, loc_expl = score_location(
        item.get("found_location_public", ""),
        claim.get("lost_location", "")
    )
    explanations.append(loc_expl)
    feature_breakdown["location"] = loc_score / 10.0

    # 6. Date (10 pts)
    date_score, date_expl = score_date_decay(
        item.get("found_date", ""),
        claim.get("lost_date", "")
    )
    explanations.append(date_expl)
    feature_breakdown["date"] = date_score / 10.0

    # 7. Unique Features (20 pts)
    item_feats = item_attr.get("unique_features", [])
    claim_feats = claim_attr.get("unique_features", [])
    feat_score, feat_expl = score_unique_features(item_feats, claim_feats)
    explanations.append(feat_expl)
    feature_breakdown["unique_features"] = feat_score / 20.0

    total_structured = cat_score + brand_score + model_score + color_score + loc_score + date_score + feat_score
    total_structured = round(min(100.0, max(0.0, total_structured)), 1)

    return total_structured, explanations, feature_breakdown
