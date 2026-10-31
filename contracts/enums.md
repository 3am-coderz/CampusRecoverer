# Campus Recoverer - Canonical Enums

This document defines the single source of truth for all system enums across all services and partitions.

## 1. User Roles
- `STUDENT`: Regular authenticated campus student/staff member. Can report lost items, view public listings, submit claims, and view own claims.
- `FINDER`: User role associated with reporting a found item.
- `SECURITY`: Campus security and lost-and-found desk personnel. Can verify physical custody, review claims, inspect hidden data (audited), approve/reject claims, and execute QR/OTP handovers.
- `ADMIN`: System administrator with full oversight, dispute resolution, and audit chain verification authority.

## 2. Risk Levels
- `LOW`: Standard items (clothing, bottles, books, umbrellas, stationary). Waiting period: 24h.
- `MEDIUM`: Moderate-value electronics and personal accessories (headphones, non-flagship wearables, bags, calculators). Waiting period: 48h.
- `HIGH`: Sensitive or high-value assets (smartphones, laptops, wallets, ID cards, bank/credit cards, passports, official documents). Waiting period: 72h. Mandatory ID verification at handover.

## 3. Item Statuses
- `PENDING_HANDOVER`: Item reported by finder, but physical item has not yet been received or verified by security. Not public.
- `WAITING_PERIOD`: Physical item received and verified by security desk. Enforcing holding period before claims open.
- `OPEN_FOR_CLAIMS`: Publicly listed for students to browse and submit ownership claims.
- `UNDER_REVIEW`: One or more claims submitted; currently undergoing security review or dispute investigation.
- `APPROVED_AWAITING_COLLECTION`: A claim has been approved; handover QR/OTP generated; awaiting physical desk pickup.
- `COLLECTED`: Item physically verified and handed over to claimant.
- `EXPIRED`: Item remained unclaimed through the retention period.
- `STORED_LONG_TERM`: Post-expiry disposition: archived into long-term institutional storage.
- `DONATED`: Post-expiry disposition: donated to campus charity.
- `DISPOSED`: Post-expiry disposition: securely recycled or destroyed.

## 4. Claim Statuses
- `SUBMITTED`: Claim submitted by student; awaiting matching calculation and questions.
- `SCORED`: Matching engine has scored the claim; awaiting security review.
- `MANUAL_REVIEW`: Automatic flag triggered (e.g. multiple high-confidence claims or conflict margin) requiring deliberate manual security investigation.
- `APPROVED`: Claim approved by security staff; item moves to collection.
- `REJECTED`: Claim rejected by security.
- `WITHDRAWN`: Claim voluntarily cancelled by claimant.
- `COLLECTED`: Claimant has collected the item at the desk.

## 5. Audit Actions
- `ITEM_REPORTED`: Finder submitted report.
- `ITEM_RECEIVED`: Physical item checked in at security desk.
- `ITEM_VERIFIED`: Security completed receipt and classified risk.
- `CLAIM_CREATED`: Claimant submitted ownership claim.
- `CLAIM_SCORED`: Claim scored against item.
- `QUESTIONS_ANSWERED`: Claimant answered ownership verification questions.
- `CLAIM_APPROVED`: Security approved claim.
- `CLAIM_REJECTED`: Security rejected claim.
- `QR_GENERATED`: Handover QR token and OTP generated.
- `QR_VERIFIED`: Security desk verified QR token and OTP.
- `ITEM_COLLECTED`: Physical handover executed.
- `ITEM_EXPIRED`: Retention window elapsed.
- `DISPOSITION_DECIDED`: Final disposition chosen for expired item.
- `DISPUTE_FLAGGED`: Competing claims or failed attempt limit triggered dispute.
- `HIDDEN_DATA_VIEWED`: Security viewed hidden item details.

## 6. Custody Events
- `REPORTED`: Finder filed the initial digital report.
- `RECEIVED_BY_SECURITY`: Physical item accepted into desk custody.
- `STORED`: Item placed into secure bin/shelf location.
- `CLAIMED`: Claim verified and approved for release.
- `RELEASED`: Item handed over to claimant.

## 7. Waiting Periods (Configurable via Environment)
- `LOW`: 24 hours (default)
- `MEDIUM`: 48 hours (default)
- `HIGH`: 72 hours (default)
