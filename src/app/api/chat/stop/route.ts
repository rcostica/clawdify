import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { abortActiveGatewayRuns } from '@/lib/gateway/active-runs';

const execFileAsync = promisify(execFile);

const OPENCLAW_BIN = process.env.OPENCLAW_BIN || '/home/ubuntu/.npm-global/bin/openclaw';

/**
 * POST /api/chat/stop
 * Body: { projectId?: string, sessionKey?: string }
 *
 * Aborts the active OpenClaw gateway chat run for the Clawdify project session.
 * This is intentionally gateway-level stop (`chat.abort`), not just a browser
 * AbortController cancel, so tools/agent work actually receives the stop signal.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, sessionKey } = await request.json().catch(() => ({}));
    const effectiveSessionKey = typeof sessionKey === 'string' && sessionKey.trim()
      ? sessionKey.trim()
      : typeof projectId === 'string' && projectId.trim()
        ? `clawdify:${projectId.trim()}`
        : null;

    if (!effectiveSessionKey) {
      return NextResponse.json({ error: 'projectId or sessionKey required' }, { status: 400 });
    }

    // First abort Clawdify's own active HTTP fetch to the Gateway. This is the
    // path used by /v1/chat/completions, and disconnecting it is what actually
    // propagates an AbortSignal into OpenClaw's OpenAI-compatible HTTP handler.
    const localAbort = abortActiveGatewayRuns(effectiveSessionKey);

    // Also ask the Gateway RPC layer to abort native chat.send runs. This keeps
    // the endpoint useful if Clawdify moves to chat.send later, but today the
    // important part for Clawdify is localAbort above.
    let parsed: unknown = { ok: true, aborted: false, runIds: [] };
    try {
      const home = process.env.HOME || '/home/ubuntu';
      const { stdout, stderr } = await execFileAsync(
        OPENCLAW_BIN,
        ['gateway', 'call', 'chat.abort', '--params', JSON.stringify({ sessionKey: effectiveSessionKey })],
        {
          cwd: '/tmp',
          timeout: 15_000,
          encoding: 'utf8',
          env: {
            HOME: home,
            PATH: '/home/ubuntu/.npm-global/bin:/usr/local/bin:/usr/bin:/bin',
            NODE_ENV: process.env.NODE_ENV || 'production',
          } as NodeJS.ProcessEnv,
        },
      );

      const raw = stdout.trim();
      const jsonStart = raw.indexOf('{');
      parsed = jsonStart >= 0 ? JSON.parse(raw.slice(jsonStart)) : { ok: true };

      if (stderr.trim()) {
        console.warn('[chat-stop] stderr:', stderr.trim().slice(0, 500));
      }
    } catch (gatewayAbortError) {
      console.warn('[chat-stop] Gateway RPC chat.abort failed after local abort:', gatewayAbortError);
    }

    const gatewayResult = parsed as { aborted?: boolean; runIds?: unknown };
    const gatewayRunIds = Array.isArray(gatewayResult.runIds) ? gatewayResult.runIds.filter((id): id is string => typeof id === 'string') : [];
    const aborted = localAbort.aborted || Boolean(gatewayResult.aborted);
    const runIds = [...localAbort.runIds, ...gatewayRunIds];

    console.log('[chat-stop] abort result:', JSON.stringify({ sessionKey: effectiveSessionKey, localAbort, gateway: parsed }).slice(0, 800));

    return NextResponse.json({
      ok: true,
      sessionKey: effectiveSessionKey,
      aborted,
      runIds,
      localAbort,
      gateway: parsed,
    });
  } catch (error) {
    console.error('[chat-stop] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Stop failed' },
      { status: 500 },
    );
  }
}
