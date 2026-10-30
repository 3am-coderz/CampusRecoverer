import {
  CoreServicesPort,
  ItemStatus,
  ClaimStatus,
  NotificationPayload,
} from '../ports.js';
import { NotFoundError } from '../errors.js';

export class CoreServicesStub implements CoreServicesPort {
  public items: Map<string, any> = new Map();
  public claims: Map<string, any> = new Map();
  public notifications: Array<NotificationPayload & { id: string; created_at: string }> = [];

  async getItem(id: string): Promise<any> {
    const item = this.items.get(id);
    if (!item) throw new NotFoundError(`Item ${id} not found`, 'ITEM_NOT_FOUND');
    return item;
  }

  async getClaim(id: string): Promise<any> {
    const claim = this.claims.get(id);
    if (!claim) throw new NotFoundError(`Claim ${id} not found`, 'CLAIM_NOT_FOUND');
    return claim;
  }

  async listClaimsForItem(item_id: string): Promise<any[]> {
    return Array.from(this.claims.values()).filter((c) => c.item_id === item_id);
  }

  async setItemStatus(id: string, status: ItemStatus): Promise<void> {
    const item = await this.getItem(id);
    item.status = status;
    this.items.set(id, item);
  }

  async setClaimStatus(id: string, status: ClaimStatus): Promise<void> {
    const claim = await this.getClaim(id);
    claim.status = status;
    this.claims.set(id, claim);
  }

  async markCollected(claim_id: string, item_id: string, _options?: { tx?: any }): Promise<void> {
    await this.setClaimStatus(claim_id, 'COLLECTED');
    await this.setItemStatus(item_id, 'COLLECTED');
  }

  async createNotification(payload: NotificationPayload): Promise<void> {
    this.notifications.push({
      ...payload,
      id: 'notif_' + Math.random().toString(36).substring(2, 9),
      created_at: new Date().toISOString(),
    });
  }
}
