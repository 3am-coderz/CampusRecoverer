# Member 3: Matching and ML Engine (Team Lead)

The Matching and ML Engine is an isolated, high-performance Python microservice that computes similarity scores between found items and ownership claims.

## Ownership
- Owner: Member 3 (Team Lead)
- Internal Port: 8000
- Protocol: HTTP REST adhering strictly to `contracts/matching.openapi.yaml`

## Architectural Principles
1. **Internal-Only Security**: All endpoints enforce the `X-Internal-Key` header. Direct external public access is prohibited.
2. **Zero Knowledge / Privacy Preservation**:
   - The matching service never logs, echoes, or stores hidden values or expected answers.
   - Explanations reference field names only (e.g., `brand: match`), never confidential values.
   - Never uses the misleading phrase "owner probability" — scores represent "Claim Confidence Score / Ownership Match Score".
3. **Decisions Belong to Security Staff**: The ML engine computes guidance scores; outcomes and claim approvals are exclusively executed by human security officers and workflow state machines.

## Multi-Layer Scoring Architecture
- **Layer 1: Deterministic Heuristics (0–100)**:
  - Category: 20 pts (exact/normalized fuzzy match)
  - Brand: 15 pts (rapidfuzz token ratio)
  - Model: 15 pts (rapidfuzz token set ratio)
  - Color: 10 pts (color synonym & distance matching)
  - Location: 10 pts (token overlap & alias expansion)
  - Date: 10 pts (temporal decay function)
  - Unique Features: 20 pts (max bipartite feature matching)
- **Layer 2: Semantic Similarity**:
  - TF-IDF ngram vectorizer cosine similarity + lazy-loaded sentence transformer embedding similarity with graceful degradation.
  - Combined `final_score = 0.6 * structured + 0.4 * semantic`.
- **Layer 3: Uncertainty ML Fallback**:
  - Active only within the uncertain band [50.0, 75.0].
  - Evaluates feature vector through a trained Scikit-Learn Logistic Regression model, setting `ml_used = True`.
