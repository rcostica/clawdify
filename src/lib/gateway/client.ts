/**
 * Server-side Gateway client.
 * All calls happen in API routes — secrets never reach the browser.
 */

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/**
 * Send a chat message and get a streaming response.
 * Returns a ReadableStream of SSE events.
 */
export async function chatStream(opts: {
  messages: Array<{ role: string; content: string }>;
  sessionKey?: string;
  model?: string;
}) {
  const { messages, sessionKey, model } = opts;
  
  const extraHeaders: Record<string, string> = {};
  if (sessionKey) {
    extraHeaders['x-openclaw-session-key'] = sessionKey;
  }

  const response = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: headers(extraHeaders),
    body: JSON.stringify({
      model: model || 'openclaw:main',
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gateway error (${response.status}): ${error}`);
  }

  return response;
}

/**
 * Send a chat message and get a non-streaming response.
 */
export async function chat(opts: {
  messages: Array<{ role: string; content: string }>;
  sessionKey?: string;
  model?: string;
}) {
  const { messages, sessionKey, model } = opts;
  
  const extraHeaders: Record<string, string> = {};
  if (sessionKey) {
    extraHeaders['x-openclaw-session-key'] = sessionKey;
  }

  const response = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: headers(extraHeaders),
    body: JSON.stringify({
      model: model || 'openclaw:main',
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gateway error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Invoke a Gateway tool directly.
 */
export async function invokeTool(tool: string, args: Record<string, unknown> = {}) {
  const response = await fetch(`${GATEWAY_URL}/tools/invoke`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ tool, args }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tool invoke error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Check Gateway health.
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
      method: 'OPTIONS',
      headers: headers(),
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, status: 0, error: String(error) };
  }
}
