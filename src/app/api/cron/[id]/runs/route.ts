import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { listGatewayCronJobRuns } from '@/lib/gateway/cron';

const RUNS_DIR = path.join(process.env.HOME || '/root', '.openclaw', 'cron', 'runs');

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const runs = await listGatewayCronJobRuns(id, 20);
    return NextResponse.json({ runs, source: 'gateway' });
  } catch (gatewayError) {
    console.warn(`[cron/${id}/runs] Gateway runs unavailable; using legacy file:`, gatewayError);
    try {
      const raw = await readFile(path.join(RUNS_DIR, `${id}.jsonl`), 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean);
      const runs = lines.map(l => JSON.parse(l)).reverse().slice(0, 20);
      return NextResponse.json({ runs, source: 'legacy-file' });
    } catch {
      return NextResponse.json({ runs: [], source: 'legacy-file' });
    }
  }
}
