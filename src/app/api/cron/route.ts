import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
const JOBS_FILE = path.join(process.env.HOME || '/root', '.openclaw', 'cron', 'jobs.json');
const RUNS_DIR = path.join(process.env.HOME || '/root', '.openclaw', 'cron', 'runs');

interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: { kind: string; expr: string; tz?: string };
  sessionTarget?: string;
  payload?: { kind: string; message: string };
  delivery?: { mode: string };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: string;
    lastStatus?: string;
    lastDurationMs?: number;
    consecutiveErrors?: number;
    lastError?: string;
  };
  [key: string]: unknown;
}

async function readJobs(): Promise<CronJob[]> {
  try {
    const raw = await readFile(JOBS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return data.jobs || [];
  } catch {
    return [];
  }
}

async function readRuns(jobId: string, limit = 5): Promise<unknown[]> {
  try {
    const raw = await readFile(path.join(RUNS_DIR, `${jobId}.jsonl`), 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map(l => JSON.parse(l)).reverse();
  } catch {
    return [];
  }
}

export async function GET() {
  const jobs = await readJobs();

  // Attach last few runs to each job
  const jobsWithRuns = await Promise.all(
    jobs.map(async (job) => {
      const recentRuns = await readRuns(job.id, 3);
      return { ...job, recentRuns };
    })
  );

  return NextResponse.json({ jobs: jobsWithRuns });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, jobId } = body as { action: string; jobId: string };

  if (!action || !jobId) {
    return NextResponse.json({ error: 'Missing action or jobId' }, { status: 400 });
  }

  try {
    let args: string[];

    switch (action) {
      case 'enable':
        args = ['cron', 'enable', jobId];
        break;
      case 'disable':
        args = ['cron', 'disable', jobId];
        break;
      case 'run':
        args = ['cron', 'run', jobId];
        break;
      case 'delete':
        args = ['cron', 'rm', jobId, '--yes'];
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const { stdout, stderr } = await execFileAsync('openclaw', args, {
      timeout: 30000,
      env: { ...process.env },
    });

    return NextResponse.json({
      ok: true,
      action,
      jobId,
      output: stdout?.trim() || stderr?.trim() || 'Done',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Command failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
