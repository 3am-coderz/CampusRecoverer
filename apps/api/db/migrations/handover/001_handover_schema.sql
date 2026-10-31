-- Handover Module Schema

CREATE TABLE IF NOT EXISTS handovers (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claim_id VARCHAR(64) NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  claimant_id VARCHAR(64) NOT NULL REFERENCES users(id),
  security_id VARCHAR(64) REFERENCES users(id),
  qr_token_hash VARCHAR(128) NOT NULL,
  otp_hash VARCHAR(128) NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  collected_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_handovers_claim ON handovers(claim_id);
CREATE INDEX IF NOT EXISTS idx_handovers_item ON handovers(item_id);
CREATE INDEX IF NOT EXISTS idx_handovers_qr_hash ON handovers(qr_token_hash);
