import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AppContext } from '../../../kernel/app.js';
import { BadRequestError, UnauthorizedError } from '../../../kernel/errors.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['STUDENT', 'FINDER', 'SECURITY', 'ADMIN']).default('STUDENT'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class AuthController {
  private ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0].message);
      }
      const { email, password, name, role } = parsed.data;

      // Check if user already exists
      const existing = await this.ctx.db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        throw new BadRequestError('A user with this email already exists', 'EMAIL_TAKEN');
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const userId = 'usr_' + Math.random().toString(36).substring(2, 10);

      await this.ctx.db.query(
        `INSERT INTO users (id, email, password_hash, name, role, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [userId, email, passwordHash, name, role],
      );

      const user = { id: userId, email, name, role, created_at: new Date().toISOString() };
      const token = jwt.sign(
        { sub: user.id, email: user.email, role: user.role, name: user.name },
        this.ctx.config.jwtSecret,
        { expiresIn: '7d' },
      );

      res.status(201).json({ user, token });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0].message);
      }
      const { email, password } = parsed.data;

      const resDb = await this.ctx.db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (resDb.rows.length === 0) {
        throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
      }

      const userRow = resDb.rows[0];
      const valid = await bcrypt.compare(password, userRow.password_hash);
      if (!valid) {
        throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
      }

      const user = {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        role: userRow.role,
        created_at: userRow.created_at,
      };

      const token = jwt.sign(
        { sub: user.id, email: user.email, role: user.role, name: user.name },
        this.ctx.config.jwtSecret,
        { expiresIn: '7d' },
      );

      res.status(200).json({ user, token });
    } catch (err) {
      next(err);
    }
  };

  logout = async (_req: Request, res: Response) => {
    res.status(200).json({ success: true });
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }
      const resDb = await this.ctx.db.query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [
        req.user.id,
      ]);
      if (resDb.rows.length === 0) {
        throw new UnauthorizedError('User not found');
      }
      res.status(200).json({ user: resDb.rows[0] });
    } catch (err) {
      next(err);
    }
  };
}
