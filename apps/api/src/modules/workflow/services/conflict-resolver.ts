import { DatabaseContext } from '../../../kernel/db.js';
import { ResolveClaimsResult, ClaimScoreUpdate } from '../../../kernel/ports.js';
import { config } from '../../../kernel/config.js';

export async function resolveItemClaims(
  itemId: string,
  db: DatabaseContext,
  auditLogFn?: (payload: any) => Promise<void>,
): Promise<ResolveClaimsResult> {
  const itemRes = await db.query('SELECT status FROM items WHERE id = $1', [itemId]);
  if (itemRes.rows.length === 0) {
    return { item_status: 'OPEN_FOR_CLAIMS', claim_updates: [], multi_high_confidence: false };
  }
  const currentItemStatus = itemRes.rows[0].status;

  const res = await db.query(
    `SELECT id, status, final_score FROM claims
     WHERE item_id = $1 AND status != 'REJECTED' AND status != 'WITHDRAWN' AND status != 'COLLECTED'
     ORDER BY final_score DESC`,
    [itemId],
  );

  const claims = res.rows.map((r: any) => ({
    id: r.id,
    status: r.status,
    final_score: parseFloat(r.final_score || '0'),
  }));

  if (claims.length < 2) {
    return {
      item_status: currentItemStatus,
      claim_updates: [],
      multi_high_confidence: false,
    };
  }

  const top1 = claims[0];
  const top2 = claims[1];

  const highThreshold = config.highConfidenceThreshold;
  const conflictMargin = config.conflictMargin;

  const bothHigh = top1.final_score >= highThreshold && top2.final_score >= highThreshold;
  const withinMargin = Math.abs(top1.final_score - top2.final_score) <= conflictMargin && top1.final_score >= 50.0;

  if (bothHigh || withinMargin) {
    const claimUpdates: ClaimScoreUpdate[] = [];

    for (const c of claims) {
      if (c.final_score >= highThreshold || Math.abs(top1.final_score - c.final_score) <= conflictMargin) {
        if (c.status !== 'MANUAL_REVIEW') {
          claimUpdates.push({ claim_id: c.id, status: 'MANUAL_REVIEW' });
        }
      }
    }

    if (auditLogFn) {
      await auditLogFn({
        actor_id: 'system:workflow',
        action: 'DISPUTE_FLAGGED',
        item_id: itemId,
        metadata: {
          reason: bothHigh
            ? 'Multiple high-confidence claims detected'
            : `Top claims within conflict margin (${top1.final_score} vs ${top2.final_score})`,
          conflicting_claim_ids: claimUpdates.map((u) => u.claim_id),
        },
      });
    }

    return {
      item_status: 'UNDER_REVIEW',
      claim_updates: claimUpdates,
      multi_high_confidence: true,
    };
  }

  return {
    item_status: currentItemStatus,
    claim_updates: [],
    multi_high_confidence: false,
  };
}
