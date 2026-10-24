export type SpikePlan = {
  mode: 'offline-plan';
  networkCallsAuthorized: false;
  requestBudget: { httpRequests: number; websocketSessions: number; websocketMaxSeconds: number };
  futureEssentialBatch: Array<{
    step: string;
    transport: 'HTTP' | 'WebSocket';
    count: number;
    purpose: string;
    limit?: string;
    estimatedProviderDollars?: number;
    estimateBasis?: string;
  }>;
  optionalDeferred: string[];
  budgetPolicy: {
    currency: 'CAD';
    projectCeiling: number;
    demoReserve: number;
    developmentCeiling: number;
    paidCallsEnabled: false;
    conversion: 'unverified';
  };
  estimatedProviderDollars: {
    tts: number;
    avatar: number;
    realtime: number;
    total: number;
    secretRequestCharge: 'unknown; excluded';
  };
  notes: string[];
};

export function estimateProviderDollars(characters = 120, avatarSeconds = 8, realtimeSeconds = 45) {
  for (const [value, ceiling] of [
    [characters, 120],
    [avatarSeconds, 8],
    [realtimeSeconds, 45],
  ]) {
    if (
      value === undefined ||
      ceiling === undefined ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > ceiling
    ) {
      throw new RangeError('Estimate inputs exceed the planned bounds.');
    }
  }
  const tts = (characters * 0.015) / 1000;
  const avatar = (avatarSeconds * 0.07) / 60;
  const realtime = (realtimeSeconds * (0.0023 + 0.014)) / 60;
  return { tts, avatar, realtime, total: tts + avatar + realtime };
}

export function createSpikePlan(): SpikePlan {
  const estimated = estimateProviderDollars();
  return {
    mode: 'offline-plan',
    networkCallsAuthorized: false,
    requestBudget: { httpRequests: 3, websocketSessions: 1, websocketMaxSeconds: 45 },
    futureEssentialBatch: [
      {
        step: 'TTS reusable audio',
        transport: 'HTTP',
        count: 1,
        purpose:
          'Stream PCM for one visible line and save/convert the response to WAV locally for reuse.',
        limit:
          'At most 120 visible characters; text request schema to be verified against the pinned official docs before any live implementation.',
        estimatedProviderDollars: estimated.tts,
        estimateBasis: '120 characters × $0.015 per 1,000 characters',
      },
      {
        step: 'Avatar stream',
        transport: 'HTTP',
        count: 1,
        purpose:
          'Stream one avatar performance using the approved procedural portrait and the saved supported WAV from TTS.',
        limit: 'At most 8 seconds; resolution rate basis 480 × 640 at $0.07/minute.',
        estimatedProviderDollars: estimated.avatar,
        estimateBasis: '8 seconds × $0.07 per minute',
      },
      {
        step: 'Realtime client secret',
        transport: 'HTTP',
        count: 1,
        purpose:
          'Request a client secret for the later Realtime session; billing impact is unknown and excluded from estimate.',
      },
      {
        step: 'Realtime behavior',
        transport: 'WebSocket',
        count: 1,
        purpose:
          'Later test session/tool behavior with actual microphone input; no live schema or implementation is created in this phase.',
        limit: 'At most 45 seconds estimated audio input and output.',
        estimatedProviderDollars: estimated.realtime,
        estimateBasis:
          '45 seconds × ($0.0023 input + $0.014 output)/minute estimated rates; token usage varies.',
      },
    ],
    optionalDeferred: [
      'Voice cloning',
      'Concurrency experiments',
      'Repeated samples',
      'Multilingual variants',
    ],
    budgetPolicy: {
      currency: 'CAD',
      projectCeiling: 30,
      demoReserve: 25,
      developmentCeiling: 5,
      paidCallsEnabled: false,
      conversion: 'unverified',
    },
    estimatedProviderDollars: { ...estimated, secretRequestCharge: 'unknown; excluded' },
    notes: [
      'Rates are provider dollars; CAD conversion is unverified.',
      'These are list-price estimates, not guaranteed upper bounds, confirmed charges or a spending guard.',
      'Measure the saved TTS clip duration before Avatar use; skip Avatar if the clip exceeds 8 seconds.',
      'No Boson API call is authorized in this phase.',
      'Realtime audio estimate is approximate; actual token billing differs.',
    ],
  };
}

export function parseSpikeArgs(args: string[]): 'plan' | 'check' {
  if (args.some((arg) => arg === '--run' || arg === '--live'))
    throw new Error('Live execution is disabled: this phase is offline-only.');
  const unknown = args.filter((arg) => arg !== '--plan' && arg !== '--check');
  if (unknown.length) throw new Error('Unknown argument. Use --plan or --check.');
  if (args.includes('--check') && args.includes('--plan'))
    throw new Error('Choose either --plan or --check.');
  return args.includes('--check') ? 'check' : 'plan';
}
