import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/campus_recoverer',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-campus-recoverer-jwt-key-2026',
  internalApiKey: process.env.INTERNAL_API_KEY || 'internal-matching-key-xyz',
  matchingServiceUrl: process.env.MATCHING_SERVICE_URL || 'http://localhost:8000',
  handoverSecret: process.env.HANDOVER_SECRET || 'handover-hmac-secret-salt-2026',
  handoverExpiryHours: parseInt(process.env.HANDOVER_EXPIRY_HOURS || '48', 10),
  waitingPeriods: {
    LOW: parseInt(process.env.WAITING_PERIOD_LOW_HOURS || '24', 10),
    MEDIUM: parseInt(process.env.WAITING_PERIOD_MEDIUM_HOURS || '48', 10),
    HIGH: parseInt(process.env.WAITING_PERIOD_HIGH_HOURS || '72', 10),
  },
  highConfidenceThreshold: parseFloat(process.env.HIGH_CONFIDENCE_THRESHOLD || '80'),
  conflictMargin: parseFloat(process.env.CONFLICT_MARGIN || '5'),
  retentionPeriodDays: parseInt(process.env.RETENTION_PERIOD_DAYS || '30', 10),
};
