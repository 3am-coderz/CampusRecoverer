# Member 4: Security Workflows & Business Logic

The Workflow module enforces asset risk classification, state transitions, ownership question generation and verification, claim dispute resolution, and chain of custody management.

## Ownership
- Owner: Member 4
- Route prefix: `/workflow`
- Provided Ports: `RiskPort`, `WorkflowPort`

## Core Security & Workflow Rules
1. **Risk Classification**:
   - `HIGH`: Smart devices, wallets, credentials, bank cards, documents.
   - `MEDIUM`: Audio wearables, bags, watches, electronics.
   - `LOW`: Common apparel, water bottles, stationery.
2. **Deterministic State Machine**:
   - Explicit allowed-transition matrix with strict assertion guards throwing on illegal moves.
3. **Multi-Claim Dispute Resolution**:
   - Competing high-confidence claims (score >= 80 or score difference <= 5) automatically force all involved claims to `MANUAL_REVIEW` and item to `UNDER_REVIEW`.
   - Highest score NEVER auto-wins.
4. **Zero-Knowledge Ownership Questions**:
   - Questions generated dynamically from hidden attributes without ever revealing the expected answers to claimants.
   - Answers scored via matching engine and recorded as matched/similarity flags only.
5. **Physical Custody Gate**:
   - Items require physical desk check-in (`RECEIVED_BY_SECURITY`) before verification can advance the item to `WAITING_PERIOD`.
