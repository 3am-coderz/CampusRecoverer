import crypto from 'crypto';

export const GENESIS_HASH = '0'.repeat(64);

export interface RowHashInput {
  prev_hash: string;
  seq: number | string;
  actor_id: string;
  action: string;
  item_id?: string | null;
  claim_id?: string | null;
  metadata: Record<string, any>;
  created_at: string | Date;
}

export function computeRowHash(input: RowHashInput): string {
  const sha = crypto.createHash('sha256');
  const dateStr = typeof input.created_at === 'string'
    ? input.created_at
    : new Date(input.created_at).toISOString();

  // Canonical string representation
  const payload = [
    input.prev_hash,
    String(input.seq),
    input.actor_id,
    input.action,
    input.item_id || '',
    input.claim_id || '',
    JSON.stringify(input.metadata || {}),
    dateStr,
  ].join('|');

  sha.update(payload);
  return sha.digest('hex');
}
