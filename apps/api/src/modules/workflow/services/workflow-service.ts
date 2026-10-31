import {
  WorkflowPort,
  ItemStatus,
  ClaimStatus,
  ResolveClaimsResult,
  CustodyRecordParams,
  VerificationSummary,
} from '../../../kernel/ports.js';
import { AppContext } from '../../../kernel/app.js';
import { assertItemTransition, assertClaimTransition } from './state-machine.js';
import { resolveItemClaims } from './conflict-resolver.js';
import { CustodyService } from './custody-service.js';
import { QuestionsService } from './questions-service.js';

export class WorkflowService implements WorkflowPort {
  private ctx: AppContext;
  private custodyService: CustodyService;
  private questionsService: QuestionsService;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
    this.custodyService = new CustodyService(ctx.db);
    this.questionsService = new QuestionsService(ctx.db, ctx.ports.matching);
  }

  assertItemTransition(from: ItemStatus, to: ItemStatus): void {
    assertItemTransition(from, to);
  }

  assertClaimTransition(from: ClaimStatus, to: ClaimStatus): void {
    assertClaimTransition(from, to);
  }

  async resolveClaims(itemId: string): Promise<ResolveClaimsResult> {
    return resolveItemClaims(itemId, this.ctx.db, (payload) => this.ctx.ports.audit.log(payload));
  }

  async recordCustody(params: CustodyRecordParams): Promise<void> {
    await this.custodyService.record(params);
  }

  async hasReceipt(itemId: string): Promise<boolean> {
    return this.custodyService.hasReceipt(itemId);
  }

  async verificationSummary(claimId: string): Promise<VerificationSummary> {
    return this.questionsService.getVerificationSummary(claimId);
  }
}
