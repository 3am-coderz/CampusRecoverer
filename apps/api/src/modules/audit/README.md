# Member 5: Audit Logging Module

The Audit module implements an append-only, tamper-evident cryptographic audit ledger for Campus Recoverer.

## Ownership
- Owner: Member 5 (DevOps, Audit & Testing)
- Route prefix: `/audit`
- Provided Ports: `AuditPort`

## Security and Cryptographic Invariants
1. **Append-Only Immutability**:
   - `UPDATE` and `DELETE` queries on `audit_logs` are intercepted and rejected with an exception by database triggers.
2. **Cryptographic Hash Chaining**:
   - Every log entry records `prev_hash` and `row_hash` (SHA-256 calculated over the row tuple concatenated with `prev_hash`).
   - Genesis block uses 64 zeros.
   - Any retrospective tampering, truncation, or reordering breaks the chain and is detected by `/audit/verify-chain`.
3. **Automated Metadata Sanitization**:
   - Sensitive fields (`hidden_*`, `serial_number`, `otp`, `qr_token`, `answer*`, `expected*`) are stripped before writing to disk.
