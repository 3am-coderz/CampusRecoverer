# Matching Service Environment Variables

| Variable | Description | Default |
|---|---|---|
| `INTERNAL_API_KEY` | Shared secret header key required for internal API calls (`X-Internal-Key`) | `internal-matching-key-xyz` |
| `ML_BAND_MIN` | Lower bound of the uncertain structured score band for ML fallback | `50.0` |
| `ML_BAND_MAX` | Upper bound of the uncertain structured score band for ML fallback | `75.0` |
| `CONFIDENCE_HIGH` | Score threshold for HIGH confidence classification | `80.0` |
| `CONFIDENCE_MEDIUM` | Score threshold for MEDIUM confidence classification | `50.0` |
| `STRUCTURED_WEIGHT` | Linear combination weight for structured feature score | `0.6` |
| `SEMANTIC_WEIGHT` | Linear combination weight for free-text semantic score | `0.4` |
