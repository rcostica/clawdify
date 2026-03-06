import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

export async function GET() {
  const result: Record<string, unknown> = {
    connected: false,
    url: GATEWAY_URL,
    hasToken: !!GATEWAY_TOKEN,
    chatEndpoint: 'unknown',
  };

  try {
    // Check basic gateway connectivity
    const response = await fetch(`${GATEWAY_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok || response.status === 401) {
      result.connected = true;
    } else {
      result.error = `HTTP ${response.status}`;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Connection failed';
    return NextResponse.json(result);
  }

  // Check if chatCompletions endpoint is enabled (OPTIONS — no LLM call)
  try {
    const chatCheck = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (chatCheck.status === 405) {
      result.chatEndpoint = 'disabled';
    } else {
      result.chatEndpoint = 'enabled';
    }
    await chatCheck.text().catch(() => {});
  } catch {
    result.chatEndpoint = 'error';
  }

  return NextResponse.json(result);
}
