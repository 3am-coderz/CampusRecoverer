import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});

export const claimRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 claims per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many claim submissions. Please wait before submitting again.',
    },
  },
});
