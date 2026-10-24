import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const API_ORIGIN = 'https://api.boson.ai';
const WS_URL = 'wss://api.boson.ai/v1/realtime?model=higgs-realtime';
const SESSION_LIMIT_MS = 45_000;
const SECRET_REQUEST_LIMIT_MS = 10_000;
const TOOL_NAME = 'change_set';
const EFFECT = 'storm';

export const realtimeDocs = {
  clientSecrets: 'https://docs.boson.ai/api-reference/realtime/client-secrets.md',
  clientEvents: 'https://docs.boson.ai/api-reference/realtime/client-events.md',
  serverEvents: 'https://docs.boson.ai/api-reference/realtime/server-events.md',
  toolCalling: 'https://docs.boson.ai/models/higgs-realtime/guides/tool-calling.md',
  connectionsAndSessions:
    'https://docs.boson.ai/models/higgs-realtime/guides/connections-and-sessions.md',
};

type UnknownRecord = Record<string, unknown>;
export type SafeOutputItem = {
  type: 'message' | 'function_call' | 'function_call_output' | 'other';
  functionName?: 'change_set' | 'other';
  executor?: 'client' | 'server';
};
export type SafeResponseSummary = {
  status: 'completed' | 'cancelled' | 'incomplete' | 'failed' | 'unknown';
  outputItems: SafeOutputItem[];
};

export type RealtimeProbeEvidence = {
  mode: 'live-realtime-probe';
  status: 'completed' | 'failed';
  requestCounts: { clientSecretPosts: number; websocketSessions: number; modelResponses: number };
  timingMs: { clientSecretPost?: number; websocketSession?: number; total?: number };
  websocketLimitSeconds: 45;
  events: { counts: Record<string, number>; types: string[] };
  responses: SafeResponseSummary[];
  sessionConfig?: {
    toolsCount: number | null;
    changeSetDeclared: boolean | null;
    outputModalities: Array<'text' | 'audio' | 'other'> | null;
    toolChoice: 'auto' | 'none' | 'required' | 'change_set' | 'other';
  };
  serverError?: { type: string; code: string; param: string };
  tool: { name: string; controlledEffect: 'storm'; dispatched: boolean; completed: boolean };
  failureCode?: string;
  docs: typeof realtimeDocs;
};

/** Pure extraction and validation for the completed client function call. */
export function extractStormChangeSet(event: unknown): { callId: string; effect: 'storm' } | null {
  if (!isRecord(event) || event.type !== 'response.done' || !isRecord(event.response)) return null;
  if (event.response.status !== 'completed' || !Array.isArray(event.response.output)) return null;

  const calls = event.response.output.filter(
    (item): item is UnknownRecord =>
      isRecord(item) && item.type === 'function_call' && item.executor === 'client',
  );
  if (calls.length !== 1) return null;
  const call = calls[0];
  if (call?.name !== TOOL_NAME || typeof call.call_id !== 'string' || !call.call_id) return null;
  if (typeof call.arguments !== 'string') return null;

  try {
    const args: unknown = JSON.parse(call.arguments);
    if (!isRecord(args) || Object.keys(args).length !== 1 || args.effect !== EFFECT) return null;
  } catch {
    return null;
  }
  return { callId: call.call_id, effect: EFFECT };
}

/**
 * Runs one bounded Realtime tool-call probe. This performs one client-secret POST
 * and one built-in Node WebSocket session; it never retries or records raw payloads.
 */
export async function probeRealtime({
  apiKey,
  outputDirectory,
}: {
  apiKey: string;
  outputDirectory: string;
}): Promise<RealtimeProbeEvidence> {
  const startedAt = performance.now();
  const evidence: RealtimeProbeEvidence = {
    mode: 'live-realtime-probe',
    status: 'failed',
    requestCounts: { clientSecretPosts: 0, websocketSessions: 0, modelResponses: 0 },
    timingMs: {},
    websocketLimitSeconds: 45,
    events: { counts: {}, types: [] },
    responses: [],
    tool: { name: TOOL_NAME, controlledEffect: EFFECT, dispatched: false, completed: false },
    docs: realtimeDocs,
  };

  let failureCode = 'probe_failed';
  try {
    if (typeof apiKey !== 'string' || apiKey.trim().length === 0)
      throw new ProbeFailure('missing_api_key');
    if (typeof WebSocket !== 'function') throw new ProbeFailure('websocket_unavailable');

    const postStart = performance.now();
    evidence.requestCounts.clientSecretPosts = 1;
    const response = await fetch(`${API_ORIGIN}/v1/realtime/client_secrets`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
      redirect: 'error',
      signal: AbortSignal.timeout(SECRET_REQUEST_LIMIT_MS),
    });
    evidence.timingMs.clientSecretPost = elapsed(postStart);
    if (!response.ok) throw new ProbeFailure(`client_secret_http_${response.status}`);

    const secretBody: unknown = await response.json();
    const clientSecret = readClientSecret(secretBody);
    if (!clientSecret) throw new ProbeFailure('invalid_client_secret_response');

    evidence.requestCounts.websocketSessions = 1;
    const wsStart = performance.now();
    await runSession(clientSecret, evidence);
    evidence.timingMs.websocketSession = elapsed(wsStart);
    evidence.status = 'completed';
  } catch (error) {
    failureCode = error instanceof ProbeFailure ? error.code : 'probe_failed';
  } finally {
    evidence.timingMs.total = elapsed(startedAt);
    if (evidence.status !== 'completed') evidence.failureCode = failureCode;
  }

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    resolve(outputDirectory, 'realtime-probe.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
  return evidence;
}

async function runSession(clientSecret: string, evidence: RealtimeProbeEvidence): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    let ws: WebSocket;
    let settled = false;
    let responsesDone = 0;
    let initialSessionAck = false;
    let toolCallSeen = false;
    let toolOutputSent = false;
    let continuationRequested = false;
    let awaitingToolChoiceAck = false;
    const counts = evidence.events.counts;
    const startedAt = performance.now();
    const timeout = setTimeout(() => fail('websocket_timeout'), SESSION_LIMIT_MS);

    const finish = (error?: ProbeFailure) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
      } catch {
        // Close failures do not contain useful evidence and must not leak raw details.
      }
      if (error) rejectPromise(error);
      else {
        evidence.timingMs.websocketSession = elapsed(startedAt);
        resolvePromise();
      }
    };
    const fail = (code: string) => finish(new ProbeFailure(code));
    const send = (payload: UnknownRecord) => {
      if (settled || ws.readyState !== WebSocket.OPEN) return fail('websocket_not_open');
      ws.send(JSON.stringify(payload));
    };
    const recordEvent = (event: UnknownRecord) => {
      if (typeof event.type !== 'string') return;
      const type = DOCUMENTED_EVENT_TYPES.has(event.type) ? event.type : 'other';
      counts[type] = (counts[type] ?? 0) + 1;
      if (!evidence.events.types.includes(type)) evidence.events.types.push(type);
      return type;
    };

    try {
      ws = new WebSocket(WS_URL, ['realtime', `bai-client-secret.${clientSecret}`]);
    } catch {
      clearTimeout(timeout);
      rejectPromise(new ProbeFailure('websocket_connect_failed'));
      return;
    }

    // Attach an error listener immediately so transient socket errors are handled.
    ws.addEventListener('error', () => fail('websocket_error'));
    ws.addEventListener('close', () => {
      if (!settled) fail('websocket_closed_early');
    });
    ws.addEventListener('open', () => {
      send({
        type: 'session.update',
        session: {
          model: 'higgs-realtime',
          instructions:
            'Use change_set for the requested change. Do not claim success unless its result confirms it.',
          output_modalities: ['text'],
          max_output_tokens: 64,
          tools: [
            {
              type: 'function',
              name: TOOL_NAME,
              description: 'Apply the controlled scene effect requested by the user.',
              parameters: {
                type: 'object',
                properties: { effect: { type: 'string', enum: [EFFECT] } },
                required: ['effect'],
                additionalProperties: false,
              },
            },
          ],
          tool_choice: 'required',
        },
      });
    });
    ws.addEventListener('message', (message: MessageEvent) => {
      if (settled) return;
      let event: unknown;
      try {
        event = JSON.parse(String(message.data));
      } catch {
        return fail('invalid_server_event');
      }
      if (!isRecord(event)) return fail('invalid_server_event');
      const eventType = recordEvent(event);
      if (eventType === 'error') {
        evidence.serverError = safeServerError(event);
        return fail('server_error_event');
      }
      if (
        !initialSessionAck &&
        (eventType === 'session.created' || eventType === 'session.updated')
      ) {
        initialSessionAck = true;
        evidence.sessionConfig = summarizeSessionConfig(event);
        send({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: 'Call change_set with effect "storm".' }],
          },
        });
        evidence.requestCounts.modelResponses += 1;
        send({ type: 'response.create', response: { max_output_tokens: 64 } });
        return;
      }
      if (eventType === 'session.updated' && awaitingToolChoiceAck) {
        awaitingToolChoiceAck = false;
        if (continuationRequested) return fail('duplicate_continuation');
        continuationRequested = true;
        evidence.requestCounts.modelResponses += 1;
        send({
          type: 'response.create',
          response: {
            max_output_tokens: 64,
            instructions:
              'The change_set result is complete. Acknowledge it in one short sentence without calling any more tools.',
          },
        });
        return;
      }
      if (eventType !== 'response.done') return;

      responsesDone += 1;
      const summary = summarizeRealtimeResponse(event);
      evidence.responses.push(summary);
      if (responsesDone === 1) {
        if (toolCallSeen) return fail('duplicate_tool_call');
        const call = extractStormChangeSet(event);
        if (!call) return fail('tool_call_validation_failed');
        toolCallSeen = true;
        evidence.tool.dispatched = true;
        send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: call.callId,
            output: JSON.stringify({ ok: true, effect: EFFECT }),
          },
        });
        toolOutputSent = true;
        evidence.tool.completed = true;
        awaitingToolChoiceAck = true;
        send({
          type: 'session.update',
          session: { tool_choice: 'none' },
        });
        return;
      }
      if (responsesDone === 2) {
        if (!isRecord(event.response) || event.response.status !== 'completed')
          return fail('continuation_not_completed');
        if (
          Array.isArray(event.response.output) &&
          event.response.output.some(
            (item: unknown) => isRecord(item) && item.type === 'function_call',
          )
        )
          return fail('unexpected_continuation_tool');
        if (!toolCallSeen || !toolOutputSent || !continuationRequested)
          return fail('invalid_tool_lifecycle');
        finish();
        return;
      }
      fail('response_limit_exceeded');
    });
  });
}

const DOCUMENTED_EVENT_TYPES = new Set([
  'session.created',
  'session.updated',
  'conversation.item.added',
  'response.created',
  'response.output_item.added',
  'response.output_item.done',
  'response.content_part.added',
  'response.content_part.done',
  'response.output_text.delta',
  'response.output_text.done',
  'response.function_call_arguments.delta',
  'response.function_call_arguments.done',
  'response.done',
  'error',
]);

export function summarizeRealtimeResponse(event: unknown): SafeResponseSummary {
  const response = isRecord(event) && isRecord(event.response) ? event.response : {};
  const rawStatus = response.status;
  const status =
    rawStatus === 'completed' ||
    rawStatus === 'cancelled' ||
    rawStatus === 'incomplete' ||
    rawStatus === 'failed'
      ? rawStatus
      : 'unknown';
  const output = Array.isArray(response.output) ? response.output : [];
  const outputItems = output.map((rawItem): SafeOutputItem => {
    if (!isRecord(rawItem)) return { type: 'other' as const };
    const type: SafeOutputItem['type'] =
      rawItem.type === 'message' ||
      rawItem.type === 'function_call' ||
      rawItem.type === 'function_call_output'
        ? rawItem.type
        : 'other';
    if (type !== 'function_call') return { type };
    const summary: RealtimeProbeEvidence['responses'][number]['outputItems'][number] = {
      type,
    };
    if (rawItem.name === TOOL_NAME) summary.functionName = TOOL_NAME;
    else if (typeof rawItem.name === 'string') summary.functionName = 'other';
    if (rawItem.executor === 'client' || rawItem.executor === 'server')
      summary.executor = rawItem.executor;
    return summary;
  });
  return { status, outputItems };
}

function summarizeSessionConfig(
  event: UnknownRecord,
): NonNullable<RealtimeProbeEvidence['sessionConfig']> {
  const session = isRecord(event.session) ? event.session : {};
  const tools = Array.isArray(session.tools) ? session.tools : null;
  const modalities = Array.isArray(session.output_modalities) ? session.output_modalities : null;
  const toolChoice = session.tool_choice;
  let safeToolChoice: NonNullable<RealtimeProbeEvidence['sessionConfig']>['toolChoice'] = 'other';
  if (toolChoice === 'auto' || toolChoice === 'none' || toolChoice === 'required') {
    safeToolChoice = toolChoice;
  } else if (
    isRecord(toolChoice) &&
    toolChoice.type === 'function' &&
    toolChoice.name === TOOL_NAME
  ) {
    safeToolChoice = TOOL_NAME;
  }
  return {
    toolsCount: tools?.length ?? null,
    changeSetDeclared:
      tools === null ? null : tools.some((tool) => isRecord(tool) && tool.name === TOOL_NAME),
    outputModalities:
      modalities === null
        ? null
        : modalities.map((modality) =>
            modality === 'text' || modality === 'audio' ? modality : 'other',
          ),
    toolChoice: safeToolChoice,
  };
}

function safeServerError(event: UnknownRecord): NonNullable<RealtimeProbeEvidence['serverError']> {
  const error = isRecord(event.error) ? event.error : {};
  return {
    type: safeErrorField(error.type),
    code: safeErrorField(error.code),
    param: safeErrorField(error.param),
  };
}

function safeErrorField(value: unknown): string {
  return typeof value === 'string' && /^[a-z_]{1,64}$/.test(value) ? value : 'unknown';
}

function readClientSecret(value: unknown): string | null {
  if (!isRecord(value) || value.object !== 'realtime.client_secret') return null;
  if (typeof value.value !== 'string' || !value.value.startsWith('bai-eph-')) return null;
  if (typeof value.expires_at !== 'number' || !Number.isFinite(value.expires_at)) return null;
  if (
    !isRecord(value.session) ||
    typeof value.session.id !== 'string' ||
    value.session.object !== 'realtime.session'
  )
    return null;
  return value.value;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function elapsed(start: number): number {
  return Math.max(0, Math.round(performance.now() - start));
}

class ProbeFailure extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
