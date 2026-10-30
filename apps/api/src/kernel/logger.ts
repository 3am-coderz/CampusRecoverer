import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'password',
      'otp',
      'qr_token',
      'hidden_description',
      'hidden_attributes',
      'answer',
      'expected',
    ],
    remove: true,
  },
});
