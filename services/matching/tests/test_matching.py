import pytest
from fastapi.testclient import TestClient
from services.matching.main import app
from services.matching.config import config
from services.matching.engine.deterministic import calculate_deterministic_score
from services.matching.engine.semantic import calculate_semantic_similarity

client = TestClient(app)
AUTH_HEADERS = {"X-Internal-Key": config.internal_api_key}

def test_healthz():
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "matching"}

def test_internal_key_enforcement():
    item_payload = {
        "item": {
            "category": "laptop",
            "hidden_description": "Apple MacBook",
            "hidden_attributes": {},
            "found_location_public": "Hall",
            "found_date": "2026-10-24T12:00:00Z"
        },
        "claim": {
            "description": "laptop",
            "claimed_attributes": {},
            "lost_date": "2026-10-24T12:00:00Z",
            "lost_location": "Hall"
        }
    }
    # No header -> 401
    res1 = client.post("/matching/score", json=item_payload)
    assert res1.status_code == 401

    # Invalid header -> 401
    res2 = client.post("/matching/score", json=item_payload, headers={"X-Internal-Key": "wrong-key"})
    assert res2.status_code == 401

    # Valid header -> 200
    res3 = client.post("/matching/score", json=item_payload, headers=AUTH_HEADERS)
    assert res3.status_code == 200

def test_worked_example_structured_score_88():
    """
    Prompt requirement:
    'the worked example (all fields match except color mismatch and date close -> 88)'
    """
    item = {
        "category": "laptop",
        "found_location_public": "Library 2nd Floor",
        "found_date": "2026-10-24T12:00:00Z",
        "hidden_attributes": {
            "brand": "Apple",
            "model": "MacBook Pro 14",
            "color": "Space Gray",
            "unique_features": ["small scratch near bottom right corner"]
        }
    }

    claim = {
        "category": "laptop",
        "description": "Lost laptop",
        "lost_location": "Library 2nd Floor",
        "lost_date": "2026-10-25T12:00:00Z", # Exactly 1 day apart -> 8 pts
        "claimed_attributes": {
            "brand": "Apple",
            "model": "MacBook Pro 14",
            "color": "Silver", # Mismatch -> 0 pts
            "unique_features": ["small scratch near bottom right corner"]
        }
    }

    structured_score, explanations, _ = calculate_deterministic_score(item, claim)
    # Expected: 20 (category) + 15 (brand) + 15 (model) + 0 (color) + 10 (location) + 8 (date) + 20 (features) = 88.0
    assert structured_score == 88.0
    assert "color: mismatch" in explanations
    assert "date: close match" in explanations

def test_paraphrase_semantic_scoring():
    """
    Prompt requirement:
    'paraphrase ("small scratch bottom-right corner" vs "tiny mark near lower right edge" scores high)'
    """
    text1 = "small scratch bottom-right corner"
    text2 = "tiny mark near lower right edge"
    score, _ = calculate_semantic_similarity(text1, text2)
    assert score >= 60.0

def test_band_based_ml_usage():
    """
    Prompt requirement:
    ML fallback triggered ONLY in uncertain band (default 50 to 75).
    """
    # 1. High score item (structured = 88) -> outside band -> ml_used == False
    high_item = {
        "item": {
            "category": "laptop",
            "hidden_description": "Apple MacBook Pro 14 Space Gray with small scratch",
            "hidden_attributes": {
                "brand": "Apple",
                "model": "MacBook Pro 14",
                "color": "Silver",
                "unique_features": ["scratch on corner"]
            },
            "found_location_public": "Library",
            "found_date": "2026-10-24T12:00:00Z"
        },
        "claim": {
            "description": "MacBook Pro 14 laptop",
            "claimed_attributes": {
                "brand": "Apple",
                "model": "MacBook Pro 14",
                "color": "Gold", # mismatch
                "unique_features": ["scratch on corner"]
            },
            "lost_location": "Library",
            "lost_date": "2026-10-25T12:00:00Z"
        }
    }
    res_high = client.post("/matching/score", json=high_item, headers=AUTH_HEADERS)
    assert res_high.status_code == 200
    data_high = res_high.json()
    assert data_high["structured_score"] >= 80.0
    assert data_high["ml_used"] is False

    # 2. Medium score item inside [50, 75] band -> ml_used == True
    # e.g., category (20) + brand (15) + model (15) + color (10) = 60
    mid_item = {
        "item": {
            "category": "headphones",
            "hidden_description": "Sony headphones",
            "hidden_attributes": {
                "brand": "Sony",
                "model": "WH-1000XM4",
                "color": "Black"
            },
            "found_location_public": "Gym",
            "found_date": "2026-10-10T12:00:00Z"
        },
        "claim": {
            "description": "Lost my headphones",
            "claimed_attributes": {
                "brand": "Sony",
                "model": "WH-1000XM4",
                "color": "Black"
            },
            "lost_location": "Dining Hall", # mismatch
            "lost_date": "2026-10-24T12:00:00Z" # > 7 days apart -> 0
        }
    }
    res_mid = client.post("/matching/score", json=mid_item, headers=AUTH_HEADERS)
    assert res_mid.status_code == 200
    data_mid = res_mid.json()
    assert 50.0 <= data_mid["structured_score"] <= 75.0
    assert data_mid["ml_used"] is True
    assert any("ml_fallback" in expl for expl in data_mid["explanation"])

def test_security_invariant_zero_hidden_data_leakage():
    """
    Prompt requirement:
    'Never log or echo hidden values. Never use the phrase "owner probability".'
    """
    canary_serial = "CANARY-SECRET-SERIAL-9988"
    canary_secret_phrase = "CANARY_SECRET_HIDDEN_GOLDEN_RING"

    item = {
        "item": {
            "category": "backpack",
            "hidden_description": f"Contains {canary_secret_phrase}",
            "hidden_attributes": {
                "brand": "NorthFace",
                "serial_number": canary_serial
            },
            "found_location_public": "Campus Center",
            "found_date": "2026-10-24T12:00:00Z"
        },
        "claim": {
            "description": "Black backpack",
            "claimed_attributes": {
                "brand": "NorthFace"
            },
            "lost_location": "Campus Center",
            "lost_date": "2026-10-24T12:00:00Z"
        }
    }

    res = client.post("/matching/score", json=item, headers=AUTH_HEADERS)
    assert res.status_code == 200
    raw_response_text = res.text

    assert canary_serial not in raw_response_text
    assert canary_secret_phrase not in raw_response_text
    assert "owner probability" not in raw_response_text.lower()

    # Explanations must name fields only
    for expl in res.json()["explanation"]:
        assert canary_serial not in expl
        assert canary_secret_phrase not in expl
