import { NextRequest, NextResponse } from 'next/server';
import { db, messages, threads, projects, tasks, auditLogs } from '@/lib/db';
import { eq, desc, and, gt, ne } from 'drizzle-orm';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

const CRON_DIR = path.join(process.env.HOME || '/root', '.openclaw', 'cron');
const JOBS_FILE = path.join(CRON_DIR, 'jobs.json');
const RUNS_DIR = path.join(CRON_DIR, 'runs');

interface ActivityEntry {
  id: string;
  type: string;
  title: string;
  detail: string;
  projectName: string;
  projectIcon: string;
  timestamp: string;
}

interface CronJob {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface CronRun {
  ts: number;
  jobId: string;
  status?: string;
  error?: string;
  summary?: string;
  durationMs?: number;
  [key: string]: unknown;
}

async function getRecentMessages(since?: Date): Promise<ActivityEntry[]> {
  try {
    let query = db
      .select({
        id: messages.id,
        content: messages.content,
        createdAt: messages.createdAt,
        projectName: projects.name,
        projectIcon: projects.icon,
      })
      .from(messages)
      .innerJoin(threads, eq(messages.threadId, threads.id))
      .innerJoin(projects, eq(threads.projectId, projects.id))
      .where(
        since
          ? and(eq(messages.role, 'assistant'), gt(messages.createdAt, since))
          : eq(messages.role, 'assistant')
      )
      .orderBy(desc(messages.createdAt))
      .limit(50);

    const rows = query.all();
    return rows.map((row) => ({
      id: `msg-${row.id}`,
      type: 'message',
      title: (row.content || '').slice(0, 100).replace(/\n/g, ' '),
      detail: row.projectName,
      projectName: row.projectName,
      projectIcon: row.projectIcon || '📁',
      timestamp: row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt as unknown as number).toISOString(),
    }));
  } catch (err) {
    console.error('Error fetching recent messages:', err);
    return [];
  }
}

async function getRecentTasks(since?: Date): Promise<ActivityEntry[]> {
  try {
    const sevenDaysAgo = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        projectName: projects.name,
        projectIcon: projects.icon,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(gt(tasks.updatedAt, sevenDaysAgo))
      .orderBy(desc(tasks.updatedAt))
      .limit(50)
      .all();

    return rows.map((row) => {
      const createdTs = row.createdAt instanceof Date
        ? row.createdAt.getTime()
        : (row.createdAt as unknown as number);
      const updatedTs = row.updatedAt instanceof Date
        ? row.updatedAt.getTime()
        : (row.updatedAt as unknown as number);

      // Determine type: if created ~= updated, it's new; if status is done, it's completed
      let type = 'task_updated';
      if (Math.abs(createdTs - updatedTs) < 5000) {
        type = 'task_created';
      } else if (row.status === 'done') {
        type = 'task_completed';
      }

      const timestamp = row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : new Date(updatedTs).toISOString();

      return {
        id: `task-${row.id}`,
        type,
        title: row.title,
        detail: `${row.projectName} · ${row.status}`,
        projectName: row.projectName,
        projectIcon: row.projectIcon || '📁',
        timestamp,
      };
    });
  } catch (err) {
    console.error('Error fetching recent tasks:', err);
    return [];
  }
}

async function getCronRuns(since?: Date): Promise<ActivityEntry[]> {
  try {
    // Read job names
    let jobMap: Record<string, string> = {};
    try {
      const raw = await readFile(JOBS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      for (const job of (data.jobs || []) as CronJob[]) {
        jobMap[job.id] = job.name;
      }
    } catch {
      // No jobs file
      return [];
    }

    // Read run files
    let files: string[] = [];
    try {
      files = await readdir(RUNS_DIR);
    } catch {
      return [];
    }

    const entries: ActivityEntry[] = [];
    const sinceMs = since ? since.getTime() : 0;

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const jobId = file.replace('.jsonl', '');
      const jobName = jobMap[jobId] || jobId.slice(0, 8);

      try {
        const raw = await readFile(path.join(RUNS_DIR, file), 'utf-8');
        const lines = raw.trim().split('\n').filter(Boolean);
        const recent = lines.slice(-10);

        for (const line of recent) {
          try {
            const run = JSON.parse(line) as CronRun;
            if (sinceMs && run.ts < sinceMs) continue;

            const durationStr = run.durationMs
              ? `${(run.durationMs / 1000).toFixed(1)}s`
              : '';
            const statusStr = run.status === 'error' ? '❌ Error' : '✅ OK';
            const detail = [jobName, statusStr, durationStr].filter(Boolean).join(' · ');

            entries.push({
              id: `cron-${jobId}-${run.ts}`,
              type: 'cron_run',
              title: run.error
                ? `${jobName}: ${run.error.slice(0, 80)}`
                : `${jobName} completed`,
              detail,
              projectName: jobName,
              projectIcon: '⏰',
              timestamp: new Date(run.ts).toISOString(),
            });
          } catch {
            // Skip malformed line
          }
        }
      } catch {
        // Skip unreadable file
      }
    }

    return entries;
  } catch (err) {
    console.error('Error fetching cron runs:', err);
    return [];
  }
}

async function getAuditLogs(since?: Date): Promise<ActivityEntry[]> {
  try {
    const noiseActions = ['auth_login', 'auth_logout'];

    let rows = db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(50)
      .all();

    // Filter out noise and apply since
    rows = rows.filter((row) => {
      if (noiseActions.includes(row.action)) return false;
      if (since) {
        const ts = row.createdAt instanceof Date
          ? row.createdAt.getTime()
          : (row.createdAt as unknown as number);
        if (ts < since.getTime()) return false;
      }
      return true;
    }).slice(0, 20);

    return rows.map((row) => {
      let details = '';
      try {
        if (row.details) {
          const parsed = JSON.parse(row.details);
          details = parsed.description || parsed.message || row.action;
        }
      } catch {
        details = row.action;
      }

      const timestamp = row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt as unknown as number).toISOString();

      return {
        id: `audit-${row.id}`,
        type: 'audit',
        title: details || row.action,
        detail: row.action.replace(/_/g, ' '),
        projectName: '',
        projectIcon: '🔒',
        timestamp,
      };
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sinceParam = searchParams.get('since');
    const since = sinceParam ? new Date(sinceParam) : undefined;

    // Fetch all sources in parallel
    const [msgEntries, taskEntries, cronEntries, auditEntries] = await Promise.all([
      getRecentMessages(since),
      getRecentTasks(since),
      getCronRuns(since),
      getAuditLogs(since),
    ]);

    // Merge and sort
    const all = [...msgEntries, ...taskEntries, ...cronEntries, ...auditEntries];
    all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Return top 100
    const entries = all.slice(0, 100);

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Activity API error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
