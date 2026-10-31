# Member 5: System Testing Suite

Comprehensive End-to-End, Edge Case, and Security Invariant test suites for Campus Recoverer.

## Ownership
- Owner: Member 5 (DevOps, Audit & Testing)

## Test Structure
- `tests/e2e/`: End-to-end user journeys (registration -> report -> security custody -> verification -> claim -> match score -> security approval -> QR/OTP issuance -> desk release -> audit integrity check).
- `tests/edge-cases/`: Boundary conditions (finder self-claiming prevention, QR replay prevention, 5 failed OTP lockout, HIGH risk ID verification requirement, matching service fallback to MANUAL_REVIEW, illegal state transitions).
- `tests/security-invariants/`: Core guarantees (zero canary leak in public/claimant responses/logs, no answer leakage to claimant, highest score never auto-wins, append-only tamper-evident audit log, hash-only credentials).
