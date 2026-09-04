/**
 * Server-side Gateway client.
 * All calls happen in API routes — secrets never reach the browser.
 */

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const GATEWAY_PROTOCOL_VERSION = 4;
const GATEWAY_RPC_TIMEOUT_MS = 10_000;
const GATEWAY_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'main';

export function toGatewaySessionKey(sessionKey?: string | null): string | undefined {
  const key = sessionKey?.trim();
  if (!key) return undefined;
  if (key.startsWith('agent:')) return key;
  return `agent:${GATEWAY_AGENT_ID}:${key}`;
}

function sessionUser(user: string | undefined, originalSessionKey: string | undefined, resolvedSessionKey: string | undefined): string | undefined {
  if (!user) return resolvedSessionKey;
  if (originalSessionKey && user === originalSessionKey) return resolvedSessionKey;
  return user;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    'Content-Type': 'application/json',
    'x-openclaw-agent-id': GATEWAY_AGENT_ID,
    ...extra,
  };
}

async function streamingPost(
  url: string,
  jsonBody: Record<string, unknown>,
  extraHeaders: Record<string, string>,
  signal?: AbortSignal,
): Promise<Response> {
  const parsedUrl = new URL(url);
  const payload = JSON.stringify(jsonBody);
  const transport = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise<Response>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Request aborted'));
      return;
    }

    let settled = false;
    let upstreamEnded = false;
    let upstreamResponse: import('node:http').IncomingMessage | null = null;
    let responseController: ReadableStreamDefaultController<Uint8Array> | null = null;

    function cleanupAbortListener() {
      signal?.removeEventListener('abort', abortRequest);
    }

    const req = transport(parsedUrl, {
      method: 'POST',
      headers: {
        ...headers(extraHeaders),
        Accept: 'text/event-stream',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 0,
    }, (res) => {
      settled = true;
      upstreamResponse = res;

      const responseHeaders = new Headers();
      for (const [key, value] of Object.entries(res.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) responseHeaders.append(key, item);
        } else if (typeof value === 'string') {
          responseHeaders.set(key, value);
        } else if (typeof value === 'number') {
          responseHeaders.set(key, String(value));
        }
      }

      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          responseController = controller;
          res.on('data', (chunk: Buffer | string) => {
            const bytes = typeof chunk === 'string'
              ? new TextEncoder().encode(chunk)
              : new Uint8Array(chunk);
            controller.enqueue(bytes);
          });
          res.on('end', () => {
            upstreamEnded = true;
            cleanupAbortListener();
            controller.close();
          });
          res.on('error', (error) => {
            upstreamEnded = true;
            cleanupAbortListener();
            controller.error(error);
          });
        },
        cancel() {
          upstreamEnded = true;
          cleanupAbortListener();
          res.destroy();
          req.destroy();
        },
      });

      resolve(new Response(body, {
        status: res.statusCode || 502,
        statusText: res.statusMessage,
        headers: responseHeaders,
      }));
    });

    function abortRequest() {
      if (upstreamEnded) return;
      upstreamEnded = true;
      const error = new Error('Request aborted');
      responseController?.error(error);
      upstreamResponse?.destroy(error);
      req.destroy(error);
    }

    req.setTimeout(0);
    req.on('error', (error) => {
      cleanupAbortListener();
      if (!settled) reject(error);
    });
    signal?.addEventListener('abort', abortRequest, { once: true });

    req.write(payload);
    req.end();
  });
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

type GatewayResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
};

function gatewayWebSocketUrl(): string {
  const url = new URL(GATEWAY_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

/**
 * Call a documented OpenClaw Gateway RPC over its WebSocket control plane.
 * A short-lived connection keeps this helper simple and is sufficient for
 * occasional server-side reads such as session stats.
 */
export async function gatewayRpc<T>(
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = GATEWAY_RPC_TIMEOUT_MS,
): Promise<T> {
  if (!GATEWAY_TOKEN) {
    throw new Error('OPENCLAW_GATEWAY_TOKEN is not configured');
  }

  const connectId = crypto.randomUUID();
  const requestId = crypto.randomUUID();

  return new Promise<T>((resolve, reject) => {
    const socket = new WebSocket(gatewayWebSocketUrl());
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('close', onClose);
      if (socket.readyState === WebSocket.OPEN) socket.close();
    };

    const succeed = (value: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const sendRequest = (id: string, rpcMethod: string, rpcParams: Record<string, unknown>) => {
      socket.send(JSON.stringify({
        type: 'req',
        id,
        method: rpcMethod,
        params: rpcParams,
      }));
    };

    const onMessage = (event: MessageEvent) => {
      let frame: Record<string, unknown>;
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (frame.type === 'event' && frame.event === 'connect.challenge') {
        sendRequest(connectId, 'connect', {
          minProtocol: GATEWAY_PROTOCOL_VERSION,
          maxProtocol: GATEWAY_PROTOCOL_VERSION,
          client: {
            id: 'gateway-client',
            version: '0.1.0',
            platform: 'linux',
            mode: 'backend',
          },
          role: 'operator',
          scopes: ['operator.read'],
          caps: [],
          commands: [],
          permissions: {},
          auth: { token: GATEWAY_TOKEN },
          locale: 'en-US',
          userAgent: 'clawdify/0.1.0',
        });
        return;
      }

      if (frame.type !== 'res') return;
      const response = frame as GatewayResponseFrame;

      if (response.id === connectId) {
        if (!response.ok) {
          fail(new Error(response.error?.message || 'Gateway connection rejected'));
          return;
        }
        sendRequest(requestId, method, params);
        return;
      }

      if (response.id !== requestId) return;
      if (!response.ok) {
        fail(new Error(response.error?.message || `Gateway RPC ${method} failed`));
        return;
      }
      succeed(response.payload as T);
    };

    const onError = () => fail(new Error(`Gateway WebSocket error at ${gatewayWebSocketUrl()}`));
    const onClose = () => fail(new Error(`Gateway WebSocket closed before ${method} completed`));
    const timer = setTimeout(
      () => fail(new Error(`Gateway RPC ${method} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );

    socket.addEventListener('message', onMessage);
    socket.addEventListener('error', onError);
    socket.addEventListener('close', onClose);
  });
}

// Gateway handles model failover natively — no Clawdify-level model override needed.

export async function chatStream(opts: {
  messages: ChatMessage[];
  sessionKey?: string;
  model?: string;
  user?: string;
  signal?: AbortSignal;
}): Promise<ChatStreamResult> {
  const { messages, sessionKey, model, user, signal } = opts;
  const resolvedSessionKey = toGatewaySessionKey(sessionKey);
  
  const extraHeaders: Record<string, string> = {};
  if (resolvedSessionKey) {
    extraHeaders['x-openclaw-session-key'] = resolvedSessionKey;
  }

  const body: Record<string, unknown> = {
    model: model || `openclaw:${GATEWAY_AGENT_ID}`,
    messages,
    stream: true,
  };
  // Send user field for stable session derivation by the Gateway
  const resolvedUser = sessionUser(user, sessionKey, resolvedSessionKey);
  if (resolvedUser) {
    body.user = resolvedUser;
  }

  const url = `${GATEWAY_URL}/v1/chat/completions`;

  // Helper: single streaming POST attempt.
  // Do not use global fetch here: Node/undici applies a body inactivity timeout
  // to long-lived streams. During long OpenClaw thinking/tool phases the Gateway
  // may legitimately stay silent for minutes, while Clawdify keeps the browser
  // connection alive with its own SSE comments. Native http/https lets the
  // upstream stream stay open until Gateway finishes or the user aborts.
  const attempt = async (overrideBody?: Record<string, unknown>, signal?: AbortSignal) => {
    const fetchBody = overrideBody || body;
    try {
      return await streamingPost(url, fetchBody, extraHeaders, signal);
    } catch (err) {
      if (signal?.aborted) throw new Error('Request aborted');
      throw new Error(`Gateway unreachable at ${GATEWAY_URL}: ${err}`);
    }
  };

  // Send request to gateway. The gateway handles model failover natively:
  // - 529/overload → rotates auth profiles → falls back to configured fallback models
  // - 500/timeout → same rotation + fallback chain
  // - Config: agents.defaults.model.fallbacks (currently Sonnet 4.6 → Sonnet 4.5)
  // No Clawdify-level timeout or retry — the gateway manages the full lifecycle.
  const response = await attempt(undefined, signal);

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
  const resolvedSessionKey = toGatewaySessionKey(sessionKey);
  
  const extraHeaders: Record<string, string> = {};
  if (resolvedSessionKey) {
    extraHeaders['x-openclaw-session-key'] = resolvedSessionKey;
  }

  const body: Record<string, unknown> = {
    model: model || `openclaw:${GATEWAY_AGENT_ID}`,
    messages,
    stream: false,
  };
  const resolvedUser = sessionUser(user, sessionKey, resolvedSessionKey);
  if (resolvedUser) {
    body.user = resolvedUser;
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
export async function invokeTool(
  tool: string,
  args: Record<string, unknown> = {},
  options: { sessionKey?: string; agentId?: string } = {},
) {
  const response = await fetch(`${GATEWAY_URL}/tools/invoke`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ tool, args, ...options }),
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
