# Member 2: Handover Module

The Handover module manages cryptographically secure QR code and one-time password (OTP) verification for physical item collection at the security desk.

## Ownership
- Owner: Member 2
- Route prefix: `/handover`
- Provided Ports: `HandoverPort`

## Cryptographic and Security Invariants
1. Raw QR tokens and OTPs are NEVER persisted in plaintext; the database stores only HMAC-SHA256 digests.
2. QR tokens are deterministically regenerable for the claimant during the validity window.
3. Verification uses constant-time comparison (`crypto.timingSafeEqual`) against timing attacks.
4. Five failed verification attempts automatically lock the handover and flag a security dispute.
5. High-risk items strictly require `id_verified: true` before release.
6. Successful handover records custody release, marks item/claim collected, and writes an audit event.
