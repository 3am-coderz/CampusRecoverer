import crypto from 'crypto';
import QRCode from 'qrcode';
import { DatabaseContext } from '../../../kernel/db.js';
import {
  HandoverPort,
  HandoverIssueResult,
  HandoverVerifyParams,
  HandoverVerifyResult,
} from '../../../kernel/ports.js';
import { BadRequestError, NotFoundError } from '../../../kernel/errors.js';
import { AppContext } from '../../../kernel/app.js';

export function deriveQrToken(secret: string, handoverId: string, claimId: string, issuedAt: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${handoverId}:${claimId}:${issuedAt}`);
  return hmac.digest('hex');
}

export function hmacHash(secret: string, value: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(value);
  return hmac.digest('hex');
}

function safeCompareHex(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) return false;
  const aBuf = Buffer.from(aHex, 'hex');
  const bBuf = Buffer.from(bHex, 'hex');
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export class HandoverService implements HandoverPort {
  private ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  async issue(claimId: string, options?: { tx?: any }): Promise<HandoverIssueResult> {
    const claim = await this.ctx.ports.core.getClaim(claimId);
    const secret = this.ctx.config.handoverSecret;
    const handoverId = 'ho_' + Math.random().toString(36).substring(2, 10);
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + this.ctx.config.handoverExpiryHours * 3600 * 1000,
    ).toISOString();

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const qrToken = deriveQrToken(secret, handoverId, claimId, issuedAt);
    const qrTokenHash = hmacHash(secret, qrToken);
    const otpHash = hmacHash(secret, otp);

    const executor = options?.tx || this.ctx.db;
    await executor.query(
      `INSERT INTO handovers (
        id, item_id, claim_id, claimant_id, qr_token_hash, otp_hash,
        issued_at, expires_at, attempts, locked
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, FALSE)`,
      [
        handoverId,
        claim.item_id,
        claimId,
        claim.claimant_id,
        qrTokenHash,
        otpHash,
        issuedAt,
        expiresAt,
      ],
    );

    await this.ctx.ports.audit.log({
      actor_id: 'system:handover',
      action: 'QR_GENERATED',
      item_id: claim.item_id,
      claim_id: claimId,
      metadata: { handover_id: handoverId, expires_at: expiresAt },
    });

    return {
      handover_id: handoverId,
      expires_at: expiresAt,
      otp,
    };
  }

  async getQrForClaim(
    claimId: string,
    claimantId: string,
  ): Promise<{ qr_token: string; qr_png_base64: string; expires_at: string }> {
    const claim = await this.ctx.ports.core.getClaim(claimId);
    if (claim.claimant_id !== claimantId) {
      throw new BadRequestError('Only the approved claimant can retrieve collection credentials', 'UNAUTHORIZED_CLAIMANT');
    }
    if (claim.status !== 'APPROVED') {
      throw new BadRequestError(`Cannot retrieve QR code: claim status is ${claim.status}.`, 'CLAIM_NOT_APPROVED');
    }

    const res = await this.ctx.db.query(
      'SELECT * FROM handovers WHERE claim_id = $1 ORDER BY issued_at DESC LIMIT 1',
      [claimId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundError('Handover credentials not found for this claim');
    }

    const row = res.rows[0];
    if (row.collected_at) {
      throw new BadRequestError('Item has already been collected', 'ALREADY_COLLECTED');
    }
    if (new Date() > new Date(row.expires_at)) {
      throw new BadRequestError('Handover credentials have expired', 'CREDENTIALS_EXPIRED');
    }
    if (row.locked) {
      throw new BadRequestError('Handover is locked due to failed attempts', 'HANDOVER_LOCKED');
    }

    const secret = this.ctx.config.handoverSecret;
    const qrToken = deriveQrToken(secret, row.id, claimId, new Date(row.issued_at).toISOString());
    const qrPngBase64 = await QRCode.toDataURL(qrToken, { width: 300 });

    return {
      qr_token: qrToken,
      qr_png_base64: qrPngBase64,
      expires_at: row.expires_at,
    };
  }

  async verifyAndRelease(params: HandoverVerifyParams): Promise<HandoverVerifyResult> {
    const { qr_token, otp, security_id, id_verified } = params;
    const secret = this.ctx.config.handoverSecret;
    const inputTokenHash = hmacHash(secret, qr_token);
    const inputOtpHash = hmacHash(secret, otp);

    const res = await this.ctx.db.query(
      'SELECT * FROM handovers WHERE qr_token_hash = $1',
      [inputTokenHash],
    );

    if (res.rows.length === 0) {
      throw new BadRequestError('Invalid QR token', 'INVALID_QR_TOKEN');
    }

    const handover = res.rows[0];

    if (handover.locked) {
      throw new BadRequestError('Handover is locked due to security attempts limit', 'HANDOVER_LOCKED');
    }
    if (handover.collected_at) {
      throw new BadRequestError('Item has already been collected with this token', 'ALREADY_COLLECTED');
    }
    if (new Date() > new Date(handover.expires_at)) {
      throw new BadRequestError('Handover credentials have expired', 'CREDENTIALS_EXPIRED');
    }

    // Verify claim state
    const claim = await this.ctx.ports.core.getClaim(handover.claim_id);
    if (claim.status !== 'APPROVED') {
      throw new BadRequestError(`Claim status is ${claim.status}. Only APPROVED claims can be collected.`, 'INVALID_CLAIM_STATE');
    }

    // Verify item state
    const item = await this.ctx.ports.core.getItem(handover.item_id);
    if (item.status !== 'APPROVED_AWAITING_COLLECTION') {
      throw new BadRequestError(`Item status is ${item.status}. Expected APPROVED_AWAITING_COLLECTION.`, 'INVALID_ITEM_STATE');
    }

    // High risk ID verification check
    if (item.risk_level === 'HIGH' && !id_verified) {
      throw new BadRequestError(
        'Government or campus photo ID verification is mandatory for release of HIGH-risk items.',
        'PHOTO_ID_VERIFICATION_REQUIRED',
      );
    }

    // Constant-time compare OTP hash
    const otpMatches = safeCompareHex(inputOtpHash, handover.otp_hash);

    if (!otpMatches) {
      const newAttempts = handover.attempts + 1;
      const willLock = newAttempts >= 5;

      await this.ctx.db.query(
        'UPDATE handovers SET attempts = $1, locked = $2 WHERE id = $3',
        [newAttempts, willLock, handover.id],
      );

      if (willLock) {
        await this.ctx.ports.audit.log({
          actor_id: security_id,
          action: 'DISPUTE_FLAGGED',
          item_id: handover.item_id,
          claim_id: handover.claim_id,
          metadata: { reason: 'Exceeded 5 failed OTP attempts. Handover locked.' },
        });
        throw new BadRequestError(
          'Maximum verification attempts exceeded. Handover locked for security review.',
          'MAX_ATTEMPTS_EXCEEDED',
        );
      }

      throw new BadRequestError(
        `Invalid OTP verification code. Attempt ${newAttempts} of 5.`,
        'INVALID_OTP',
      );
    }

    // Success! Update handover record
    await this.ctx.db.query(
      `UPDATE handovers
       SET collected_at = CURRENT_TIMESTAMP, security_id = $1
       WHERE id = $2`,
      [security_id, handover.id],
    );

    // Update claim and item to COLLECTED
    await this.ctx.ports.core.markCollected(handover.claim_id, handover.item_id);

    // Record custody release
    await this.ctx.ports.workflow.recordCustody({
      item_id: handover.item_id,
      event: 'RELEASED',
      actor_id: security_id,
      location: 'Security Lost & Found Desk',
    });

    // Audits
    await this.ctx.ports.audit.log({
      actor_id: security_id,
      action: 'QR_VERIFIED',
      item_id: handover.item_id,
      claim_id: handover.claim_id,
      metadata: { id_verified },
    });

    await this.ctx.ports.audit.log({
      actor_id: security_id,
      action: 'ITEM_COLLECTED',
      item_id: handover.item_id,
      claim_id: handover.claim_id,
      metadata: { collector_id: handover.claimant_id },
    });

    return {
      item_id: handover.item_id,
      claim_id: handover.claim_id,
    };
  }
}
