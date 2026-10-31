import { ItemStatus, ClaimStatus } from '../../../kernel/ports.js';
import { BadRequestError } from '../../../kernel/errors.js';

export const ALLOWED_ITEM_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  PENDING_HANDOVER: ['WAITING_PERIOD', 'DISPOSED'],
  WAITING_PERIOD: ['OPEN_FOR_CLAIMS'],
  OPEN_FOR_CLAIMS: ['UNDER_REVIEW', 'APPROVED_AWAITING_COLLECTION', 'EXPIRED'],
  UNDER_REVIEW: ['OPEN_FOR_CLAIMS', 'APPROVED_AWAITING_COLLECTION', 'EXPIRED'],
  APPROVED_AWAITING_COLLECTION: ['COLLECTED', 'UNDER_REVIEW', 'OPEN_FOR_CLAIMS'],
  COLLECTED: [],
  EXPIRED: ['STORED_LONG_TERM', 'DONATED', 'DISPOSED'],
  STORED_LONG_TERM: [],
  DONATED: [],
  DISPOSED: [],
};

export const ALLOWED_CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  SUBMITTED: ['SCORED', 'WITHDRAWN'],
  SCORED: ['MANUAL_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
  MANUAL_REVIEW: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  APPROVED: ['COLLECTED', 'REJECTED', 'WITHDRAWN'],
  REJECTED: [],
  WITHDRAWN: [],
  COLLECTED: [],
};

export function assertItemTransition(from: ItemStatus, to: ItemStatus): void {
  if (from === to) return;
  const allowed = ALLOWED_ITEM_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new BadRequestError(
      `Illegal item transition from ${from} to ${to}`,
      'ILLEGAL_ITEM_TRANSITION',
    );
  }
}

export function assertClaimTransition(from: ClaimStatus, to: ClaimStatus): void {
  if (from === to) return;
  const allowed = ALLOWED_CLAIM_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new BadRequestError(
      `Illegal claim transition from ${from} to ${to}`,
      'ILLEGAL_CLAIM_TRANSITION',
    );
  }
}
