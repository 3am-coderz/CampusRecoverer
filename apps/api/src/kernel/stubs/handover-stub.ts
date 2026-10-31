import { HandoverPort, HandoverIssueResult, HandoverVerifyParams, HandoverVerifyResult } from '../ports.js';
import { BadRequestError } from '../errors.js';

export class HandoverStub implements HandoverPort {
  private activeTokens: Map<string, { claim_id: string; otp: string; expires_at: string }> = new Map();

  async issue(claim_id: string, _options?: { tx?: any }): Promise<HandoverIssueResult> {
    const handover_id = 'ho_stub_' + Math.random().toString(36).substring(2, 9);
    const expires_at = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const otp = '123456';
    const qr_token = 'token_' + handover_id;

    this.activeTokens.set(qr_token, { claim_id, otp, expires_at });

    return {
      handover_id,
      expires_at,
      otp,
    };
  }

  async verifyAndRelease(params: HandoverVerifyParams): Promise<HandoverVerifyResult> {
    const record = this.activeTokens.get(params.qr_token);
    if (!record || record.otp !== params.otp) {
      throw new BadRequestError('Invalid QR token or OTP', 'INVALID_HANDOVER_CREDENTIALS');
    }
    return {
      item_id: 'item_stub_123',
      claim_id: record.claim_id,
    };
  }
}
