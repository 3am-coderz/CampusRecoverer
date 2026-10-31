import { DatabaseContext } from '../../../kernel/db.js';
import { AuditPort, AuditLogPayload } from '../../../kernel/ports.js';
import { sanitizeMetadata } from '../utils/sanitizer.js';
import { computeRowHash, GENESIS_HASH } from '../utils/hasher.js';
import { logger } from '../../../kernel/logger.js';

export class AuditService implements AuditPort {
  private db: DatabaseContext;

  constructor(db: DatabaseContext) {
    this.db = db;
  }

  async log(payload: AuditLogPayload): Promise<void> {
    try {
      const sanitized = sanitizeMetadata(payload.metadata);
      const auditId = 'aud_' + Math.random().toString(36).substring(2, 11);
      const createdAt = new Date().toISOString();

      // Retrieve previous entry for hash chaining
      const latest = await this.db.query(
        'SELECT seq, row_hash FROM audit_logs ORDER BY seq DESC LIMIT 1',
      );

      let prevHash = GENESIS_HASH;
      let nextSeq = 1;

      if (latest.rows.length > 0) {
        prevHash = latest.rows[0].row_hash;
        nextSeq = Number(latest.rows[0].seq) + 1;
      }

      const rowHash = computeRowHash({
        prev_hash: prevHash,
        seq: nextSeq,
        actor_id: payload.actor_id,
        action: payload.action,
        item_id: payload.item_id || null,
        claim_id: payload.claim_id || null,
        metadata: sanitized,
        created_at: createdAt,
      });

      await this.db.query(
        `INSERT INTO audit_logs (
          id, seq, actor_id, action, item_id, claim_id, metadata, prev_hash, row_hash, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          auditId,
          nextSeq,
          payload.actor_id,
          payload.action,
          payload.item_id || null,
          payload.claim_id || null,
          JSON.stringify(sanitized),
          prevHash,
          rowHash,
          createdAt,
        ],
      );

      logger.info(
        { action: payload.action, seq: nextSeq, actor_id: payload.actor_id },
        '[AuditService] Event chained and committed',
      );
    } catch (err: any) {
      logger.error(`Failed to record audit log: ${err.message}`);
    }
  }

  async queryLogs(filters: {
    item_id?: string;
    claim_id?: string;
    actor_id?: string;
    action?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: any[]; total: number; page: number }> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as cnt FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (filters.item_id) {
      params.push(filters.item_id);
      const clause = ` AND item_id = $${params.length}`;
      sql += clause;
      countSql += clause;
    }

    if (filters.claim_id) {
      params.push(filters.claim_id);
      const clause = ` AND claim_id = $${params.length}`;
      sql += clause;
      countSql += clause;
    }

    if (filters.actor_id) {
      params.push(filters.actor_id);
      const clause = ` AND actor_id = $${params.length}`;
      sql += clause;
      countSql += clause;
    }

    if (filters.action) {
      params.push(filters.action);
      const clause = ` AND action = $${params.length}`;
      sql += clause;
      countSql += clause;
    }

    const countRes = await this.db.query(countSql, params.length > 0 ? params : undefined);
    const total = parseInt(countRes.rows[0]?.cnt || '0', 10);

    sql += ` ORDER BY seq DESC LIMIT ${limit} OFFSET ${offset}`;
    const res = await this.db.query(sql, params.length > 0 ? params : undefined);

    const logs = res.rows.map((row: any) => ({
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    }));

    return { logs, total, page };
  }

  async verifyChain(): Promise<{
    verified: boolean;
    total_entries: number;
    tampered_seqs: number[];
  }> {
    const res = await this.db.query('SELECT * FROM audit_logs ORDER BY seq ASC');
    const rows = res.rows;

    if (rows.length === 0) {
      return { verified: true, total_entries: 0, tampered_seqs: [] };
    }

    const tampered: number[] = [];
    let expectedPrevHash = GENESIS_HASH;

    for (const row of rows) {
      const seq = Number(row.seq);
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;

      // 1. Verify prev_hash link
      if (row.prev_hash !== expectedPrevHash) {
        tampered.push(seq);
      }

      // 2. Re-compute hash
      const computed = computeRowHash({
        prev_hash: row.prev_hash,
        seq: row.seq,
        actor_id: row.actor_id,
        action: row.action,
        item_id: row.item_id,
        claim_id: row.claim_id,
        metadata: meta,
        created_at: row.created_at,
      });

      if (computed !== row.row_hash) {
        if (!tampered.includes(seq)) tampered.push(seq);
      }

      expectedPrevHash = row.row_hash;
    }

    return {
      verified: tampered.length === 0,
      total_entries: rows.length,
      tampered_seqs: tampered,
    };
  }
}
