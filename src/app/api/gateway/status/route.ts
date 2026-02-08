import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

export async function GET() {
  try {
    // Try to invoke a simple tool to check connectivity
    const response = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'session_status',
        args: {},
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return NextResponse.json({
        connected: true,
        url: GATEWAY_URL,
        hasToken: !!GATEWAY_TOKEN,
      });
    }

    return NextResponse.json({
      connected: false,
      url: GATEWAY_URL,
      hasToken: !!GATEWAY_TOKEN,
      error: `HTTP ${response.status}`,
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      url: GATEWAY_URL,
      hasToken: !!GATEWAY_TOKEN,
      error: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}
