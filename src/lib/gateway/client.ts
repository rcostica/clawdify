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

const FALLBACK_MODEL = 'anthropic/claude-sonnet-4-6';
const OVERLOAD_MAX_RETRIES = 2;        // retry twice before fallback
const OVERLOAD_RETRY_DELAYS = [2000, 3000]; // ms between retries
const SILENCE_TIMEOUT_MS = 60_000;     // 60s of total silence (no bytes at all) → assume dead

// When falling back to a different model, we must NOT re-send the original user
// message because the gateway already appended it to the session transcript on
// the first (failed) attempt. Re-sending would create a duplicate in the session
// history, causing the fallback model to see the message twice and respond with
// "I already answered this." Instead, we send a short system-level nudge that
// tells the fallback model to respond to the user's last message in the session.
const FALLBACK_RETRY_MESSAGE = '[System: The previous model attempt failed or timed out. Please respond to the user\'s most recent message above. Do not mention this system note.]';

function buildFallbackBody(originalBody: Record<string, unknown>): Record<string, unknown> {
  return {
    ...originalBody,
    model: FALLBACK_MODEL,
    messages: [{ role: 'user', content: FALLBACK_RETRY_MESSAGE }],
  };
}

export type ChatStreamResult = {
  response: Response;
  usedFallback: boolean;
  fallbackModel?: string;
};

/**
 * Wait for the first meaningful SSE data chunk from a streaming response.
 * Uses a rolling silence timer: any bytes from the gateway (including SSE
 * comments / keepalives) reset the timer. This means tool-call phases that
 * produce no text but do send keepalives won't trigger a false timeout.
 * Only truly silent streams (no bytes at all for SILENCE_TIMEOUT_MS) fall back.
 *
 * Returns { ok: true, buffered, reader } if data arrived,
 *         { ok: false } if timed out (stream is aborted).
 */
async function waitForFirstChunk(
  response: Response,
  silenceMs: number,
): Promise<
  | { ok: true; buffered: Uint8Array[]; reader: ReadableStreamDefaultReader<Uint8Array> }
  | { ok: false }
> {
  if (!response.body) return { ok: false };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const buffered: Uint8Array[] = [];
  let textBuf = '';

  return new Promise((resolve) => {
    let settled = false;

    // Rolling silence timer — resets every time we receive ANY bytes
    let timer = setTimeout(onSilenceTimeout, silenceMs);

    function onSilenceTimeout() {
      if (settled) return;
      settled = true;
      console.log(`[chatStream] Stream silent for ${silenceMs}ms (no bytes at all) — aborting`);
      reader.cancel().catch(() => {});
      resolve({ ok: false });
    }

    function resetTimer() {
      clearTimeout(timer);
      timer = setTimeout(onSilenceTimeout, silenceMs);
    }

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            clearTimeout(timer);
            if (!settled) { settled = true; resolve({ ok: true, buffered, reader }); }
            return;
          }

          // Any bytes received = gateway is alive, reset silence timer
          resetTimer();

          buffered.push(value);
          textBuf += decoder.decode(value, { stream: true });
          // Check for any real data line (actual content, not just SSE comments)
          if (textBuf.split('\n').some(line => line.startsWith('data: '))) {
            clearTimeout(timer);
            if (!settled) { settled = true; resolve({ ok: true, buffered, reader }); }
            return;
          }
        }
      } catch {
        clearTimeout(timer);
        if (!settled) { settled = true; resolve({ ok: false }); }
      }
    })();
  });
}

/**
 * Create a new Response that prepends buffered chunks before the remaining stream.
 */
function prependBufferedResponse(
  original: Response,
  buffered: Uint8Array[],
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Response {
  const newBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Emit buffered chunks first
      for (const chunk of buffered) {
        controller.enqueue(chunk);
      }
      // Then continue reading the rest of the original stream
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch {
        // stream error
      }
      controller.close();
    },
  });

  return new Response(newBody, {
    status: original.status,
    statusText: original.statusText,
    headers: original.headers,
  });
}

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

  // Try primary model with retries on 529
  let response = await attempt();

  if (response.status === 529) {
    for (let i = 0; i < OVERLOAD_MAX_RETRIES; i++) {
      console.log(`[chatStream] 529 overloaded — retry ${i + 1}/${OVERLOAD_MAX_RETRIES} in ${OVERLOAD_RETRY_DELAYS[i]}ms`);
      await new Promise(r => setTimeout(r, OVERLOAD_RETRY_DELAYS[i]));
      response = await attempt();
      if (response.status !== 529) break;
    }
  }

  // If still 529 after retries, fall back to alternate model.
  // 529 = gateway rejected the request outright, so the user message was likely
  // never appended to the session transcript. Send the full original message.
  if (response.status === 529) {
    console.log(`[chatStream] 529 persisted after ${OVERLOAD_MAX_RETRIES} retries — falling back to ${FALLBACK_MODEL}`);
    const fallbackBody = { ...body, model: FALLBACK_MODEL };
    response = await attempt(fallbackBody);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Fallback model also failed (${response.status}): ${error}`);
    }

    return { response, usedFallback: true, fallbackModel: FALLBACK_MODEL };
  }

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 405) {
      throw new Error(`Gateway returned 405 Method Not Allowed — check that the OpenClaw gateway is running and accepts POST to /v1/chat/completions. URL: ${url}`);
    }
    throw new Error(`Gateway error (${response.status}): ${error}`);
  }

  // Stream got 200 — but OpenClaw may sit idle while retrying Opus internally.
  // Use a rolling silence timeout: any bytes (including keepalives) reset the timer.
  // Only fall back if the stream goes completely silent (truly dead gateway/model).
  const chunkResult = await waitForFirstChunk(response, SILENCE_TIMEOUT_MS);

  if (!chunkResult.ok) {
    console.log(`[chatStream] Primary model stream went silent for ${SILENCE_TIMEOUT_MS}ms — falling back to ${FALLBACK_MODEL}`);
    // User message is already in the gateway session — send retry nudge, not the original.
    const fallbackBody = buildFallbackBody(body);
    const fallbackResponse = await attempt(fallbackBody);

    if (!fallbackResponse.ok) {
      const error = await fallbackResponse.text();
      throw new Error(`Fallback model also failed (${fallbackResponse.status}): ${error}`);
    }

    return { response: fallbackResponse, usedFallback: true, fallbackModel: FALLBACK_MODEL };
  }

  // Data arrived — reconstruct the response with buffered bytes prepended
  const reconstituted = prependBufferedResponse(response, chunkResult.buffered, chunkResult.reader);
  return { response: reconstituted, usedFallback: false };
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
