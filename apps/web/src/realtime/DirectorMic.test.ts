import { afterEach, describe, expect, it, vi } from 'vitest';
import { DirectorMic } from './DirectorMic';

class FakeSocket {
  static OPEN = 1;
  static CLOSING = 2;
  static instances: FakeSocket[] = [];
  readyState = 0;
  bufferedAmount = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(_url: string, _protocols: string[]) {
    FakeSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = FakeSocket.OPEN;
      this.onopen?.();
    });
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  emit(type: string, body: object = {}) {
    this.onmessage?.({ data: JSON.stringify({ type, ...body }) });
  }
}

class FakeWorklet {
  static instances: FakeWorklet[] = [];
  port = {
    onmessage: null as ((event: MessageEvent<Float32Array>) => void) | null,
    close: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
  constructor(_context: unknown, _name: string, _options: unknown) {
    FakeWorklet.instances.push(this);
  }
}

class FakeAudioContext {
  state = 'running';
  sampleRate = 24_000;
  audioWorklet = { addModule: vi.fn(async () => undefined) };
  source = { connect: vi.fn(), disconnect: vi.fn() };
  constructor(_options: unknown) {}
  resume = vi.fn(async () => undefined);
  createMediaStreamSource = vi.fn(() => this.source);
  close = vi.fn(async () => {
    this.state = 'closed';
  });
}

function installBrowserMocks() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn(async () => stream) },
  });
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('AudioWorkletNode', FakeWorklet);
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        value: 'bai-eph-test-secret',
        expires_at: Date.now() / 1000 + 120,
        maxSessionSeconds: 120,
      }),
    ),
  );
  FakeSocket.instances = [];
  FakeWorklet.instances = [];
  return { track };
}

async function connected(
  mode: 'director' | 'story' = 'director',
  callbacks = {},
  captureAudio = true,
  storyContext = 'The lantern has gone dark.',
) {
  const mic = new DirectorMic();
  const cb = {
    onStatus: vi.fn(),
    onSpeechStarted: vi.fn(),
    onSpeechStopped: vi.fn(),
    onTranscript: vi.fn(),
    onEvent: vi.fn(),
    onLevel: vi.fn(),
    onStoryReply: vi.fn(),
    ...callbacks,
  };
  const connecting = mic.connect(cb, {
    mode,
    storyContext,
    captureAudio,
  });
  await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
  const socket = FakeSocket.instances[0]!;
  socket.emit('session.created');
  await connecting;
  return { mic, cb, socket, worklet: FakeWorklet.instances[0]! };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('DirectorMic story and capture controls', () => {
  it('accepts session.created and session.updated without a second configuration send', async () => {
    installBrowserMocks();
    const { socket, cb, mic } = await connected();
    socket.emit('session.updated');
    expect(socket.sent).toHaveLength(1);
    expect(cb.onStatus).toHaveBeenCalledWith('listening');
    mic.disconnect();
  });

  it('reports smoothed levels, stops forwarding while paused, and resets level on cleanup', async () => {
    installBrowserMocks();
    const onLevel = vi.fn();
    const { mic, socket, worklet } = await connected('director', { onLevel });
    worklet.port.onmessage?.({
      data: new Float32Array(480).fill(0.5),
    } as MessageEvent<Float32Array>);
    expect(onLevel).toHaveBeenCalledWith(expect.any(Number));
    expect(onLevel.mock.lastCall?.[0]).toBeGreaterThan(0);
    mic.setInputEnabled(false);
    worklet.port.onmessage?.({
      data: new Float32Array(480).fill(0.5),
    } as MessageEvent<Float32Array>);
    expect(socket.sent.map((item) => JSON.parse(item).type)).toContain('input_audio_buffer.clear');
    expect(socket.sent.map((item) => JSON.parse(item).type)).not.toContain(
      'input_audio_buffer.append',
    );
    mic.disconnect();
    expect(onLevel.mock.lastCall).toEqual([0]);
  });

  it('reports levels before session readiness without queueing PCM for later burst upload', async () => {
    installBrowserMocks();
    const onLevel = vi.fn();
    const mic = new DirectorMic();
    const connecting = mic.connect(
      {
        onStatus: vi.fn(),
        onSpeechStarted: vi.fn(),
        onTranscript: vi.fn(),
        onEvent: vi.fn(),
        onLevel,
      },
      { mode: 'director' },
    );
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    const socket = FakeSocket.instances[0]!;
    const worklet = FakeWorklet.instances[0]!;
    worklet.port.onmessage?.({
      data: new Float32Array(10_000).fill(0.5),
    } as MessageEvent<Float32Array>);
    expect(onLevel).toHaveBeenCalled();
    socket.emit('session.created');
    await connecting;
    worklet.port.onmessage?.({ data: new Float32Array(1).fill(0.5) } as MessageEvent<Float32Array>);
    expect(socket.sent.map((item) => JSON.parse(item).type)).not.toContain(
      'input_audio_buffer.append',
    );
    worklet.port.onmessage?.({
      data: new Float32Array(1000).fill(0.5),
    } as MessageEvent<Float32Array>);
    expect(
      socket.sent
        .map((item) => JSON.parse(item).type)
        .filter((type) => type === 'input_audio_buffer.append'),
    ).toHaveLength(2);
    mic.disconnect();
  });

  it('dispatches one validated story reply only after a completed response', async () => {
    installBrowserMocks();
    const onStoryReply = vi.fn();
    const { socket, cb, mic } = await connected(
      'story',
      { onStoryReply },
      true,
      JSON.stringify({ replyActor: 'pim' }),
    );
    const update = JSON.parse(socket.sent[0]!);
    expect(update.session.output_modalities).toEqual(['text']);
    expect(update.session.tools).toEqual([]);
    expect(update.session.tool_choice).toBe('none');
    expect(update.session.max_output_tokens).toBe(220);
    expect(update.session.instructions).toContain('"replyActor":"pim"');
    socket.emit('response.created');
    const text = JSON.stringify({
      actor: 'pim',
      text: 'I can relight it.',
      emotion: 'determination',
    });
    socket.emit('input_audio_buffer.speech_stopped');
    expect(cb.onSpeechStopped).toHaveBeenCalledTimes(1);
    expect(socket.sent.map((item) => JSON.parse(item).type)).not.toContain(
      'input_audio_buffer.clear',
    );
    socket.emit('input_audio_buffer.committed');
    socket.emit('response.output_text.done', { text });
    expect(onStoryReply).not.toHaveBeenCalled();
    socket.emit('response.done', { response: { status: 'completed' } });
    socket.emit('response.done', { response: { status: 'completed' } });
    expect(onStoryReply).toHaveBeenCalledTimes(1);
    expect(onStoryReply).toHaveBeenCalledWith({
      actor: 'pim',
      text: 'I can relight it.',
      emotion: 'determination',
    });
    mic.disconnect();
  });

  it('accepts plain dialogue and attributes it to the context replyActor', async () => {
    installBrowserMocks();
    const onStoryReply = vi.fn();
    const context = JSON.stringify({ chapter: 'Observatory', replyActor: 'pim' });
    const { socket, mic } = await connected('story', { onStoryReply }, true, context);
    socket.emit('response.created');
    socket.emit('response.output_text.done', { text: 'Pim: I can see the beacon from here.' });
    socket.emit('response.done', { response: { status: 'completed' } });
    expect(onStoryReply).toHaveBeenCalledWith({
      actor: 'pim',
      text: 'I can see the beacon from here.',
      emotion: 'neutral',
    });
    mic.disconnect();
  });

  it('states the selected cast identity and separates it from the user', async () => {
    installBrowserMocks();
    const context = JSON.stringify({ chapter: 'Harbour', replyActor: 'rocco' });
    const { socket, mic } = await connected('story', {}, true, context);
    const update = JSON.parse(socket.sent[0]!);
    expect(update.session.instructions).toContain('You are Rocco');
    expect(update.session.instructions).toContain('The user is a separate fourth character');
    expect(update.session.instructions).toContain(
      "A cast name at the start of the user's line is a way they address the cast, not their name",
    );
    expect(update.session.instructions).toContain('Never address the user by a cast member');
    expect(update.session.instructions).toContain('Use the supplied chapter context as canon');
    mic.disconnect();
  });

  it('accepts a single JSON code fence around a valid structured reply', async () => {
    installBrowserMocks();
    const onStoryReply = vi.fn();
    const { socket, mic } = await connected(
      'story',
      { onStoryReply },
      true,
      JSON.stringify({ replyActor: 'odile' }),
    );
    socket.emit('response.created');
    socket.emit('response.output_text.done', {
      text: '```json\n{"actor":"odile","text":"Hold the line.","emotion":"determination"}\n```',
    });
    socket.emit('response.done', { response: { status: 'completed' } });
    expect(onStoryReply).toHaveBeenCalledWith({
      actor: 'odile',
      text: 'Hold the line.',
      emotion: 'determination',
    });
    mic.disconnect();
  });

  it('rejects malformed JSON and empty completed output', async () => {
    installBrowserMocks();
    const onStoryReply = vi.fn();
    const onEvent = vi.fn();
    const { socket, mic } = await connected('story', { onStoryReply, onEvent });
    socket.emit('response.created');
    socket.emit('response.output_text.done', { text: '{"actor":"pim"' });
    socket.emit('response.done', { response: { status: 'completed' } });
    socket.emit('response.created');
    socket.emit('response.output_text.done', { text: '   ' });
    socket.emit('response.done', { response: { status: 'completed' } });
    expect(onStoryReply).not.toHaveBeenCalled();
    expect(onEvent.mock.calls.filter(([name]) => name === 'story_reply_invalid')).toHaveLength(2);
    mic.disconnect();
  });

  it('rejects invalid story JSON without dispatching a reply', async () => {
    installBrowserMocks();
    const onStoryReply = vi.fn();
    const onEvent = vi.fn();
    const { socket, mic } = await connected('story', { onStoryReply, onEvent });
    socket.emit('response.created');
    socket.emit('response.output_text.done', {
      text: JSON.stringify({ actor: 'captain', text: 'Wrong actor', emotion: 'joy' }),
    });
    socket.emit('response.done', { response: { status: 'completed' } });
    expect(onStoryReply).not.toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalledWith('story_reply_invalid');
    mic.disconnect();
  });

  it('reports a completed story response with missing text as invalid once', async () => {
    installBrowserMocks();
    const onEvent = vi.fn();
    const { socket, mic } = await connected('story', { onEvent });
    socket.emit('response.created');
    socket.emit('response.done', { response: { status: 'completed' } });
    socket.emit('response.done', { response: { status: 'completed' } });
    expect(onEvent.mock.calls.filter(([name]) => name === 'story_reply_invalid')).toHaveLength(1);
    mic.disconnect();
  });

  it('supports typed story input without requesting microphone access', async () => {
    const { track } = installBrowserMocks();
    const media = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
    const { mic, socket } = await connected('story', {}, false);
    expect(media).not.toHaveBeenCalled();
    expect(mic.isCapturingAudio).toBe(false);
    mic.submitStoryText('  '.padEnd(600, 'a'));
    const events = socket.sent.map((item) => JSON.parse(item));
    expect(events.slice(-2)).toEqual([
      {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'a'.repeat(500) }],
        },
      },
      { type: 'response.create' },
    ]);
    const requestCount = socket.sent.length;
    mic.submitStoryText('   ');
    expect(socket.sent).toHaveLength(requestCount);
    expect(track.stop).not.toHaveBeenCalled();
    mic.disconnect();
  });

  it('continues a story beat with response instructions and no invented human message', async () => {
    installBrowserMocks();
    const initial = JSON.stringify({ chapter: 'The Last Hearth', replyActor: 'odile' });
    const { mic, socket } = await connected('story', {}, false, initial);
    mic.updateStoryContext(
      JSON.stringify({
        chapter: 'The Last Hearth',
        replyActor: 'odile',
        premise: 'A sealed letter and a silver coin could buy a safe road home.',
        objective: 'Discover who sent the sealed letter and find a guide through the north pass.',
        stakes: 'The roads close at dawn; the silver coin may be your only safe passage.',
        playerRole: 'A fellow traveler at the table with a clue, a question, or a different plan.',
        conversation: [
          { speaker: 'You', text: 'Find another way.' },
          { speaker: 'Rocco', text: 'The river road is flooded.' },
        ],
      }),
    );
    mic.continueStory();
    const sent = socket.sent.map((message) => JSON.parse(message));
    const request = sent
      .filter((event: { type: string }) => event.type === 'response.create')
      .at(-1)!;
    expect(request.response.instructions).toContain('You are Odile');
    expect(request.response.instructions).toContain('Continue the cast conversation');
    expect(request.response.instructions).toContain('advance the stated objective');
    expect(request.response.instructions).toContain('end with an inviting question or choice');
    expect(request.response.instructions).toContain('playerRole');
    expect(request.response.instructions).toContain('A fellow traveler at the table');
    expect(sent.filter((event) => event.type === 'conversation.item.create')).toHaveLength(0);
    mic.disconnect();
  });

  it('keeps structured dialogue on the context-selected rotating actor', async () => {
    installBrowserMocks();
    const onStoryReply = vi.fn();
    const context = JSON.stringify({ replyActor: 'rocco', conversation: [{ speaker: 'pim' }] });
    const { socket, mic } = await connected('story', { onStoryReply }, false, context);
    socket.emit('response.created');
    socket.emit('response.output_text.done', {
      text: JSON.stringify({ actor: 'pim', text: 'The bridge is clear.', emotion: 'neutral' }),
    });
    socket.emit('response.done', { response: { status: 'completed' } });
    expect(onStoryReply).toHaveBeenCalledWith({
      actor: 'rocco',
      text: 'The bridge is clear.',
      emotion: 'neutral',
    });
    mic.disconnect();
  });

  it('ends the local session at 120 seconds and emits a final zero level', async () => {
    vi.useFakeTimers();
    installBrowserMocks();
    const onLevel = vi.fn();
    const { cb } = await connected('director', { onLevel });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(cb.onStatus).toHaveBeenCalledWith('off', 'Session limit reached');
    expect(onLevel.mock.lastCall).toEqual([0]);
  });
});
