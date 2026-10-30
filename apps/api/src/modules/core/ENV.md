# Core Module Environment Variables

| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET` | Secret key for signing and verifying JWT tokens | `super-secret-campus-recoverer-jwt-key-2026` |
| `MATCHING_SERVICE_URL` | Base URL for internal matching microservice | `http://localhost:8000` |
| `INTERNAL_API_KEY` | Header key for calling internal microservices | `internal-matching-key-xyz` |
| `WAITING_PERIOD_LOW_HOURS` | Waiting period for LOW risk items (hours) | `24` |
| `WAITING_PERIOD_MEDIUM_HOURS` | Waiting period for MEDIUM risk items (hours) | `48` |
| `WAITING_PERIOD_HIGH_HOURS` | Waiting period for HIGH risk items (hours) | `72` |
