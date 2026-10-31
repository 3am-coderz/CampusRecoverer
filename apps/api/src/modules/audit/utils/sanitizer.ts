const SENSITIVE_KEY_PATTERNS = [
  /^hidden_/i,
  /^serial_number$/i,
  /^otp$/i,
  /^qr_token$/i,
  /^answer/i,
  /^expected/i,
  /^password/i,
  /^token$/i,
];

export function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const sanitized: Record<string, any> = {};

  for (const [key, val] of Object.entries(metadata)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      continue;
    }

    if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = sanitizeMetadata(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}
