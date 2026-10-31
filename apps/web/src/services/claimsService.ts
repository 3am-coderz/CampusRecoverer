import { apiClient } from '../kernel/client';
import { Claim } from '../kernel/types';

export interface SubmitClaimData {
  item_id: string;
  description: string;
  claimed_attributes: Record<string, any>;
  lost_date: string;
  lost_location: string;
}

export interface GetClaimsParams {
  item_id?: string;
  claimant_id?: string;
  status?: string;
}

export const claimsService = {
  async submitClaim(data: SubmitClaimData): Promise<Claim> {
    const res = await apiClient.post<{ claim: Claim }>('/claims', data);
    return res.claim;
  },

  async getClaims(params?: GetClaimsParams): Promise<Claim[]> {
    const query = new URLSearchParams();
    if (params?.item_id) query.append('item_id', params.item_id);
    if (params?.claimant_id) query.append('claimant_id', params.claimant_id);
    if (params?.status) query.append('status', params.status);

    const qs = query.toString();
    const res = await apiClient.get<{ claims: Claim[] }>(`/claims${qs ? `?${qs}` : ''}`);
    return res.claims || [];
  },

  async getClaim(id: string): Promise<Claim> {
    const res = await apiClient.get<{ claim: Claim }>(`/claims/${id}`);
    return res.claim;
  },
};
