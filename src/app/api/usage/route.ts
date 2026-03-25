import { NextResponse } from 'next/server';
import { db, messages, threads, projects } from '@/lib/db';
import { eq, sql, desc, count, and, gte } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

const SESSIONS_PATH = process.env.OPENCLAW_SESSIONS_PATH ||
  path.join(process.env.HOME || '/home/ubuntu', '.openclaw/agents/main/sessions');

interface SessionData {
  sessionId: string;
  updatedAt: number;
  totalTokens?: number;
  contextTokens?: number;
  compactionCount?: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

/**
 * GET /api/usage
 *
 * Aggregates token usage from sessions.json + message/project data from SQLite.
 */
export async function GET() {
  try {
    // 1. Read sessions.json
    let sessionsMap: Record<string, SessionData> = {};
    try {
      const raw = await fs.readFile(path.join(SESSIONS_PATH, 'sessions.json'), 'utf-8');
      sessionsMap = JSON.parse(raw);
    } catch {
      // sessions.json missing or corrupt — continue with empty
    }

    // 2. Aggregate session stats for clawdify sessions by project ID
    //    Session keys: agent:main:clawdify:<projectId> or agent:main:clawdify:<projectId>:<threadId>
    const projectSessions: Record<string, {
      totalTokens: number;
      compactionCount: number;
      model: string | null;
      sessionCount: number;
      lastUpdated: number;
      inputTokens: number;
      outputTokens: number;
      cacheRead: number;
      cacheWrite: number;
    }> = {};

    let totalSessionTokens = 0;
    let totalCompactions = 0;
    let clawdifySessionCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;

    for (const [key, session] of Object.entries(sessionsMap)) {
      // Match clawdify session keys
      const match = key.match(/^agent:main:clawdify:([a-f0-9-]+)/);
      if (!match) continue;

      const projectId = match[1];
      clawdifySessionCount++;

      const tokens = session.totalTokens || 0;
      const compactions = session.compactionCount || 0;
      const input = session.inputTokens || 0;
      const output = session.outputTokens || 0;
      const cacheR = session.cacheRead || 0;
      const cacheW = session.cacheWrite || 0;

      totalSessionTokens += tokens;
      totalCompactions += compactions;
      totalInputTokens += input;
      totalOutputTokens += output;
      totalCacheRead += cacheR;
      totalCacheWrite += cacheW;

      if (!projectSessions[projectId]) {
        projectSessions[projectId] = {
          totalTokens: 0,
          compactionCount: 0,
          model: null,
          sessionCount: 0,
          lastUpdated: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheRead: 0,
          cacheWrite: 0,
        };
      }

      const ps = projectSessions[projectId];
      ps.totalTokens += tokens;
      ps.compactionCount += compactions;
      ps.sessionCount++;
      ps.inputTokens += input;
      ps.outputTokens += output;
      ps.cacheRead += cacheR;
      ps.cacheWrite += cacheW;
      if (session.model) ps.model = session.model;
      if (session.updatedAt > ps.lastUpdated) ps.lastUpdated = session.updatedAt;
    }

    // 3. Get total message count
    const totalMessagesResult = db
      .select({ count: count() })
      .from(messages)
      .get();
    const totalMessages = totalMessagesResult?.count || 0;

    // 4. Get per-project message breakdown with latest activity
    const projectMessageStats = db
      .select({
        projectId: projects.id,
        projectName: projects.name,
        projectIcon: projects.icon,
        projectStatus: projects.status,
        messageCount: count(messages.id),
        lastActivity: sql<number>`MAX(${messages.createdAt})`,
      })
      .from(messages)
      .innerJoin(threads, eq(messages.threadId, threads.id))
      .innerJoin(projects, eq(threads.projectId, projects.id))
      .groupBy(projects.id)
      .orderBy(desc(count(messages.id)))
      .all();

    // 5. Build per-project breakdown
    const projectBreakdown = projectMessageStats.map((row) => {
      const sess = projectSessions[row.projectId];
      return {
        projectId: row.projectId,
        name: row.projectName,
        icon: row.projectIcon,
        status: row.projectStatus,
        messageCount: row.messageCount,
        totalTokens: sess?.totalTokens || 0,
        compactionCount: sess?.compactionCount || 0,
        model: sess?.model || null,
        sessionCount: sess?.sessionCount || 0,
        inputTokens: sess?.inputTokens || 0,
        outputTokens: sess?.outputTokens || 0,
        cacheRead: sess?.cacheRead || 0,
        cacheWrite: sess?.cacheWrite || 0,
        lastActivity: row.lastActivity
          ? typeof row.lastActivity === 'object'
            ? (row.lastActivity as Date).toISOString()
            : new Date(Number(row.lastActivity) * 1000).toISOString()
          : null,
      };
    });

    // 6. Per-day message activity (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    fourteenDaysAgo.setHours(0, 0, 0, 0);
    const cutoffTs = Math.floor(fourteenDaysAgo.getTime() / 1000);

    const dailyMessages = db
      .select({
        day: sql<string>`date(${messages.createdAt}, 'unixepoch')`,
        role: messages.role,
        count: count(),
      })
      .from(messages)
      .where(gte(messages.createdAt, new Date(cutoffTs * 1000)))
      .groupBy(sql`date(${messages.createdAt}, 'unixepoch')`, messages.role)
      .orderBy(sql`date(${messages.createdAt}, 'unixepoch')`)
      .all();

    // Build day map for all 14 days
    const dayMap: Record<string, { user: number; assistant: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = { user: 0, assistant: 0 };
    }

    for (const row of dailyMessages) {
      const day = row.day;
      if (!dayMap[day]) dayMap[day] = { user: 0, assistant: 0 };
      if (row.role === 'user') dayMap[day].user = row.count;
      if (row.role === 'assistant') dayMap[day].assistant = row.count;
    }

    const dailyActivity = Object.entries(dayMap).map(([date, counts]) => ({
      date,
      user: counts.user,
      assistant: counts.assistant,
      total: counts.user + counts.assistant,
    }));

    // 7. Role breakdown
    const roleBreakdown = db
      .select({
        role: messages.role,
        count: count(),
      })
      .from(messages)
      .groupBy(messages.role)
      .all();

    return NextResponse.json({
      summary: {
        totalMessages,
        totalSessions: clawdifySessionCount,
        totalTokens: totalSessionTokens,
        totalCompactions,
        totalInputTokens,
        totalOutputTokens,
        totalCacheRead,
        totalCacheWrite,
      },
      projects: projectBreakdown,
      dailyActivity,
      roleBreakdown,
    });
  } catch (error) {
    console.error('[usage] Error:', error);
    return NextResponse.json(
      { error: 'Failed to compute usage stats' },
      { status: 500 }
    );
  }
}
