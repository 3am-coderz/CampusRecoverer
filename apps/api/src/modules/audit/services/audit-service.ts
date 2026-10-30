import crypto from 'crypto';
import { DatabaseContext } from '../../../kernel/db.js';
import { AuditPort, AuditLogPayload } from '../../../kernel/ports.js';
import { logger } from '../../../kernel/logger.js';
import { BadRequestError } from '../../../kernel/errors.js';

export interface AuditQueryParams {
  action?: string;
  event_type?: string;
  actor_id?: string;
  entity_type?: string;
  entity_id?: string;
  item_id?: string;
  claim_id?: string;
  start_time?: string;
  from?: string;
  end_time?: string;
  to?: string;
  limit?: number | string;
  offset?: number | string;
}

export interface AuditRecord {
  id: string;
  actor_id: string;
  event_type: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  item_id: string | null;
  claim_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AuditQueryResult {
  events: AuditRecord[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

const EXCLUDE_KEYS = new Set([
  'hidden_description',
  'hidden_attributes',
  'private_ownership',
]);

const SENSITIVE_CREDENTIAL_KEYS = new Set([
  'qr_token',
  'raw_qr',
  'otp',
  'raw_otp',
  'otp_code',
  'password',
  'password_hash',
  'pass',
  'token',
  'secret',
  'jwt_secret',
  'session_secret',
  'internal_api_key',
  'api_key',
  'authorization',
  'auth_header',
  'auth_token',
  'jwt',
]);

export function sanitizeAuditMetadata(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') {
    return {};
  }
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (item && typeof item === 'object' && !(item instanceof Date)) {
        return sanitizeAuditMetadata(item);
      }
      return item;
    }) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();

    // 1. Exclude private item details completely
    if (
      EXCLUDE_KEYS.has(lower) ||
      lower.includes('hidden_description') ||
      lower.includes('hidden_attributes')
    ) {
      continue;
    }

    // 2. Redact credentials
    const isCredential =
      SENSITIVE_CREDENTIAL_KEYS.has(lower) ||
      lower.includes('password') ||
      lower.includes('secret') ||
      lower.includes('qr_token') ||
      lower.includes('api_key') ||
      lower.includes('auth_token') ||
      lower === 'otp' ||
      lower.startsWith('otp_') ||
      lower.endsWith('_otp') ||
      lower.includes('otp_code') ||
      lower === 'token' ||
      lower.endsWith('_token');

    if (isCredential) {
      clean[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      clean[key] = sanitizeAuditMetadata(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export class AuditService implements AuditPort {
  constructor(private readonly db: DatabaseContext) {}

  async log(payload: AuditLogPayload): Promise<void> {
    if (!payload.actor_id) {
      throw new Error('Audit log requires an actor_id');
    }
    if (!payload.action) {
      throw new Error('Audit log requires an action');
    }

    const id = 'aud_' + crypto.randomBytes(8).toString('hex');
    const sanitizedMetadata = sanitizeAuditMetadata(payload.metadata || {});

    // Infer entity_type and entity_id
    let entityType: string | null = null;
    let entityId: string | null = null;

    if (payload.claim_id) {
      entityType = 'claim';
      entityId = payload.claim_id;
    } else if (payload.item_id) {
      entityType = 'item';
      entityId = payload.item_id;
    }

    try {
      await this.db.query(
        `INSERT INTO audit_logs (
          id, actor_id, action, entity_type, entity_id, item_id, claim_id, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
        [
          id,
          payload.actor_id,
          payload.action,
          entityType,
          entityId,
          payload.item_id || null,
          payload.claim_id || null,
          JSON.stringify(sanitizedMetadata),
        ],
      );

      logger.info(
        { action: payload.action, actor_id: payload.actor_id, id },
        '[AuditService] Log recorded',
      );
    } catch (err: any) {
      logger.error(
        { err, payload },
        `[AuditService] Failed to persist audit log: ${err.message}`,
      );
      // Fail-closed policy: rethrow error so security-sensitive operations
      // do not falsely report success if audit persistence failed
      throw err;
    }
  }

  async queryLogs(params: AuditQueryParams): Promise<AuditQueryResult> {
    // 1. Validate pagination
    let limit = 50;
    if (params.limit !== undefined) {
      const parsed = Number(params.limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        throw new BadRequestError(
          'Limit must be an integer between 1 and 100',
          'INVALID_PAGINATION',
        );
      }
      limit = parsed;
    }

    let offset = 0;
    if (params.offset !== undefined) {
      const parsed = Number(params.offset);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new BadRequestError(
          'Offset must be a non-negative integer',
          'INVALID_PAGINATION',
        );
      }
      offset = parsed;
    }

    // 2. Validate dates
    const rawStart = params.start_time || params.from;
    const rawEnd = params.end_time || params.to;

    let startDate: Date | null = null;
    if (rawStart) {
      startDate = new Date(rawStart);
      if (isNaN(startDate.getTime())) {
        throw new BadRequestError(
          `Invalid start date: ${rawStart}`,
          'INVALID_DATE',
        );
      }
    }

    let endDate: Date | null = null;
    if (rawEnd) {
      endDate = new Date(rawEnd);
      if (isNaN(endDate.getTime())) {
        throw new BadRequestError(
          `Invalid end date: ${rawEnd}`,
          'INVALID_DATE',
        );
      }
    }

    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestError(
        'Start timestamp cannot be after end timestamp',
        'INVALID_DATE_RANGE',
      );
    }

    // 3. Build parameterized query
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let idx = 1;

    const actionFilter = params.action || params.event_type;
    if (actionFilter) {
      whereClause += ` AND action = $${idx++}`;
      queryParams.push(actionFilter);
    }

    if (params.actor_id) {
      whereClause += ` AND actor_id = $${idx++}`;
      queryParams.push(params.actor_id);
    }

    if (params.entity_type) {
      whereClause += ` AND entity_type = $${idx++}`;
      queryParams.push(params.entity_type);
    }

    if (params.entity_id) {
      whereClause += ` AND entity_id = $${idx++}`;
      queryParams.push(params.entity_id);
    }

    if (params.item_id) {
      whereClause += ` AND item_id = $${idx++}`;
      queryParams.push(params.item_id);
    }

    if (params.claim_id) {
      whereClause += ` AND claim_id = $${idx++}`;
      queryParams.push(params.claim_id);
    }

    if (startDate) {
      whereClause += ` AND created_at >= $${idx++}`;
      queryParams.push(startDate.toISOString());
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${idx++}`;
      queryParams.push(endDate.toISOString());
    }

    // Count total matches
    const countSql = `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`;
    const countRes = await this.db.query(countSql, queryParams);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Fetch paginated events
    const selectSql = `
      SELECT id, actor_id, action, entity_type, entity_id, item_id, claim_id, metadata, created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    const paginatedParams = [...queryParams, limit, offset];
    const res = await this.db.query(selectSql, paginatedParams);

    const events: AuditRecord[] = res.rows.map((row) => ({
      id: row.id,
      actor_id: row.actor_id,
      event_type: row.action,
      action: row.action,
      entity_type: row.entity_type ?? null,
      entity_id: row.entity_id ?? null,
      item_id: row.item_id ?? null,
      claim_id: row.claim_id ?? null,
      metadata:
        typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata || {},
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
    }));

    return {
      events,
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }
}
