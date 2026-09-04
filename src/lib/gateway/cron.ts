import { gatewayRpc } from '@/lib/gateway/client';

const CRON_PAGE_SIZE = 200;
const MAX_CRON_JOBS = 2_000;

export interface GatewayCronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: { kind: string; expr?: string; tz?: string; [key: string]: unknown };
  state?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GatewayCronRun {
  ts: number;
  jobId: string;
  status?: string;
  error?: string;
  summary?: string;
  durationMs?: number;
  jobName?: string;
  [key: string]: unknown;
}

interface CronListResult {
  jobs?: GatewayCronJob[];
  snapshotRevision?: string;
  total?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
}

interface CronRunsResult {
  entries?: GatewayCronRun[];
  total?: number;
  hasMore?: boolean;
  nextOffset?: number | null;
}

/** Read the active cron/automation inventory through OpenClaw's SQLite-aware API. */
export async function listGatewayCronJobs(): Promise<{
  jobs: GatewayCronJob[];
  truncated: boolean;
}> {
  const jobs: GatewayCronJob[] = [];
  let offset = 0;
  let hasMore = true;
  let snapshotRevision: string | undefined;

  while (hasMore && jobs.length < MAX_CRON_JOBS) {
    const result = await gatewayRpc<CronListResult>('cron.list', {
      includeDisabled: true,
      limit: Math.min(CRON_PAGE_SIZE, MAX_CRON_JOBS - jobs.length),
      offset,
      sortBy: 'name',
      sortDir: 'asc',
      ...(snapshotRevision ? { snapshotRevision } : {}),
    }, 30_000);

    const page = Array.isArray(result.jobs) ? result.jobs : [];
    jobs.push(...page);
    hasMore = result.hasMore === true;
    snapshotRevision ||= result.snapshotRevision;

    if (!hasMore) break;
    const nextOffset = result.nextOffset;
    if (typeof nextOffset !== 'number' || nextOffset <= offset || page.length === 0) {
      throw new Error('Gateway cron pagination did not advance');
    }
    offset = nextOffset;
  }

  return { jobs, truncated: hasMore };
}

/** Read recent runs across every visible automation, newest first. */
export async function listGatewayCronRuns(limit = 100): Promise<GatewayCronRun[]> {
  const result = await gatewayRpc<CronRunsResult>('cron.runs', {
    scope: 'all',
    limit,
    offset: 0,
    sortDir: 'desc',
  }, 30_000);
  return Array.isArray(result.entries) ? result.entries : [];
}

/** Read recent runs for one automation. */
export async function listGatewayCronJobRuns(
  jobId: string,
  limit = 20,
): Promise<GatewayCronRun[]> {
  const result = await gatewayRpc<CronRunsResult>('cron.runs', {
    scope: 'job',
    id: jobId,
    limit,
    offset: 0,
    sortDir: 'desc',
  }, 30_000);
  return Array.isArray(result.entries) ? result.entries : [];
}
