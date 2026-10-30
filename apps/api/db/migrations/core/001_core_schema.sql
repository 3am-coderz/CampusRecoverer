-- Core Module Schema: Users, Items, Claims, Notifications

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('STUDENT', 'FINDER', 'SECURITY', 'ADMIN')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(64) PRIMARY KEY,
  category VARCHAR(64) NOT NULL,
  public_description TEXT NOT NULL,
  hidden_description TEXT NOT NULL,
  hidden_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  found_location_public VARCHAR(255) NOT NULL,
  found_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(64) NOT NULL CHECK (
    status IN (
      'PENDING_HANDOVER',
      'WAITING_PERIOD',
      'OPEN_FOR_CLAIMS',
      'UNDER_REVIEW',
      'APPROVED_AWAITING_COLLECTION',
      'COLLECTED',
      'EXPIRED',
      'STORED_LONG_TERM',
      'DONATED',
      'DISPOSED'
    )
  ),
  risk_level VARCHAR(16) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  security_verified BOOLEAN NOT NULL DEFAULT FALSE,
  finder_id VARCHAR(64) NOT NULL REFERENCES users(id),
  waiting_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_finder ON items(finder_id);

CREATE TABLE IF NOT EXISTS claims (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claimant_id VARCHAR(64) NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  claimed_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  lost_date TIMESTAMP WITH TIME ZONE NOT NULL,
  lost_location VARCHAR(255) NOT NULL,
  structured_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  semantic_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  final_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  confidence_label VARCHAR(16) NOT NULL CHECK (confidence_label IN ('LOW', 'MEDIUM', 'HIGH')),
  status VARCHAR(32) NOT NULL CHECK (
    status IN (
      'SUBMITTED',
      'SCORED',
      'MANUAL_REVIEW',
      'APPROVED',
      'REJECTED',
      'WITHDRAWN',
      'COLLECTED'
    )
  ),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_active_claim_per_item UNIQUE (claimant_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_claims_item ON claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
