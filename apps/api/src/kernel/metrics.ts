import express, { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'campus_api_' });

const requests = new client.Counter({
  name: 'campus_api_http_requests_total',
  help: 'HTTP requests handled by the CampusRecoverer API.',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});

const requestDuration = new client.Histogram({
  name: 'campus_api_http_request_duration_seconds',
  help: 'HTTP request duration in seconds for the CampusRecoverer API.',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export function collectRequestMetrics(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint();

  res.once('finish', () => {
    // Use Express route templates, never raw URLs, IDs, query strings, or bodies.
    const routePath = req.route?.path;
    const route = typeof routePath === 'string' ? `${req.baseUrl}${routePath}` : 'unmatched';
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    const elapsedSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;

    requests.inc(labels);
    requestDuration.observe(labels, elapsedSeconds);
  });

  next();
}

export async function metricsEndpoint(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  } catch (err) {
    next(err);
  }
}

export function createMetricsApp(): express.Express {
  const metricsApp = express();
  metricsApp.get('/metrics', metricsEndpoint);
  return metricsApp;
}
