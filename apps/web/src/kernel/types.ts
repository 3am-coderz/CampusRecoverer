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

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

export interface ItemPublic {
  id: string;
  category: string;
  public_description: string;
  found_location_public: string;
  found_date: string;
  status: ItemStatus;
  risk_level: RiskLevel;
  security_verified: boolean;
  created_at: string;
}

export interface ItemDetail extends ItemPublic {
  hidden_description?: string;
  hidden_attributes?: Record<string, any>;
  finder_id?: string;
}

export interface Claim {
  id: string;
  item_id: string;
  claimant_id: string;
  description: string;
  claimed_attributes: Record<string, any>;
  lost_date: string;
  lost_location: string;
  structured_score: number;
  semantic_score: number;
  final_score: number;
  confidence_label: 'LOW' | 'MEDIUM' | 'HIGH';
  status: ClaimStatus;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  seq: number;
  actor_id: string;
  action: string;
  item_id?: string | null;
  claim_id?: string | null;
  metadata: Record<string, any>;
  created_at: string;
  prev_hash: string;
  row_hash: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
