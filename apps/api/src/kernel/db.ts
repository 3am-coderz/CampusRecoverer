import pg from 'pg';
import { newDb, IMemoryDb } from 'pg-mem';
import { config } from './config.js';
import { logger } from './logger.js';

const { Pool } = pg;

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  release(): void;
}

export interface DatabaseContext {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  getClient(): Promise<DbClient>;
  transaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T>;
  isMemory: boolean;
  close(): Promise<void>;
}

let realPool: pg.Pool | null = null;
let memDb: IMemoryDb | null = null;
let memPool: any = null;
let activeDb: DatabaseContext | null = null;

export async function initDb(forceMemory = false): Promise<DatabaseContext> {
  if (activeDb) return activeDb;

  if (!forceMemory && process.env.NODE_ENV !== 'test') {
    try {
      realPool = new Pool({
        connectionString: config.databaseUrl,
        connectionTimeoutMillis: 1500,
      });

      // Probe connection
      const client = await realPool.connect();
      await client.query('SELECT 1');
      client.release();

      logger.info('Connected to PostgreSQL database');
      activeDb = {
        query: async <T = any>(sql: string, params?: any[]) => {
          const res: any = await realPool!.query(sql, params);
          if (Array.isArray(res)) {
            const last = res[res.length - 1];
            return { rows: (last?.rows || []) as T[], rowCount: last?.rowCount ?? (last?.rows?.length || 0) };
          }
          return { rows: (res?.rows || []) as T[], rowCount: res?.rowCount ?? (res?.rows ? res.rows.length : 0) };
        },
        getClient: async () => {
          const c = await realPool!.connect();
          return {
            query: async <T = any>(sql: string, params?: any[]) => {
              const res: any = await c.query(sql, params);
              if (Array.isArray(res)) {
                const last = res[res.length - 1];
                return { rows: (last?.rows || []) as T[], rowCount: last?.rowCount ?? (last?.rows?.length || 0) };
              }
              return { rows: (res?.rows || []) as T[], rowCount: res?.rowCount ?? (res?.rows ? res.rows.length : 0) };
            },
            release: () => c.release(),
          };
        },
        transaction: async <T>(fn: (client: DbClient) => Promise<T>): Promise<T> => {
          const client = await activeDb!.getClient();
          try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
        },
        isMemory: false,
        close: async () => {
          if (realPool) await realPool.end();
          activeDb = null;
        },
      };
      return activeDb;
    } catch (err: any) {
      logger.warn(`PostgreSQL unavailable (${err.message}). Falling back to in-memory PostgreSQL engine.`);
      if (realPool) {
        try { await realPool.end(); } catch {}
        realPool = null;
      }
    }
  }

  // Fallback or test mode: pg-mem
  memDb = newDb();
  // Register pgcrypto / uuid extensions if needed
  memDb.public.registerFunction({
    name: 'gen_random_uuid',
    implementation: () => 'uuid-' + Math.random().toString(36).substring(2, 12),
  });

  memPool = memDb.adapters.createPg().Pool;
  const poolInstance = new memPool();

  activeDb = {
    query: async <T = any>(sql: string, params?: any[]) => {
      const res = await poolInstance.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
    },
    getClient: async () => {
      const c = await poolInstance.connect();
      return {
        query: async <T = any>(sql: string, params?: any[]) => {
          const res = await c.query(sql, params);
          return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
        },
        release: () => c.release(),
      };
    },
    transaction: async <T>(fn: (client: DbClient) => Promise<T>): Promise<T> => {
      const client = await activeDb!.getClient();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    isMemory: true,
    close: async () => {
      activeDb = null;
    },
  };

  return activeDb;
}

export function getDb(): DatabaseContext {
  if (!activeDb) {
    throw new Error('Database not initialized. Call initDb() before accessing getDb().');
  }
  return activeDb;
}
