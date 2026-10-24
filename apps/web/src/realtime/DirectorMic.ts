import { z } from 'zod';
import { bytesToBase64, floatToPCM16LE, LinearResampler } from '../audio/pcm';

export type DirectorMicStatus = 'off' | 'connecting' | 'listening' | 'error';
export interface DirectorMicCallbacks {
  onStatus(status: DirectorMicStatus, message?: string): void;
  onSpeechStarted(eventReceivedAt: number): void;
  onTranscript(text: string): void;
  onEvent(name: string): void;
  onLevel?(level: number): void;
  onSpeechStopped?(): void;
  onStoryReply?(reply: StoryReply): void;
}

export type StoryReply = {
  actor: 'odile' | 'rocco' | 'pim';
  text: string;
  emotion:
    'neutral' | 'determination' | 'fear' | 'relief' | 'contemplation' | 'sadness' | 'amusement';
};
export type DirectorMicOptions = {
  mode?: 'director' | 'story';
  storyContext?: string;
  captureAudio?: boolean;
};

const StoryReplySchema = z
  .object({
    actor: z.enum(['odile', 'rocco', 'pim']),
    text: z.string().trim().min(1).max(220),
    emotion: z.enum([
      'neutral',
      'determination',
      'fear',
      'relief',
      'contemplation',
      'sadness',
      'amusement',
    ]),
  })
  .strict();
const StoryActorSchema = z.enum(['odile', 'rocco', 'pim']);
const ACTOR_NAME = { odile: 'Odile', rocco: 'Rocco', pim: 'Pim' } as const;

function expectedStoryActor(context: string): StoryReply['actor'] {
  try {
    const value: unknown = JSON.parse(context);
    if (value && typeof value === 'object' && 'replyActor' in value) {
      const parsed = StoryActorSchema.safeParse(value.replyActor);
      if (parsed.success) return parsed.data;
    }
  } catch {
    /* Existing callers may pass a short prose context. */
  }
  return 'rocco';
}

function parseStoryReply(raw: string, context: string): StoryReply | undefined {
  let text = raw.trim();
  if (!text || text.length > 2000) return undefined;
  const actor = expectedStoryActor(context);
  if (text.startsWith('```')) {
    const fenced = /^```json\s*\n?([\s\S]*?)\n?```$/i.exec(text);
    if (!fenced?.[1]) return undefined;
    text = fenced[1].trim();
  }
  if (text.startsWith('{')) {
    try {
      const parsed = StoryReplySchema.safeParse(JSON.parse(text));
      return parsed.success ? { ...parsed.data, actor } : undefined;
    } catch {
      return undefined;
    }
  }
  if (
    /[{}]|<\||\|>|\r|\n/.test(text) ||
    text.includes('[') ||
    text.includes(']') ||
    text.includes('`')
  )
    return undefined;
  if (/(^|\s)(#{1,6}\s|>\s|[-*]\s)|\*\*|__/.test(text)) return undefined;
  const name = ACTOR_NAME[actor];
  if (text.startsWith(`${name}: `)) text = text.slice(name.length + 2).trim();
  else if (/^(Odile|Rocco|Pim):\s*/i.test(text)) return undefined;
  if (!text || text.length > 220) return undefined;
  return { actor, text, emotion: 'neutral' };
}

const SecretSchema = z.object({
  value: z.string().regex(/^bai-eph-.+/),
  expires_at: z.number().finite(),
  maxSessionSeconds: z.literal(120),
});
const EventBase = z.object({ type: z.string() }).passthrough();
const TranscriptEvent = z
  .object({
    type: z.literal('conversation.item.input_audio_transcription.completed'),
    transcript: z.string().max(2000),
  })
  .passthrough();

const ALLOWED_EVENTS = new Set([
  'session.created',
  'session.updated',
  'input_audio_buffer.speech_started',
  'input_audio_buffer.speech_stopped',
  'input_audio_buffer.committed',
  'input_audio_buffer.cleared',
  'conversation.item.input_audio_transcription.completed',
  'response.created',
  'response.done',
  'response.output_text.delta',
  'response.output_text.done',
  'error',
  'session.max_duration_reached',
  'session.idle_timeout',
]);

/** Browser microphone transport. Construct and connect only from an explicit mic action. */
export class DirectorMic {
  private stream: MediaStream | undefined;
  private context: AudioContext | undefined;
  private source: MediaStreamAudioSourceNode | undefined;
  private worklet: AudioWorkletNode | undefined;
  private socket: WebSocket | undefined;
  private stopTimer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private failedGeneration = 0;
  private connected = false;
  private callbacks?: DirectorMicCallbacks;
  private mode: 'director' | 'story' = 'director';
  private storyContext = '';
  private inputEnabled = true;
  private captureAudio = true;
  private clearPendingAudio: (() => void) | undefined;
  private lastLevelAt = 0;
  private smoothedLevel = 0;
  private pendingStoryText: string | undefined;
  private storyReplySent = false;

  async connect(callbacks: DirectorMicCallbacks, options: DirectorMicOptions = {}): Promise<void> {
    if (this.connected) throw new Error('Microphone session is already active');
    this.connected = true;
    const generation = ++this.generation;
    this.callbacks = callbacks;
    this.mode = options.mode ?? 'director';
    this.storyContext = options.storyContext?.slice(0, 6000) ?? '';
    this.captureAudio = options.captureAudio !== false;
    this.inputEnabled = this.captureAudio;
    this.pendingStoryText = undefined;
    this.storyReplySent = false;
    callbacks.onStatus('connecting');
    this.stopTimer = setTimeout(() => this.finishAtLimit(generation), 120_000);
    try {
      if (this.captureAudio) {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error('Microphone access is unavailable in this browser');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
        if (!this.isCurrent(generation)) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        this.stream = stream;

        const context = new AudioContext({ sampleRate: 24_000 });
        this.context = context;
        this.source = context.createMediaStreamSource(stream);
        await context.resume();
        await context.audioWorklet.addModule('/pcm-capture.worklet.js');
        if (!this.isCurrent(generation)) return;
        this.worklet = new AudioWorkletNode(context, 'pcm-capture', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          channelCount: 1,
        });
        const resampler = new LinearResampler(context.sampleRate, 24_000);
        const pending: number[] = [];
        this.clearPendingAudio = () => {
          pending.length = 0;
        };
        this.worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
          if (!this.isCurrent(generation)) return;
          const samples = event.data;
          let sum = 0;
          for (const sample of samples) sum += sample * sample;
          const rms = samples.length ? Math.sqrt(sum / samples.length) : 0;
          this.smoothedLevel = this.smoothedLevel * 0.75 + Math.min(1, rms * 4) * 0.25;
          const now = performance.now();
          if (now - this.lastLevelAt >= 33) {
            this.lastLevelAt = now;
            callbacks.onLevel?.(this.smoothedLevel);
          }
          if (!this.inputEnabled) return;
          if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.sessionReady)
            return;
          const converted = resampler.push(samples);
          for (const sample of converted) pending.push(sample);
          while (pending.length >= 480) {
            if (this.socket.bufferedAmount > 128 * 1024) {
              this.fail(generation, 'Audio connection is congested');
              return;
            }
            const chunk = Float32Array.from(pending.splice(0, 480));
            this.send({
              type: 'input_audio_buffer.append',
              audio: bytesToBase64(floatToPCM16LE(chunk)),
            });
          }
        };
        this.source.connect(this.worklet);
        this.worklet.connect(context.destination);
      }

      const secretResponse = await fetch('/api/realtime/secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!secretResponse.ok) throw new Error('Could not start the microphone session');
      const secretParsed = SecretSchema.safeParse(await secretResponse.json());
      if (!secretParsed.success || secretParsed.data.expires_at * 1000 <= Date.now())
        throw new Error('Could not start the microphone session');
      if (!this.isCurrent(generation)) return;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const done = (error?: Error) => {
          if (settled) return;
          settled = true;
          if (error) reject(error);
          else resolve();
        };
        const socket = new WebSocket('wss://api.boson.ai/v1/realtime', [
          'realtime',
          `bai-client-secret.${secretParsed.data.value}`,
        ]);
        this.socket = socket;
        socket.onopen = () => {
          if (!this.isCurrent(generation)) {
            socket.close();
            return;
          }
          this.send({
            type: 'session.update',
            session: {
              model: 'higgs-realtime',
              instructions: this.instructions(),
              output_modalities: ['text'],
              audio: {
                input: {
                  format: { type: 'audio/pcm', rate: 24_000 },
                  noise_reduction: { type: 'near_field' },
                  transcription: { model: 'higgs-stt-3.1' },
                  turn_detection: {
                    type: 'server_vad',
                    threshold: 0.85,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500,
                    min_speech_duration: 0.125,
                  },
                },
              },
              tools: [],
              tool_choice: 'none',
              max_output_tokens: this.mode === 'story' ? 220 : 32,
            },
          });
        };
        socket.onmessage = (message) => {
          if (!this.isCurrent(generation)) return;
          if (typeof message.data !== 'string') return;
          let raw: unknown;
          try {
            raw = JSON.parse(message.data);
          } catch {
            return;
          }
          const base = EventBase.safeParse(raw);
          if (!base.success) return;
          const name = base.data.type;
          if (!ALLOWED_EVENTS.has(name)) return;
          if (name === 'session.created' || name === 'session.updated') {
            if (!this.sessionReady) {
              this.sessionReady = true;
              callbacks.onStatus('listening');
              done();
            }
          } else if (name === 'input_audio_buffer.speech_started') {
            callbacks.onSpeechStarted(performance.now());
          } else if (name === 'input_audio_buffer.speech_stopped') {
            if (this.mode === 'story') this.setInputEnabled(false, false);
            callbacks.onSpeechStopped?.();
          } else if (name === 'conversation.item.input_audio_transcription.completed') {
            const transcript = TranscriptEvent.safeParse(raw);
            if (transcript.success) callbacks.onTranscript(transcript.data.transcript);
          } else if (this.mode === 'story' && name === 'response.created') {
            this.pendingStoryText = undefined;
            this.storyReplySent = false;
          } else if (this.mode === 'story' && name === 'response.output_text.done') {
            const output = z
              .object({ text: z.string().max(2000) })
              .passthrough()
              .safeParse(raw);
            if (output.success) this.pendingStoryText = output.data.text;
          } else if (this.mode === 'story' && name === 'response.done') {
            const completed = z
              .object({ response: z.object({ status: z.literal('completed') }).passthrough() })
              .passthrough()
              .safeParse(raw);
            if (completed.success && !this.storyReplySent) {
              this.storyReplySent = true;
              if (this.pendingStoryText === undefined) {
                callbacks.onEvent('story_reply_invalid');
              } else {
                const reply = parseStoryReply(this.pendingStoryText, this.storyContext);
                if (reply) callbacks.onStoryReply?.(reply);
                else callbacks.onEvent('story_reply_invalid');
              }
            }
          } else if (name === 'error') {
            this.fail(generation, 'Realtime connection reported an error');
            done(new Error('Realtime connection failed'));
            return;
          } else if (name === 'session.max_duration_reached') {
            this.finishAtLimit(generation);
          }
          callbacks.onEvent(name);
        };
        socket.onerror = () => {
          this.fail(generation, 'Realtime connection failed');
          done(new Error('Realtime connection failed'));
        };
        socket.onclose = () => {
          if (!settled) done(new Error('Realtime connection closed'));
          if (this.isCurrent(generation)) this.stopResources('off');
        };
      });
    } catch {
      if (!this.isCurrent(generation)) {
        if (this.failedGeneration === generation)
          throw new Error('Microphone session could not be started');
        return;
      }
      this.stopResources('error', 'Microphone session could not be started');
      throw new Error('Microphone session could not be started');
    }
  }

  private sessionReady = false;
  get isCapturingAudio(): boolean {
    return this.captureAudio && Boolean(this.stream);
  }
  private instructions(): string {
    if (this.mode !== 'story')
      return 'You are Wren, a concise voice companion. Give short acknowledgements. Never claim to use tools or take actions.';
    const actorName = ACTOR_NAME[expectedStoryActor(this.storyContext)];
    return [
      `You are ${actorName}, one of the CUT! cast. The user is a separate fourth character, not Odile, Rocco, or Pim. A cast name at the start of the user's line is a way they address the cast, not their name. Never address the user by a cast member's name, including your own, and never prefix your dialogue with your name.`,
      'Use the supplied chapter context as canon. Advance the objective in small concrete steps while respecting the stated stakes. Odile is observant and practical; Rocco is warm, impulsive, and protective; Pim is curious and earnest. Respond specifically to the point the user just made.',
      'The user has a small but meaningful role described in the context. Leave their decisions and actions to them; invite their contribution without pretending they have already acted.',
      'Return only your plain spoken dialogue, at most 200 characters. Do not return JSON, a speaker prefix, markdown, code fences, inline tags, or stage directions.',
      this.storyContext ? `Current story context:\n${this.storyContext}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  setInputEnabled(enabled: boolean, clearProviderBuffer = true): void {
    if (this.inputEnabled === enabled) {
      if (!enabled && this.captureAudio && clearProviderBuffer && this.sessionReady)
        this.send({ type: 'input_audio_buffer.clear' });
      return;
    }
    this.inputEnabled = enabled;
    this.clearPendingAudio?.();
    if (!enabled && this.captureAudio && clearProviderBuffer && this.sessionReady)
      this.send({ type: 'input_audio_buffer.clear' });
  }
  submitStoryText(text: string): void {
    if (this.mode !== 'story' || !this.sessionReady) return;
    const bounded = text.trim().slice(0, 500);
    if (!bounded) return;
    this.setInputEnabled(false);
    this.send({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: bounded }] },
    });
    this.send({ type: 'response.create' });
  }
  continueStory(): void {
    if (this.mode !== 'story' || !this.sessionReady) return;
    const continuation = [
      this.instructions(),
      'Continue the cast conversation after the previous cast member. Respond directly to their last spoken line, advance the stated objective by one concrete step while respecting the stakes, and keep the other actors distinct. The user has the small meaningful role described in context; leave their decisions open and end with an inviting question or choice that gives them a natural way to contribute. Do not invent or repeat a user message, and do not speak as the user.',
    ].join('\n\n');
    this.send({
      type: 'response.create',
      response: { instructions: continuation, max_output_tokens: 220 },
    });
  }
  updateStoryContext(context: string): void {
    if (context.length > 6000) throw new Error('Story context is too long');
    this.storyContext = context;
    if (this.connected && this.mode === 'story' && this.sessionReady) {
      this.send({
        type: 'session.update',
        session: {
          instructions: this.instructions(),
          output_modalities: ['text'],
          tools: [],
          tool_choice: 'none',
          max_output_tokens: 220,
        },
      });
    }
  }
  private isCurrent(generation: number): boolean {
    return this.generation === generation && this.connected;
  }
  private send(event: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(event));
  }
  private fail(generation: number, message: string): void {
    if (!this.isCurrent(generation)) return;
    this.failedGeneration = generation;
    this.stopResources('error', message);
  }
  private finishAtLimit(generation: number): void {
    if (!this.isCurrent(generation)) return;
    this.stopResources('off', 'Session limit reached');
  }
  private stopResources(status: DirectorMicStatus, message?: string): void {
    this.connected = false;
    this.sessionReady = false;
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = undefined;
    if (this.worklet) {
      this.worklet.port.onmessage = null;
      this.worklet.port.close();
      this.worklet.disconnect();
    }
    this.clearPendingAudio = undefined;
    this.worklet = undefined;
    this.source?.disconnect();
    this.source = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
    const socket = this.socket;
    this.socket = undefined;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    this.callbacks?.onLevel?.(0);
    this.smoothedLevel = 0;
    this.lastLevelAt = 0;
    this.pendingStoryText = undefined;
    this.storyReplySent = false;
    this.inputEnabled = true;
    this.captureAudio = true;
    this.callbacks?.onStatus(status, message);
  }

  disconnect(): void {
    ++this.generation;
    this.stopResources('off');
  }
}
