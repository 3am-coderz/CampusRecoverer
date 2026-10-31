import { DatabaseContext } from '../../../kernel/db.js';
import { CustodyRecordParams } from '../../../kernel/ports.js';

export class CustodyService {
  private db: DatabaseContext;

  constructor(db: DatabaseContext) {
    this.db = db;
  }

  async record(params: CustodyRecordParams): Promise<void> {
    const eventId = 'cust_' + Math.random().toString(36).substring(2, 10);
    await this.db.query(
      `INSERT INTO custody_events (id, item_id, event, actor_id, location, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [eventId, params.item_id, params.event, params.actor_id, params.location || null],
    );
  }

  async hasReceipt(itemId: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM custody_events
       WHERE item_id = $1 AND event = 'RECEIVED_BY_SECURITY'
       LIMIT 1`,
      [itemId],
    );
    return res.rows.length > 0;
  }

  async getTimeline(itemId: string): Promise<any[]> {
    const res = await this.db.query(
      `SELECT c.*, u.name as actor_name, u.role as actor_role
       FROM custody_events c
       JOIN users u ON c.actor_id = u.id
       WHERE c.item_id = $1
       ORDER BY c.created_at ASC`,
      [itemId],
    );
    return res.rows;
  }
}
