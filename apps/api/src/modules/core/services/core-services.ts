import { DatabaseContext } from '../../../kernel/db.js';
import { CoreServicesPort, ItemStatus, ClaimStatus, NotificationPayload } from '../../../kernel/ports.js';
import { NotFoundError } from '../../../kernel/errors.js';

export class CoreServices implements CoreServicesPort {
  private db: DatabaseContext;

  constructor(db: DatabaseContext) {
    this.db = db;
  }

  async getItem(id: string): Promise<any> {
    const res = await this.db.query('SELECT * FROM items WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      throw new NotFoundError(`Item with ID ${id} not found`, 'ITEM_NOT_FOUND');
    }
    const item = res.rows[0];
    if (typeof item.hidden_attributes === 'string') {
      try { item.hidden_attributes = JSON.parse(item.hidden_attributes); } catch {}
    }
    return item;
  }

  async getClaim(id: string): Promise<any> {
    const res = await this.db.query('SELECT * FROM claims WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      throw new NotFoundError(`Claim with ID ${id} not found`, 'CLAIM_NOT_FOUND');
    }
    const claim = res.rows[0];
    if (typeof claim.claimed_attributes === 'string') {
      try { claim.claimed_attributes = JSON.parse(claim.claimed_attributes); } catch {}
    }
    return claim;
  }

  async listClaimsForItem(item_id: string): Promise<any[]> {
    const res = await this.db.query(
      'SELECT * FROM claims WHERE item_id = $1 ORDER BY created_at DESC',
      [item_id],
    );
    return res.rows.map((row: any) => {
      if (typeof row.claimed_attributes === 'string') {
        try { row.claimed_attributes = JSON.parse(row.claimed_attributes); } catch {}
      }
      return row;
    });
  }

  async setItemStatus(id: string, status: ItemStatus): Promise<void> {
    const res = await this.db.query('UPDATE items SET status = $1 WHERE id = $2', [status, id]);
    if (res.rowCount === 0) {
      throw new NotFoundError(`Item with ID ${id} not found`, 'ITEM_NOT_FOUND');
    }
  }

  async setClaimStatus(id: string, status: ClaimStatus): Promise<void> {
    const res = await this.db.query('UPDATE claims SET status = $1 WHERE id = $2', [status, id]);
    if (res.rowCount === 0) {
      throw new NotFoundError(`Claim with ID ${id} not found`, 'CLAIM_NOT_FOUND');
    }
  }

  async markCollected(claim_id: string, item_id: string, options?: { tx?: any }): Promise<void> {
    const executor = options?.tx || this.db;
    const resClaim = await executor.query('UPDATE claims SET status = $1 WHERE id = $2', ['COLLECTED', claim_id]);
    if (resClaim.rowCount === 0) {
      throw new NotFoundError(`Claim with ID ${claim_id} not found`, 'CLAIM_NOT_FOUND');
    }
    const resItem = await executor.query('UPDATE items SET status = $1 WHERE id = $2', ['COLLECTED', item_id]);
    if (resItem.rowCount === 0) {
      throw new NotFoundError(`Item with ID ${item_id} not found`, 'ITEM_NOT_FOUND');
    }
  }

  async createNotification(payload: NotificationPayload): Promise<void> {
    const notifId = 'notif_' + Math.random().toString(36).substring(2, 10);
    await this.db.query(
      `INSERT INTO notifications (id, user_id, title, message, read, created_at)
       VALUES ($1, $2, $3, $4, FALSE, CURRENT_TIMESTAMP)`,
      [notifId, payload.user_id, payload.title, payload.message],
    );
  }
}
