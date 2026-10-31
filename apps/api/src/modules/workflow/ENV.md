# Workflow Module Environment Variables

| Variable | Description | Default |
|---|---|---|
| `HIGH_CONFIDENCE_THRESHOLD` | Score cutoff at which claims are considered high confidence | `80.0` |
| `CONFLICT_MARGIN` | Score difference margin between top two claims that triggers a manual review conflict | `5.0` |
| `RETENTION_PERIOD_DAYS` | Period after which unclaimed items transition to `EXPIRED` | `30` |
