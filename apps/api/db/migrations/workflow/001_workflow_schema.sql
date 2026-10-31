-- Workflow Module Schema: Custody, Verification Answers, Disputes, Dispositions

CREATE TABLE IF NOT EXISTS custody_events (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  event VARCHAR(64) NOT NULL CHECK (event IN ('REPORTED', 'RECEIVED_BY_SECURITY', 'STORED', 'CLAIMED', 'RELEASED')),
  actor_id VARCHAR(64) NOT NULL REFERENCES users(id),
  location VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custody_events_item ON custody_events(item_id);

CREATE TABLE IF NOT EXISTS claim_answers (
  id VARCHAR(64) PRIMARY KEY,
  claim_id VARCHAR(64) NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  question_id VARCHAR(64) NOT NULL,
  matched BOOLEAN NOT NULL DEFAULT FALSE,
  similarity NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claim_answers_claim ON claim_answers(claim_id);

CREATE TABLE IF NOT EXISTS disputes (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  claim_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disputes_item ON disputes(item_id);

CREATE TABLE IF NOT EXISTS disposition_decisions (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  decision VARCHAR(32) NOT NULL CHECK (decision IN ('STORE', 'DONATE', 'DISPOSE')),
  notes TEXT,
  decided_by VARCHAR(64) NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispositions_item ON disposition_decisions(item_id);
