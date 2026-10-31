import { DatabaseContext } from '../../../kernel/db.js';
import { BadRequestError } from '../../../kernel/errors.js';
import { ItemStatus, RiskLevel, ClaimStatus, Role } from '../../../kernel/ports.js';

export interface DashboardSummary {
  items: {
    total_reported: number;
    total_found: number;
    awaiting_verification: number;
    available_for_claims: number;
    by_status: Record<string, number>;
    by_risk_level: Record<string, number>;
  };
  claims: {
    total: number;
    total_lost: number;
    pending: number;
    approved: number;
    rejected: number;
    by_status: Record<string, number>;
  };
  handovers: {
    total: number;
    completed: number;
    locked: number;
    pending: number;
  };
  users: {
    total: number;
    by_role: Record<string, number>;
  };
  recent_activity: {
    items_last_24h: number;
    claims_last_24h: number;
    audit_events_last_24h: number;
  };
}

export interface AdminListItemsParams {
  limit?: number | string;
  offset?: number | string;
  status?: string;
  risk_level?: string;
  category?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}

export interface AdminItemRecord {
  id: string;
  category: string;
  public_description: string;
  found_location_public: string;
  found_date: string;
  status: ItemStatus;
  risk_level: RiskLevel;
  security_verified: boolean;
  finder_id: string;
  waiting_until: string | null;
  created_at: string;
}

export interface AdminListClaimsParams {
  limit?: number | string;
  offset?: number | string;
  status?: string;
  item_id?: string;
  claimant_id?: string;
  confidence_label?: string;
  start_date?: string;
  from?: string;
  end_date?: string;
  to?: string;
  sort_by?: string;
  sort_order?: string;
}

export interface AdminClaimRecord {
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
  confidence_label: string;
  status: ClaimStatus;
  created_at: string;
}

export interface AdminListUsersParams {
  limit?: number | string;
  offset?: number | string;
  role?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

const VALID_ITEM_STATUSES = new Set<string>([
  'PENDING_HANDOVER',
  'WAITING_PERIOD',
  'OPEN_FOR_CLAIMS',
  'UNDER_REVIEW',
  'APPROVED_AWAITING_COLLECTION',
  'COLLECTED',
  'EXPIRED',
  'STORED_LONG_TERM',
  'DONATED',
  'DISPOSED',
]);

const VALID_RISK_LEVELS = new Set<string>(['LOW', 'MEDIUM', 'HIGH']);

const VALID_CLAIM_STATUSES = new Set<string>([
  'SUBMITTED',
  'SCORED',
  'MANUAL_REVIEW',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
  'COLLECTED',
]);

const VALID_ROLES = new Set<string>(['STUDENT', 'FINDER', 'SECURITY', 'ADMIN']);

const ALLOWED_ITEM_SORTS = new Set<string>([
  'created_at',
  'found_date',
  'category',
  'status',
  'risk_level',
]);

const ALLOWED_CLAIM_SORTS = new Set<string>([
  'created_at',
  'lost_date',
  'final_score',
  'status',
]);

const ALLOWED_USER_SORTS = new Set<string>([
  'created_at',
  'email',
  'name',
  'role',
]);

function parsePagination(limitParam?: number | string, offsetParam?: number | string) {
  let limit = 50;
  if (limitParam !== undefined) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new BadRequestError('Limit must be an integer between 1 and 100', 'INVALID_PAGINATION');
    }
    limit = parsed;
  }

  let offset = 0;
  if (offsetParam !== undefined) {
    const parsed = Number(offsetParam);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestError('Offset must be a non-negative integer', 'INVALID_PAGINATION');
    }
    offset = parsed;
  }

  return { limit, offset };
}

export class AdminService {
  constructor(private readonly db: DatabaseContext) {}

  async getDashboardSummary(): Promise<DashboardSummary> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Items aggregates
    const itemsSummaryRes = await this.db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'PENDING_HANDOVER' THEN 1 ELSE 0 END) AS awaiting_verification,
        SUM(CASE WHEN status = 'OPEN_FOR_CLAIMS' THEN 1 ELSE 0 END) AS available_for_claims
      FROM items
    `);
    const itemCounts = itemsSummaryRes.rows[0] || {};
    const totalReportedItems = parseInt(itemCounts.total || '0', 10);
    const awaitingVerification = parseInt(itemCounts.awaiting_verification || '0', 10);
    const availableForClaims = parseInt(itemCounts.available_for_claims || '0', 10);

    const itemsStatusRes = await this.db.query(`
      SELECT status, COUNT(*) AS count
      FROM items
      GROUP BY status
    `);
    const itemsByStatus: Record<string, number> = {};
    for (const row of itemsStatusRes.rows) {
      itemsByStatus[row.status] = parseInt(row.count || '0', 10);
    }

    const itemsRiskRes = await this.db.query(`
      SELECT risk_level, COUNT(*) AS count
      FROM items
      GROUP BY risk_level
    `);
    const itemsByRisk: Record<string, number> = {};
    for (const row of itemsRiskRes.rows) {
      itemsByRisk[row.risk_level] = parseInt(row.count || '0', 10);
    }

    // 2. Claims aggregates
    const claimsSummaryRes = await this.db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('SUBMITTED', 'SCORED', 'MANUAL_REVIEW') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected
      FROM claims
    `);
    const claimCounts = claimsSummaryRes.rows[0] || {};
    const totalClaims = parseInt(claimCounts.total || '0', 10);
    const pendingClaims = parseInt(claimCounts.pending || '0', 10);
    const approvedClaims = parseInt(claimCounts.approved || '0', 10);
    const rejectedClaims = parseInt(claimCounts.rejected || '0', 10);

    const claimsStatusRes = await this.db.query(`
      SELECT status, COUNT(*) AS count
      FROM claims
      GROUP BY status
    `);
    const claimsByStatus: Record<string, number> = {};
    for (const row of claimsStatusRes.rows) {
      claimsByStatus[row.status] = parseInt(row.count || '0', 10);
    }

    // 3. Handovers aggregates
    const handoversSummaryRes = await this.db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN collected_at IS NOT NULL THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN locked = TRUE THEN 1 ELSE 0 END) AS locked,
        SUM(CASE WHEN collected_at IS NULL AND locked = FALSE THEN 1 ELSE 0 END) AS pending
      FROM handovers
    `);
    const handoverCounts = handoversSummaryRes.rows[0] || {};
    const totalHandovers = parseInt(handoverCounts.total || '0', 10);
    const completedHandovers = parseInt(handoverCounts.completed || '0', 10);
    const lockedHandovers = parseInt(handoverCounts.locked || '0', 10);
    const pendingHandovers = parseInt(handoverCounts.pending || '0', 10);

    // 4. Users aggregates
    const usersSummaryRes = await this.db.query(`
      SELECT COUNT(*) AS total FROM users
    `);
    const totalUsers = parseInt(usersSummaryRes.rows[0]?.total || '0', 10);

    const usersRoleRes = await this.db.query(`
      SELECT role, COUNT(*) AS count
      FROM users
      GROUP BY role
    `);
    const usersByRole: Record<string, number> = {};
    for (const row of usersRoleRes.rows) {
      usersByRole[row.role] = parseInt(row.count || '0', 10);
    }

    // 5. Recent activity (last 24 hours)
    const recentItemsRes = await this.db.query(
      `SELECT COUNT(*) AS count FROM items WHERE created_at >= $1`,
      [oneDayAgo],
    );
    const recentItems = parseInt(recentItemsRes.rows[0]?.count || '0', 10);

    const recentClaimsRes = await this.db.query(
      `SELECT COUNT(*) AS count FROM claims WHERE created_at >= $1`,
      [oneDayAgo],
    );
    const recentClaims = parseInt(recentClaimsRes.rows[0]?.count || '0', 10);

    let recentAuditEvents = 0;
    try {
      const recentAuditRes = await this.db.query(
        `SELECT COUNT(*) AS count FROM audit_logs WHERE created_at >= $1`,
        [oneDayAgo],
      );
      recentAuditEvents = parseInt(recentAuditRes.rows[0]?.count || '0', 10);
    } catch {
      recentAuditEvents = 0;
    }

    return {
      items: {
        total_reported: totalReportedItems,
        total_found: totalReportedItems,
        awaiting_verification: awaitingVerification,
        available_for_claims: availableForClaims,
        by_status: itemsByStatus,
        by_risk_level: itemsByRisk,
      },
      claims: {
        total: totalClaims,
        total_lost: totalClaims,
        pending: pendingClaims,
        approved: approvedClaims,
        rejected: rejectedClaims,
        by_status: claimsByStatus,
      },
      handovers: {
        total: totalHandovers,
        completed: completedHandovers,
        locked: lockedHandovers,
        pending: pendingHandovers,
      },
      users: {
        total: totalUsers,
        by_role: usersByRole,
      },
      recent_activity: {
        items_last_24h: recentItems,
        claims_last_24h: recentClaims,
        audit_events_last_24h: recentAuditEvents,
      },
    };
  }

  async listItems(params: AdminListItemsParams): Promise<{ items: AdminItemRecord[]; pagination: { limit: number; offset: number; total: number } }> {
    const { limit, offset } = parsePagination(params.limit, params.offset);

    if (params.status && !VALID_ITEM_STATUSES.has(params.status)) {
      throw new BadRequestError(`Invalid item status filter: ${params.status}`, 'INVALID_FILTER');
    }

    if (params.risk_level && !VALID_RISK_LEVELS.has(params.risk_level)) {
      throw new BadRequestError(`Invalid risk level filter: ${params.risk_level}`, 'INVALID_FILTER');
    }

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let idx = 1;

    if (params.status) {
      whereClause += ` AND status = $${idx++}`;
      queryParams.push(params.status);
    }

    if (params.risk_level) {
      whereClause += ` AND risk_level = $${idx++}`;
      queryParams.push(params.risk_level);
    }

    if (params.category) {
      whereClause += ` AND category ILIKE $${idx++}`;
      queryParams.push(`%${params.category}%`);
    }

    if (params.search) {
      whereClause += ` AND (public_description ILIKE $${idx} OR found_location_public ILIKE $${idx} OR category ILIKE $${idx})`;
      queryParams.push(`%${params.search}%`);
      idx++;
    }

    const countSql = `SELECT COUNT(*) AS total FROM items ${whereClause}`;
    const countRes = await this.db.query(countSql, queryParams);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const sortColumn = ALLOWED_ITEM_SORTS.has(String(params.sort_by)) ? String(params.sort_by) : 'created_at';
    const sortOrder = String(params.sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Note: hidden_description and hidden_attributes are strictly excluded for privacy
    const selectSql = `
      SELECT
        id, category, public_description, found_location_public, found_date,
        status, risk_level, security_verified, finder_id, waiting_until, created_at
      FROM items
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const selectParams = [...queryParams, limit, offset];
    const res = await this.db.query(selectSql, selectParams);

    const items: AdminItemRecord[] = res.rows.map((row) => ({
      id: row.id,
      category: row.category,
      public_description: row.public_description,
      found_location_public: row.found_location_public,
      found_date: row.found_date instanceof Date ? row.found_date.toISOString() : String(row.found_date),
      status: row.status,
      risk_level: row.risk_level,
      security_verified: Boolean(row.security_verified),
      finder_id: row.finder_id,
      waiting_until: row.waiting_until ? (row.waiting_until instanceof Date ? row.waiting_until.toISOString() : String(row.waiting_until)) : null,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));

    return {
      items,
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  async listClaims(params: AdminListClaimsParams): Promise<{ claims: AdminClaimRecord[]; pagination: { limit: number; offset: number; total: number } }> {
    const { limit, offset } = parsePagination(params.limit, params.offset);

    if (params.status && !VALID_CLAIM_STATUSES.has(params.status)) {
      throw new BadRequestError(`Invalid claim status filter: ${params.status}`, 'INVALID_FILTER');
    }

    const rawStart = params.start_date || params.from;
    const rawEnd = params.end_date || params.to;

    let startDate: Date | null = null;
    if (rawStart) {
      startDate = new Date(rawStart);
      if (isNaN(startDate.getTime())) {
        throw new BadRequestError(`Invalid start date: ${rawStart}`, 'INVALID_DATE');
      }
    }

    let endDate: Date | null = null;
    if (rawEnd) {
      endDate = new Date(rawEnd);
      if (isNaN(endDate.getTime())) {
        throw new BadRequestError(`Invalid end date: ${rawEnd}`, 'INVALID_DATE');
      }
    }

    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestError('Start date cannot be after end date', 'INVALID_DATE_RANGE');
    }

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let idx = 1;

    if (params.status) {
      whereClause += ` AND status = $${idx++}`;
      queryParams.push(params.status);
    }

    if (params.item_id) {
      whereClause += ` AND item_id = $${idx++}`;
      queryParams.push(params.item_id);
    }

    if (params.claimant_id) {
      whereClause += ` AND claimant_id = $${idx++}`;
      queryParams.push(params.claimant_id);
    }

    if (params.confidence_label) {
      whereClause += ` AND confidence_label = $${idx++}`;
      queryParams.push(params.confidence_label);
    }

    if (startDate) {
      whereClause += ` AND created_at >= $${idx++}`;
      queryParams.push(startDate.toISOString());
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${idx++}`;
      queryParams.push(endDate.toISOString());
    }

    const countSql = `SELECT COUNT(*) AS total FROM claims ${whereClause}`;
    const countRes = await this.db.query(countSql, queryParams);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const sortColumn = ALLOWED_CLAIM_SORTS.has(String(params.sort_by)) ? String(params.sort_by) : 'created_at';
    const sortOrder = String(params.sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const selectSql = `
      SELECT
        id, item_id, claimant_id, description, claimed_attributes,
        lost_date, lost_location, structured_score, semantic_score, final_score,
        confidence_label, status, created_at
      FROM claims
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const selectParams = [...queryParams, limit, offset];
    const res = await this.db.query(selectSql, selectParams);

    const claims: AdminClaimRecord[] = res.rows.map((row) => ({
      id: row.id,
      item_id: row.item_id,
      claimant_id: row.claimant_id,
      description: row.description,
      claimed_attributes: typeof row.claimed_attributes === 'string'
        ? (() => { try { return JSON.parse(row.claimed_attributes); } catch { return {}; } })()
        : row.claimed_attributes || {},
      lost_date: row.lost_date instanceof Date ? row.lost_date.toISOString() : String(row.lost_date),
      lost_location: row.lost_location,
      structured_score: parseFloat(row.structured_score) || 0,
      semantic_score: parseFloat(row.semantic_score) || 0,
      final_score: parseFloat(row.final_score) || 0,
      confidence_label: row.confidence_label,
      status: row.status,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));

    return {
      claims,
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  async listUsers(params: AdminListUsersParams): Promise<{ users: AdminUserRecord[]; pagination: { limit: number; offset: number; total: number } }> {
    const { limit, offset } = parsePagination(params.limit, params.offset);

    if (params.role && !VALID_ROLES.has(params.role)) {
      throw new BadRequestError(`Invalid role filter: ${params.role}`, 'INVALID_FILTER');
    }

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let idx = 1;

    if (params.role) {
      whereClause += ` AND role = $${idx++}`;
      queryParams.push(params.role);
    }

    if (params.search) {
      whereClause += ` AND (email ILIKE $${idx} OR name ILIKE $${idx})`;
      queryParams.push(`%${params.search}%`);
      idx++;
    }

    const countSql = `SELECT COUNT(*) AS total FROM users ${whereClause}`;
    const countRes = await this.db.query(countSql, queryParams);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const sortColumn = ALLOWED_USER_SORTS.has(String(params.sort_by)) ? String(params.sort_by) : 'created_at';
    const sortOrder = String(params.sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Note: password_hash is strictly omitted from the query
    const selectSql = `
      SELECT id, email, name, role, created_at
      FROM users
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const selectParams = [...queryParams, limit, offset];
    const res = await this.db.query(selectSql, selectParams);

    const users: AdminUserRecord[] = res.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));

    return {
      users,
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }
}
