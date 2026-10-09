import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { portalUsers } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signJwt } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { sendSuccess, sendError } from '../utils/response.js';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['student', 'teacher', 'admin']).default('student'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function register(req: Request, res: Response): Promise<void> {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Invalid input');
    return;
  }

  const { name, email, password, role } = parseResult.data;

  try {
    const existing = await db
      .select()
      .from(portalUsers)
      .where(eq(portalUsers.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      sendError(res, 409, 'USER_EXISTS', 'A user with this email address already exists');
      return;
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    await db.insert(portalUsers).values({
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
    });

    const token = signJwt(
      {
        id: userId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role,
      },
      env.JWT_SECRET,
      '24h'
    );

    sendSuccess(
      res,
      {
        user: {
          id: userId,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          role,
        },
        token,
      },
      201
    );
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Registration failed: ${err.message}`);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendError(res, 400, 'VALIDATION_ERROR', parseResult.error.errors[0]?.message || 'Invalid input');
    return;
  }

  const { email, password } = parseResult.data;

  try {
    const users = await db
      .select()
      .from(portalUsers)
      .where(eq(portalUsers.email, email.toLowerCase().trim()))
      .limit(1);

    if (users.length === 0) {
      sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      return;
    }

    const user = users[0];
    const passwordMatches = verifyPassword(password, user.passwordHash);

    if (!passwordMatches) {
      sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      return;
    }

    const token = signJwt(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as 'student' | 'teacher' | 'admin',
      },
      env.JWT_SECRET,
      '24h'
    );

    sendSuccess(res, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Login transaction failed: ${err.message}`);
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    sendError(res, 401, 'UNAUTHORIZED', 'Not authenticated');
    return;
  }

  try {
    const users = await db
      .select({
        id: portalUsers.id,
        name: portalUsers.name,
        email: portalUsers.email,
        role: portalUsers.role,
        createdAt: portalUsers.createdAt,
      })
      .from(portalUsers)
      .where(eq(portalUsers.id, req.user.id))
      .limit(1);

    if (users.length === 0) {
      sendError(res, 404, 'USER_NOT_FOUND', 'User record not found');
      return;
    }

    sendSuccess(res, { user: users[0] });
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Failed to fetch profile: ${err.message}`);
  }
}
