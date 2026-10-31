import { apiClient } from '../kernel/client';
import { Claim, ItemDetail } from '../kernel/types';

export interface DeskVerifyData {
  claimId: string;
  qrToken: string;
  otp: string;
  photoIdVerified?: boolean;
}

export interface DeskVerifyResult {
  success: boolean;
  item: ItemDetail;
  claim: Claim;
  handoverEvent?: any;
}

export interface ClaimQrResponse {
  qrToken: string;
  expiresAt: string;
  status: string;
}

export const handoverService = {
  async receiveItem(itemId: string, securityNotes?: string): Promise<{ item: ItemDetail; handoverEvent: any }> {
    const res = await apiClient.post('/handover/finder-receive', {
      itemId,
      securityNotes,
    });
    return res;
  },

  async getClaimQr(claimId: string): Promise<ClaimQrResponse> {
    const res = await apiClient.get<ClaimQrResponse>(`/handover/claims/${claimId}/qr`);
    return res;
  },

  async deskVerify(data: DeskVerifyData): Promise<DeskVerifyResult> {
    const res = await apiClient.post<DeskVerifyResult>('/handover/desk-verify', data);
    return res;
  },
};
