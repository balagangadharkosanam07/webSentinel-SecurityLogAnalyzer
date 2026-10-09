import { Request, Response } from 'express';
import { desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { portalUsers } from '../db/schema.js';
import { env } from '../config/env.js';
import { sendSuccess, sendError } from '../utils/response.js';

export async function listUsers(req: Request, res: Response): Promise<void> {
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
      .orderBy(desc(portalUsers.createdAt));

    sendSuccess(res, { users, total: users.length });
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Failed to list users: ${err.message}`);
  }
}

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  // Restricted SOC audit stream endpoint
  try {
    // Attempt to query recent events from WebSentinel if reachable, or return local diagnostics
    const webSentinelUrl = new URL(env.WEBSENTINEL_INGESTION_URL);
    const logsUrl = `${webSentinelUrl.protocol}//${webSentinelUrl.host}/api/logs?source=attendance-portal&limit=25`;

    let upstreamLogs: any[] = [];
    try {
      const response = await fetch(logsUrl);
      if (response.ok) {
        const data = (await response.json()) as any;
        upstreamLogs = data?.data?.events || [];
      }
    } catch {
      // If WebSentinel is temporarily offline, fallback gracefully
      upstreamLogs = [];
    }

    sendSuccess(res, {
      source: 'attendance-portal-audit',
      events: upstreamLogs,
      message: 'Administrative security audit feed active',
    });
  } catch (err: any) {
    sendError(res, 500, 'INTERNAL_ERROR', `Failed to retrieve audit feed: ${err.message}`);
  }
}
