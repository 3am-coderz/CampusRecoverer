import {
  WorkflowPort,
  ItemStatus,
  ClaimStatus,
  ResolveClaimsResult,
  CustodyRecordParams,
  VerificationSummary,
} from '../ports.js';
import { BadRequestError } from '../errors.js';

const ALLOWED_ITEM_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
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

const ALLOWED_CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  SUBMITTED: ['SCORED', 'WITHDRAWN'],
  SCORED: ['MANUAL_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
  MANUAL_REVIEW: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  APPROVED: ['COLLECTED', 'REJECTED', 'WITHDRAWN'],
  REJECTED: [],
  WITHDRAWN: [],
  COLLECTED: [],
};

export class WorkflowStub implements WorkflowPort {
  private receipts: Set<string> = new Set();
  private custodyHistory: CustodyRecordParams[] = [];

  assertItemTransition(from: ItemStatus, to: ItemStatus): void {
    if (from === to) return;
    const allowed = ALLOWED_ITEM_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new BadRequestError(
        `Illegal item transition from ${from} to ${to}`,
        'ILLEGAL_ITEM_TRANSITION',
      );
    }
  }

  assertClaimTransition(from: ClaimStatus, to: ClaimStatus): void {
    if (from === to) return;
    const allowed = ALLOWED_CLAIM_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new BadRequestError(
        `Illegal claim transition from ${from} to ${to}`,
        'ILLEGAL_CLAIM_TRANSITION',
      );
    }
  }

  async resolveClaims(_item_id: string): Promise<ResolveClaimsResult> {
    return {
      item_status: 'OPEN_FOR_CLAIMS',
      claim_updates: [],
      multi_high_confidence: false,
    };
  }

  async recordCustody(params: CustodyRecordParams): Promise<void> {
    this.custodyHistory.push(params);
    if (params.event === 'RECEIVED_BY_SECURITY') {
      this.receipts.add(params.item_id);
    }
  }

  async hasReceipt(item_id: string): Promise<boolean> {
    return this.receipts.has(item_id);
  }

  async verificationSummary(_claim_id: string): Promise<VerificationSummary> {
    return {
      questions_answered: 2,
      matched: 2,
      overall: 100,
      id_required: false,
    };
  }
}
