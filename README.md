# Campus Recoverer

> Privacy-Preserving Campus Lost-and-Found & Asset-Recovery Platform

## Overview
Campus Recoverer is an enterprise-grade, privacy-first platform engineered to solve campus lost-and-found recovery without leaking sensitive details or identity attributes to the public. Built as a single monorepo partitioned into five zero-conflict ownership domains.

## Architecture & Partitions
- **Phase 0 (Frozen)**: Contracts, shared kernel stubs, app loader, route registries, and migration runner.
- **Member 1 (Frontend & UX)**: React 18 + Vite + Tailwind CSS responsive portal, public browsing, claim wizard, security verification desk, and admin analytics dashboard.
- **Member 2 (Backend Core & Handover)**: Node.js/Express core models, DB migrations, item/claim lifecycle, HMAC-SHA256 QR tokens, and single-use OTP handovers.
- **Member 3 (Matching & ML Engine - Team Lead)**: Python FastAPI service computing deterministic fuzzy similarity, semantic text scoring, and logistic regression ML fallback.
- **Member 4 (Security Workflows & Business Logic)**: Risk classification (LOW/MEDIUM/HIGH), state machine transitions, multi-high-confidence claim dispute resolution, ownership questions evaluation, and chain-of-custody logging.
- **Member 5 (DevOps, Audit & Testing)**: Append-only SHA-256 hash-chained audit logging, Docker orchestration, CI guardrails, E2E test suites, and security invariant validation.

## Quick Start
```bash
# Boot the entire stack
make dev

# Run all test suites across all partitions
make test

# Run end-to-end integration and security invariant tests
make e2e
```
