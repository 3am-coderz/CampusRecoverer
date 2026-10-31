export type Role = 'STUDENT' | 'FINDER' | 'SECURITY' | 'ADMIN';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type ItemStatus =
  | 'PENDING_HANDOVER'
  | 'WAITING_PERIOD'
  | 'OPEN_FOR_CLAIMS'
  | 'UNDER_REVIEW'
  | 'APPROVED_AWAITING_COLLECTION'
  | 'COLLECTED'
  | 'EXPIRED'
  | 'STORED_LONG_TERM'
  | 'DONATED'
  | 'DISPOSED';

export type ClaimStatus =
  | 'SUBMITTED'
  | 'SCORED'
  | 'MANUAL_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'COLLECTED';

export type AuditAction =
  | 'ITEM_REPORTED'
  | 'ITEM_RECEIVED'
  | 'ITEM_VERIFIED'
  | 'CLAIM_CREATED'
  | 'CLAIM_SCORED'
  | 'QUESTIONS_ANSWERED'
  | 'CLAIM_APPROVED'
  | 'CLAIM_REJECTED'
  | 'QR_GENERATED'
  | 'QR_VERIFIED'
  | 'ITEM_COLLECTED'
  | 'ITEM_EXPIRED'
  | 'DISPOSITION_DECIDED'
  | 'DISPUTE_FLAGGED'
  | 'HIDDEN_DATA_VIEWED';

export type CustodyEvent =
  | 'REPORTED'
  | 'RECEIVED_BY_SECURITY'
  | 'STORED'
  | 'CLAIMED'
  | 'RELEASED';

export interface AuditLogPayload {
  actor_id: string;
  action: AuditAction;
  item_id?: string;
  claim_id?: string;
  metadata?: Record<string, any>;
}

export interface AuditPort {
  log(payload: AuditLogPayload): Promise<void>;
}

export interface HandoverIssueResult {
  handover_id: string;
  expires_at: string;
  otp?: string;
}

export interface HandoverVerifyParams {
  qr_token: string;
  otp: string;
  security_id: string;
  id_verified: boolean;
}

export interface HandoverVerifyResult {
  item_id: string;
  claim_id: string;
}

export interface HandoverPort {
  issue(claim_id: string, options?: { tx?: any }): Promise<HandoverIssueResult>;
  verifyAndRelease(params: HandoverVerifyParams): Promise<HandoverVerifyResult>;
}

export interface RiskPort {
  classify(category: string, hidden_attributes?: Record<string, any>): RiskLevel;
}

export interface ClaimScoreUpdate {
  claim_id: string;
  status: ClaimStatus;
}

export interface ResolveClaimsResult {
  item_status: ItemStatus;
  claim_updates: ClaimScoreUpdate[];
  multi_high_confidence: boolean;
}

export interface VerificationSummary {
  questions_answered: number;
  matched: number;
  overall: number;
  id_required: boolean;
}

export interface CustodyRecordParams {
  item_id: string;
  event: CustodyEvent;
  actor_id: string;
  location?: string;
}

export interface WorkflowPort {
  assertItemTransition(from: ItemStatus, to: ItemStatus): void;
  assertClaimTransition(from: ClaimStatus, to: ClaimStatus): void;
  resolveClaims(item_id: string): Promise<ResolveClaimsResult>;
  recordCustody(params: CustodyRecordParams): Promise<void>;
  hasReceipt(item_id: string): Promise<boolean>;
  verificationSummary(claim_id: string): Promise<VerificationSummary>;
}

export interface NotificationPayload {
  user_id: string;
  title: string;
  message: string;
}

export interface CoreServicesPort {
  getItem(id: string): Promise<any>;
  getClaim(id: string): Promise<any>;
  listClaimsForItem(item_id: string): Promise<any[]>;
  setItemStatus(id: string, status: ItemStatus): Promise<void>;
  setClaimStatus(id: string, status: ClaimStatus): Promise<void>;
  markCollected(claim_id: string, item_id: string): Promise<void>;
  createNotification(payload: NotificationPayload): Promise<void>;
}

export interface MatchScoreResult {
  structured_score: number;
  semantic_score: number;
  final_score: number;
  match_score: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  ml_used: boolean;
  explanation: string[];
}

export interface SimilarityResult {
  similarity: number;
  matched: boolean;
}

export interface MatchingPort {
  score(item: any, claim: any): Promise<MatchScoreResult>;
  similarity(pairs: Array<{ expected: string; given: string }>): Promise<SimilarityResult[]>;
}

export interface AppPorts {
  audit: AuditPort;
  handover: HandoverPort;
  risk: RiskPort;
  workflow: WorkflowPort;
  core: CoreServicesPort;
  matching: MatchingPort;
}
