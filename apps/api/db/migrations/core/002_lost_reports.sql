-- Private lost-item reports are not public listings and are only readable by their owner.
CREATE TABLE IF NOT EXISTS lost_reports (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  identifying_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  lost_location VARCHAR(255) NOT NULL,
  lost_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lost_reports_user_created
  ON lost_reports(user_id, created_at DESC);
