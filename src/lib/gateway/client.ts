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
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage = {
  role: string;
  content: string | ContentPart[];
};

export type ChatStreamResult = {
  response: Response;
  usedFallback: boolean;
  fallbackModel?: string;
};

// Fallback model when gateway returns empty response (overload gap)
const EMPTY_RESPONSE_FALLBACK_MODEL = 'anthropic/claude-sonnet-4-6';

export async function chatStream(opts: {
  messages: ChatMessage[];
  sessionKey?: string;
  model?: string;
  user?: string;
}): Promise<ChatStreamResult> {
  const { messages, sessionKey, model, user } = opts;
  
  const extraHeaders: Record<string, string> = {};
  if (sessionKey) {
    extraHeaders['x-openclaw-session-key'] = sessionKey;
  }

  const body: Record<string, unknown> = {
    model: model || 'openclaw:main',
    messages,
    stream: true,
  };
  // Send user field for stable session derivation by the Gateway
  if (user) {
    body.user = user;
  } else if (sessionKey) {
    body.user = sessionKey;
  }

  const url = `${GATEWAY_URL}/v1/chat/completions`;

  // Helper: single fetch attempt (with optional AbortController)
  const attempt = async (overrideBody?: Record<string, unknown>, signal?: AbortSignal) => {
    const fetchBody = overrideBody || body;
    try {
      return await fetch(url, {
        method: 'POST',
        headers: headers(extraHeaders),
        body: JSON.stringify(fetchBody),
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw new Error('Request aborted (timeout)');
      throw new Error(`Gateway unreachable at ${GATEWAY_URL}: ${err}`);
    }
  };

  // Send request to gateway. The gateway handles model failover natively:
  // - 529/overload → rotates auth profiles → falls back to configured fallback models
  // - 500/timeout → same rotation + fallback chain
  // - Config: agents.defaults.model.fallbacks (currently Sonnet 4.6 → Sonnet 4.5)
  // No Clawdify-level timeout or retry — the gateway manages the full lifecycle.
  const response = await attempt();

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 405) {
      throw new Error(`Gateway returned 405 Method Not Allowed — check that the OpenClaw gateway is running and accepts POST to /v1/chat/completions. URL: ${url}`);
    }
    throw new Error(`Gateway error (${response.status}): ${error}`);
  }

  return { response, usedFallback: false };
}

/**
 * Send a chat message and get a non-streaming response.
 */
export async function chat(opts: {
  messages: ChatMessage[];
  sessionKey?: string;
  model?: string;
  user?: string;
}) {
  const { messages, sessionKey, model, user } = opts;
  
  const extraHeaders: Record<string, string> = {};
  if (sessionKey) {
    extraHeaders['x-openclaw-session-key'] = sessionKey;
  }

  const body: Record<string, unknown> = {
    model: model || 'openclaw:main',
    messages,
    stream: false,
  };
  if (user) {
    body.user = user;
  } else if (sessionKey) {
    body.user = sessionKey;
  }

  const response = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: headers(extraHeaders),
    body: JSON.stringify(body),
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
