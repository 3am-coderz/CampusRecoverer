import { apiClient } from '../kernel/client';
import { AuditLogEntry } from '../kernel/types';

export interface GetAuditLogsParams {
  actor_id?: string;
  action?: string;
  item_id?: string;
  claim_id?: string;
  limit?: number;
  offset?: number;
}

export interface VerifyChainResult {
  valid: boolean;
  totalRows: number;
  brokenAtSeq?: number | null;
}

export const auditService = {
  async getAuditLogs(params?: GetAuditLogsParams): Promise<AuditLogEntry[]> {
    const query = new URLSearchParams();
    if (params?.actor_id) query.append('actor_id', params.actor_id);
    if (params?.action) query.append('action', params.action);
    if (params?.item_id) query.append('item_id', params.item_id);
    if (params?.claim_id) query.append('claim_id', params.claim_id);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    const qs = query.toString();
    const res = await apiClient.get<{ logs: AuditLogEntry[] }>(`/audit${qs ? `?${qs}` : ''}`);
    return res.logs || [];
  },

  async verifyAuditChain(): Promise<VerifyChainResult> {
    const res = await apiClient.get<VerifyChainResult>('/audit/verify');
    return res;
  },
};
