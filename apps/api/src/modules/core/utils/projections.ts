import { ItemStatus, RiskLevel } from '../../../kernel/ports.js';

export interface PublicItemProjection {
  id: string;
  category: string;
  public_description: string;
  found_location_public: string;
  found_date: string;
  status: ItemStatus;
  risk_level: RiskLevel;
  security_verified: boolean;
  created_at: string;
}

export function toPublicItem(row: any): PublicItemProjection {
  return {
    id: row.id,
    category: row.category,
    public_description: row.public_description,
    found_location_public: row.found_location_public,
    found_date: typeof row.found_date === 'string' ? row.found_date : new Date(row.found_date).toISOString(),
    status: row.status,
    risk_level: row.risk_level,
    security_verified: Boolean(row.security_verified),
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
  };
}

export function toDetailedItem(row: any, requestingUser?: { id: string; role: string }) {
  const isPrivileged = requestingUser && (requestingUser.role === 'SECURITY' || requestingUser.role === 'ADMIN');
  const isFinder = requestingUser && requestingUser.id === row.finder_id;

  if (isPrivileged || isFinder) {
    return {
      ...toPublicItem(row),
      hidden_description: row.hidden_description,
      hidden_attributes: typeof row.hidden_attributes === 'string' ? JSON.parse(row.hidden_attributes) : row.hidden_attributes,
      finder_id: row.finder_id,
    };
  }

  return toPublicItem(row);
}
