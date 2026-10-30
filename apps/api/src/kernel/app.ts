import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { logger } from './logger.js';
import { initDb, DatabaseContext } from './db.js';
import { authMiddleware } from './auth.js';
import { ApiError } from './errors.js';
import { AppPorts } from './ports.js';
import { AuditStub } from './stubs/audit-stub.js';
import { HandoverStub } from './stubs/handover-stub.js';
import { RiskStub } from './stubs/risk-stub.js';
import { WorkflowStub } from './stubs/workflow-stub.js';
import { CoreServicesStub } from './stubs/core-services-stub.js';
import { MatchingStub } from './stubs/matching-stub.js';
import { runMigrations } from './migration-runner.js';

export interface AppContext {
  db: DatabaseContext;
  logger: typeof logger;
  config: typeof config;
  ports: AppPorts;
}

export interface ModuleExports {
  providePorts?: (ctx: AppContext) => Partial<AppPorts>;
  register: (app: Express, ctx: AppContext) => void | Promise<void>;
}

export async function createApp(options?: {
  forceMemoryDb?: boolean;
  overridePorts?: Partial<AppPorts>;
  skipMigrations?: boolean;
}): Promise<{ app: Express; ctx: AppContext }> {
  const app = express();

  // Basic security and parsing middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(authMiddleware);

  // Initialize DB
  const db = await initDb(options?.forceMemoryDb);

  // Default Stubs
  const ports: AppPorts = {
    audit: new AuditStub(),
    handover: new HandoverStub(),
    risk: new RiskStub(),
    workflow: new WorkflowStub(),
    core: new CoreServicesStub(),
    matching: new MatchingStub(),
    ...(options?.overridePorts || {}),
  };

  const ctx: AppContext = {
    db,
    logger,
    config,
    ports,
  };

  // Run migrations if not skipped
  if (!options?.skipMigrations) {
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const candidates = [
        path.resolve(currentDir, '../../db/migrations'),
        path.resolve(process.cwd(), 'db/migrations'),
        path.resolve(process.cwd(), 'apps/api/db/migrations'),
        path.resolve(process.cwd(), '../apps/api/db/migrations'),
      ];
      const migrationsDir = candidates.find((c) => fs.existsSync(c)) || candidates[0];
      await runMigrations(db, migrationsDir);
    } catch (migErr: any) {
      logger.warn(`Migration runner notice: ${migErr.message}`);
    }
  }

  // Auto-discover modules in ../modules/
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const modulesDir = path.resolve(currentDir, '../modules');

  const loadedModules: Array<{ name: string; mod: ModuleExports }> = [];

  if (fs.existsSync(modulesDir)) {
    const moduleFolders = fs
      .readdirSync(modulesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const folder of moduleFolders) {
      try {
        const moduleIndexPath = path.join(modulesDir, folder, 'index.ts');
        const moduleJsPath = path.join(modulesDir, folder, 'index.js');
        const targetPath = fs.existsSync(moduleIndexPath)
          ? moduleIndexPath
          : fs.existsSync(moduleJsPath)
          ? moduleJsPath
          : null;

        if (targetPath) {
          const mod = (await import(targetPath)) as ModuleExports;
          loadedModules.push({ name: folder, mod });

          // Merge ports provided by module
          if (typeof mod.providePorts === 'function') {
            const customPorts = mod.providePorts(ctx);
            for (const [k, v] of Object.entries(customPorts)) {
              if (!options?.overridePorts || !(k in options.overridePorts)) {
                (ctx.ports as any)[k] = v;
              }
            }
            logger.info(`Module '${folder}' provided custom ports: ${Object.keys(customPorts).join(', ')}`);
          }
        }
      } catch (err: any) {
        logger.error(`Failed to load module '${folder}': ${err.message}`);
      }
    }

    // Register routes for all discovered modules
    for (const { name, mod } of loadedModules) {
      if (typeof mod.register === 'function') {
        await mod.register(app, ctx);
        logger.info(`Module '${name}' registered successfully`);
      }
    }
  }

  // Health endpoint
  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'campus-recoverer-api',
      memory_db: db.isMemory,
      modules: loadedModules.map((m) => m.name),
    });
  });

  // Central error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    logger.error(err, 'Unhandled error encountered');
    const statusCode = err.status || err.statusCode || 500;
    const code = err.code || 'INTERNAL_SERVER_ERROR';
    const message = statusCode === 500 ? 'Internal Server Error' : err.message;

    return res.status(statusCode).json({
      error: {
        code,
        message,
      },
    });
  });

  return { app, ctx };
}
