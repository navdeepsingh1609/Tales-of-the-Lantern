import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { TagsSchema } from '@cut/shared';

const ActorSchema = z.enum(['odile', 'rocco', 'pim']);
const SceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  actors: z.array(z.string()),
  lines: z.array(
    z.object({
      id: z.string(),
      actor: ActorSchema,
      lang: z.string(),
      tags: z.array(z.string()),
      text: z.string(),
    }),
  ),
  cues: z.array(z.unknown()),
  cache: z.array(
    z.object({
      id: z.string(),
      actor: ActorSchema,
      voice: z.string(),
      audioHash: z.string().regex(/^[a-f0-9]{64}$/),
      avatarHash: z.string().regex(/^[a-f0-9]{64}$/),
      audio: z.boolean(),
      video: z.boolean(),
    }),
  ),
});
const ClipSchema = z.object({
  tags: TagsSchema.optional(),
  id: z.string(),
  actor: ActorSchema,
  language: z.string(),
  text: z.string(),
  voice: z.string(),
  audioUrl: z.string(),
  videoUrl: z.string().optional(),
  mode: z.enum(['avatar', 'audio-only']),
  cached: z.boolean(),
});
const JobSchema = z.object({
  id: z.string(),
  status: z.enum(['preparing', 'ready', 'partial', 'error', 'cancelled']),
  progress: z.number().finite().min(0),
  lines: z.array(ClipSchema),
  error: z.string().optional(),
});

export type CastClip = z.infer<typeof ClipSchema>;
export type CastJobStatus = z.infer<typeof JobSchema>['status'] | 'idle';
export type CastEvent =
  | 'scene_loaded'
  | 'prepare_started'
  | 'prepare_finished'
  | 'prepare_failed'
  | 'playback_started'
  | 'line_started'
  | 'line_finished'
  | 'playback_cut'
  | 'playback_reset';
export type CastPlaybackMode = 'none' | 'avatar-replay' | 'audio-only';
export interface UseCastPerformanceOptions {
  onEvent?: (event: CastEvent) => void;
  sceneId?: 'lighthouse' | 'tavern' | 'observatory';
}
export interface CustomCastLine {
  actor: z.infer<typeof ActorSchema>;
  text: string;
  tags: string[];
}
type CastComparison = {
  ephemeral?: boolean;
  sceneId: 'lighthouse' | 'tavern' | 'observatory';
  index: number;
  original: CastClip;
  directed: CastClip;
};
export type CastTake = 'original' | 'directed';
type ReplacementMode = {
  ephemeral?: boolean;
  kind: 'replacement';
  index: number;
  original: CastClip;
  sceneId: 'lighthouse' | 'tavern' | 'observatory';
};
type EphemeralMode = {
  kind: 'ephemeral';
  sceneId: 'lighthouse' | 'tavern' | 'observatory';
  auditionIndex: number;
};
type PreparationMode = ReplacementMode | EphemeralMode;

const MEDIA_PATH = /^\/api\/performance\/media\/[a-f0-9]{64}\/(?:audio|video)$/;
const safeMediaUrl = (value: string): string | null => (MEDIA_PATH.test(value) ? value : null);
const genericError = 'The cast could not be loaded. Check the local server and try again.';
const preparationErrorMessage = (code: unknown, status?: number): string => {
  if (code === 'generation_disabled' || status === 503)
    return 'Cast generation is currently disabled.';
  if (code === 'job_in_progress' || status === 409)
    return 'Another cast is already being prepared. Try again when it finishes.';
  if (code === 'provider_quota_exceeded' || status === 429)
    return 'Boson returned a quota or rate-limit error. Check your Boson workspace usage.';
  if (code === 'provider_key_refused') return 'Boson did not accept the server API key.';
  if (code === 'missing_asset') return 'The character reference image is missing.';
  return genericError;
};

/** Explicit cast preparation and sequential local playback; mounting only reads the local cache. */
export function useCastPerformance({
  onEvent,
  sceneId = 'lighthouse',
}: UseCastPerformanceOptions = {}) {
  const [clips, setClips] = useState<CastClip[]>([]);
  const [jobStatus, setJobStatus] = useState<CastJobStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [completionCount, setCompletionCount] = useState(0);
  const [currentLine, setCurrentLine] = useState<CastClip | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [playbackMode, setPlaybackMode] = useState<CastPlaybackMode>('none');
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<CastComparison | null>(null);
  const comparisonRef = useRef<CastComparison | null>(null);
  const [hasStoryReply, setHasStoryReply] = useState(false);
  const storyReplyRef = useRef<CastClip | null>(null);
  const sceneIdRef = useRef(sceneId);
  sceneIdRef.current = sceneId;
  const onEventRef = useRef(onEvent);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const runTokenRef = useRef(0);
  const nextIndexRef = useRef(0);
  const clipsRef = useRef<CastClip[]>([]);
  const prepareAbortRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const storyPreparationRef = useRef<AbortController | null>(null);
  const storyJobRef = useRef<string | null>(null);
  const storySettledRef = useRef<Promise<void>>(Promise.resolve());
  const queuedStoryRef = useRef<{
    clip: CastClip;
    sceneId: string;
    video: HTMLVideoElement;
  } | null>(null);
  const cancelStoryPreparation = useCallback(() => {
    storyPreparationRef.current?.abort();
    const id = storyJobRef.current;
    storyJobRef.current = null;
    if (id)
      void fetch(`/api/performance/job/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }).catch(() => undefined);
    const queued = queuedStoryRef.current;
    if (queued) {
      queued.video.removeAttribute('src');
      queued.video.load();
    }
    queuedStoryRef.current = null;
  }, []);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  const emit = useCallback((event: CastEvent) => {
    onEventRef.current?.(event);
  }, []);
  const setClipList = useCallback((next: CastClip[]) => {
    clipsRef.current = next;
    setClips(next);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        try {
          const latestResponse = await fetch(
            `/api/performance/latest?sceneId=${encodeURIComponent(sceneId)}`,
            {
              signal: controller.signal,
            },
          );
          if (latestResponse.ok) {
            const latest = z
              .object({ lines: z.array(ClipSchema) })
              .safeParse(await latestResponse.json());
            if (latest.success) {
              const latestClips = latest.data.lines.filter(
                (clip) =>
                  safeMediaUrl(clip.audioUrl) !== null &&
                  (!clip.videoUrl || safeMediaUrl(clip.videoUrl) !== null),
              );
              if (latestClips.length) {
                if (controller.signal.aborted) return;
                setClipList(latestClips);
                setJobStatus(
                  latestClips.some((clip) => clip.mode === 'audio-only') ? 'partial' : 'ready',
                );
                setProgress(latestClips.length);
                emit('scene_loaded');
                return;
              }
            }
          }
        } catch {
          if (controller.signal.aborted) return;
          // The authored scene remains the offline fallback.
        }
        if (sceneId !== 'lighthouse') {
          if (controller.signal.aborted) return;
          setClipList([]);
          setJobStatus('idle');
          setProgress(0);
          return;
        }
        const response = await fetch('/api/performance/scene', { signal: controller.signal });
        if (!response.ok) throw new Error('scene');
        const parsed = SceneSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error('scene');
        const cache = new Map(parsed.data.cache.map((entry) => [entry.id, entry]));
        const restored: CastClip[] = [];
        for (const line of parsed.data.lines) {
          const entry = cache.get(line.id);
          if (!entry?.audio) continue;
          const audioUrl = safeMediaUrl(`/api/performance/media/${entry.audioHash}/audio`);
          const videoUrl = entry.video
            ? safeMediaUrl(`/api/performance/media/${entry.avatarHash}/video`)
            : null;
          if (!audioUrl) continue;
          restored.push({
            tags: TagsSchema.parse(line.tags),
            id: line.id,
            actor: line.actor,
            language: line.lang,
            text: line.text,
            voice: entry.voice,
            audioUrl,
            ...(videoUrl ? { videoUrl } : {}),
            mode: videoUrl ? 'avatar' : 'audio-only',
            cached: true,
          });
        }
        if (controller.signal.aborted) return;
        setClipList(restored);
        setJobStatus(
          restored.length === parsed.data.lines.length
            ? 'ready'
            : restored.length
              ? 'partial'
              : 'idle',
        );
        setProgress(restored.length);
        emit('scene_loaded');
      } catch {
        if (!controller.signal.aborted) setError(genericError);
      }
    })();
    return () => controller.abort();
  }, [emit, sceneId, setClipList]);

  const stopMedia = useCallback((removeSource: boolean) => {
    const media = mediaRef.current;
    if (!media) return;
    media.pause();
    media.onended = null;
    media.onerror = null;
    media.ontimeupdate = null;
    media.onloadedmetadata = null;
    if (removeSource) {
      media.removeAttribute('src');
      media.load();
    }
    mediaRef.current = null;
    setVideo(null);
  }, []);

  useEffect(() => {
    runTokenRef.current++;
    cancelStoryPreparation();
    stopMedia(true);
    const controller = prepareAbortRef.current;
    if (controller) {
      controller.abort();
      const id = jobIdRef.current;
      if (id)
        void fetch(`/api/performance/job/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }).catch(() => undefined);
    }
    setClipList([]);
    setJobStatus('idle');
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    setCurrentLine(null);
    setPlaybackMode('none');
    setError(null);
    comparisonRef.current = null;
    setComparison(null);
    storyReplyRef.current = null;
    setHasStoryReply(false);
    nextIndexRef.current = 0;
  }, [sceneId, setClipList, stopMedia, cancelStoryPreparation]);

  const startAt = useCallback(
    async (
      index: number,
      token: number,
      audition?: CastClip,
      preloaded?: HTMLVideoElement,
    ): Promise<void> => {
      const list = clipsRef.current;
      if (token !== runTokenRef.current) return;
      if (index >= list.length) {
        stopMedia(false);
        setCurrentTime(0);
        setDuration(0);
        setPlaying(false);
        setCurrentLine(null);
        setPlaybackMode('none');
        nextIndexRef.current = 0;
        return;
      }
      const clip = audition ?? list[index]!;
      nextIndexRef.current = index;
      setCurrentLine(clip);
      setPlaying(true);
      emit('line_started');
      const advance = () => {
        if (token !== runTokenRef.current) return;
        setCompletionCount((count) => count + 1);
        emit('line_finished');
        if (audition) {
          const media = mediaRef.current;
          if (media) {
            media.pause();
            media.onended = null;
            media.onerror = null;
            media.ontimeupdate = null;
            media.onloadedmetadata = null;
          }
          setPlaying(false);
          setCurrentLine(clip);
          setPlaybackMode(clip.videoUrl ? 'avatar-replay' : 'audio-only');
          return;
        }
        void startAt(index + 1, token);
      };
      const trackProgress = (media: HTMLMediaElement) => {
        media.ontimeupdate = () => setCurrentTime(media.currentTime || 0);
        media.onloadedmetadata = () => {
          setDuration(Number.isFinite(media.duration) ? media.duration : 0);
        };
        setCurrentTime(0);
        setDuration(0);
      };
      const startAudio = async () => {
        const audioUrl = safeMediaUrl(clip.audioUrl);
        if (!audioUrl) throw new Error('media');
        stopMedia(true);
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';
        audio.onended = advance;
        trackProgress(audio);
        audio.onerror = () => {
          if (token === runTokenRef.current) {
            setError('This audio clip could not be played.');
            setPlaying(false);
          }
        };
        mediaRef.current = audio;
        setPlaybackMode('audio-only');
        setVideo(null);
        try {
          await audio.play();
        } catch {
          if (token === runTokenRef.current) {
            setError('Playback could not start. Press Play to try again.');
            setPlaying(false);
          }
        }
      };
      if (clip.videoUrl) {
        const videoUrl = safeMediaUrl(clip.videoUrl);
        if (videoUrl) {
          stopMedia(true);
          const element =
            preloaded && !preloaded.error ? preloaded : document.createElement('video');
          if (element.getAttribute('src') !== videoUrl) element.src = videoUrl;
          element.preload = 'auto';
          element.playsInline = true;
          element.onended = advance;
          trackProgress(element);
          element.onerror = () => {
            if (token !== runTokenRef.current) return;
            if (!audition)
              setClipList(
                clipsRef.current.map((item, i) =>
                  i === index ? { ...item, videoUrl: undefined, mode: 'audio-only' } : item,
                ),
              );
            void startAudio();
          };
          mediaRef.current = element;
          setVideo(element);
          setPlaybackMode('avatar-replay');
          try {
            await element.play();
          } catch {
            if (token === runTokenRef.current) {
              setError('Playback could not start. Press Play to try again.');
              setPlaying(false);
            }
          }
          return;
        }
      }
      await startAudio();
    },
    [emit, setClipList, stopMedia],
  );

  const prepareRequest = useCallback(
    async (
      body: {
        language: 'en' | 'es';
        avatars: boolean;
        referenceSet: 'portrait' | 'scene';
        sceneId: 'lighthouse' | 'tavern' | 'observatory';
        framing: 'portrait' | 'landscape';
        persistSnapshot?: boolean;
        lines?: CustomCastLine[];
      },
      mode?: PreparationMode,
    ): Promise<boolean> => {
      const requestedToken = runTokenRef.current;
      const requestedScene = sceneIdRef.current;
      cancelStoryPreparation();
      await storySettledRef.current;
      if (requestedToken !== runTokenRef.current || requestedScene !== sceneIdRef.current)
        return false;
      if (prepareAbortRef.current) return false;
      const preservesScene = mode !== undefined;
      runTokenRef.current++;
      if (preservesScene) {
        const media = mediaRef.current;
        media?.pause();
        if (media) {
          media.onended = null;
          media.onerror = null;
          media.ontimeupdate = null;
          media.onloadedmetadata = null;
        }
      } else stopMedia(true);
      setPlaying(false);
      if (!preservesScene) {
        setCurrentLine(null);
        setPlaybackMode('none');
        nextIndexRef.current = 0;
      }
      const controller = new AbortController();
      prepareAbortRef.current = controller;
      setError(null);
      setJobStatus('preparing');
      setProgress(0);
      emit('prepare_started');
      let ownedJobId: string | null = null;
      try {
        const postTimeout = new AbortController();
        const timeout = window.setTimeout(() => postTimeout.abort(), 10_000);
        let response: Response;
        try {
          response = await fetch('/api/performance/prepare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: postTimeout.signal,
          });
        } finally {
          window.clearTimeout(timeout);
        }
        if (response.status !== 202) {
          if (controller.signal.aborted) return false;
          let code: unknown;
          try {
            const payload: unknown = await response.json();
            code = z.object({ error: z.string() }).safeParse(payload).data?.error;
          } catch {
            // Use the status-only safe message when no JSON error code is available.
          }
          setError(preparationErrorMessage(code, response.status));
          setJobStatus('error');
          emit('prepare_failed');
          return false;
        }
        const initial: unknown = await response.json();
        const id = z.object({ id: z.string() }).safeParse(initial);
        if (!id.success) throw new Error('prepare');
        ownedJobId = id.data.id;
        jobIdRef.current = id.data.id;
        if (controller.signal.aborted) {
          void fetch(`/api/performance/job/${encodeURIComponent(id.data.id)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          }).catch(() => undefined);
          return false;
        }
        while (!controller.signal.aborted) {
          await new Promise<void>((resolve, reject) => {
            const onAbort = () => {
              window.clearTimeout(timer);
              controller.signal.removeEventListener('abort', onAbort);
              reject(new DOMException('Aborted', 'AbortError'));
            };
            const timer = window.setTimeout(() => {
              controller.signal.removeEventListener('abort', onAbort);
              resolve();
            }, 750);
            controller.signal.addEventListener('abort', onAbort, { once: true });
          });
          const poll = await fetch(`/api/performance/job/${encodeURIComponent(id.data.id)}`, {
            signal: controller.signal,
          });
          if (controller.signal.aborted) return false;
          if (!poll.ok) throw new Error('job');
          const parsed = JobSchema.safeParse(await poll.json());
          if (!parsed.success) throw new Error('job');
          const safeLines = parsed.data.lines.filter(
            (clip) =>
              safeMediaUrl(clip.audioUrl) !== null &&
              (!clip.videoUrl || safeMediaUrl(clip.videoUrl) !== null),
          );
          if (!preservesScene) setClipList(safeLines);
          setProgress(parsed.data.progress);
          setJobStatus(parsed.data.status);
          if (parsed.data.status !== 'preparing') {
            if (mode) {
              if (
                sceneIdRef.current === mode.sceneId &&
                parsed.data.status === 'ready' &&
                safeLines.length === 1 &&
                safeLines[0]?.videoUrl
              ) {
                const generated = safeLines[0];
                if (mode.kind === 'replacement') {
                  if (mode.ephemeral) {
                    storyReplyRef.current = generated;
                    setHasStoryReply(true);
                  } else {
                    const next = clipsRef.current.map((clip, index) =>
                      index === mode.index ? generated : clip,
                    );
                    setClipList(next);
                  }
                  nextIndexRef.current = mode.index;
                  setCurrentLine(generated);
                  const pair = {
                    sceneId: mode.sceneId,
                    index: mode.index,
                    original: mode.original,
                    directed: generated,
                    ...(mode.ephemeral ? { ephemeral: true } : {}),
                  };
                  comparisonRef.current = pair;
                  setComparison(pair);
                } else {
                  nextIndexRef.current = mode.auditionIndex;
                  storyReplyRef.current = generated;
                  setHasStoryReply(true);
                  setCurrentLine(generated);
                  await startAt(mode.auditionIndex, runTokenRef.current, generated);
                }
                setError(null);
                emit('prepare_finished');
                return true;
              } else if (
                parsed.data.status === 'error' ||
                parsed.data.status === 'cancelled' ||
                parsed.data.status === 'partial' ||
                !safeLines[0]?.videoUrl
              ) {
                setError(
                  parsed.data.status === 'error'
                    ? preparationErrorMessage(parsed.data.error)
                    : parsed.data.status === 'cancelled'
                      ? 'Cast preparation was cancelled.'
                      : mode.kind === 'ephemeral'
                        ? 'The story reply could not be generated. The scene remains unchanged.'
                        : 'The directed take could not be generated. The original take is still selected.',
                );
                emit('prepare_failed');
              }
              return false;
            }
            if (parsed.data.status === 'error' || parsed.data.status === 'cancelled') {
              setError(
                parsed.data.status === 'error'
                  ? preparationErrorMessage(parsed.data.error)
                  : 'Cast preparation was cancelled.',
              );
              emit('prepare_failed');
            } else emit('prepare_finished');
            return parsed.data.status === 'ready';
          }
        }
        return false;
      } catch {
        if (!controller.signal.aborted) {
          setError(genericError);
          setJobStatus('error');
          emit('prepare_failed');
        }
        return false;
      } finally {
        if (prepareAbortRef.current === controller) prepareAbortRef.current = null;
        if (ownedJobId !== null && jobIdRef.current === ownedJobId) jobIdRef.current = null;
      }
    },
    [cancelStoryPreparation, emit, setClipList, startAt, stopMedia],
  );

  const prepare = useCallback(
    async (
      language: 'en' | 'es',
      avatars: boolean,
      referenceSet: 'portrait' | 'scene' = 'portrait',
    ) => {
      await prepareRequest({ language, avatars, referenceSet, sceneId, framing: 'portrait' });
    },
    [prepareRequest, sceneId],
  );
  const prepareCustom = useCallback(
    async (
      lines: CustomCastLine[],
      referenceSet: 'portrait' | 'scene' = 'scene',
      framing: 'portrait' | 'landscape' = 'landscape',
    ): Promise<void> => {
      await prepareRequest({
        language: 'en',
        avatars: true,
        referenceSet,
        sceneId,
        framing,
        lines,
      });
    },
    [prepareRequest, sceneId],
  );

  const directCurrentLine = useCallback(
    async (tags: string[], editedText?: string): Promise<void> => {
      if (prepareAbortRef.current) return;
      const index = nextIndexRef.current;
      const held = currentLine ?? clipsRef.current[index];
      if (!held) {
        setError('Choose a scene line before directing a retake.');
        return Promise.resolve();
      }
      const existing = comparisonRef.current;
      const original =
        existing?.sceneId === sceneId && existing.index === index ? existing.original : held;
      const sourceText =
        editedText === undefined ? held.text.replace(/<\|[^|]+\|>/g, '') : editedText;
      const text = sourceText.trim();
      if (!text || text.length > 220) {
        setError('Spoken line must contain 1 to 220 characters.');
        return;
      }
      await prepareRequest(
        {
          language: 'en',
          avatars: true,
          referenceSet: 'scene',
          sceneId,
          framing: 'landscape',
          persistSnapshot: false,
          lines: [{ actor: held.actor, text, tags }],
        },
        {
          kind: 'replacement',
          index,
          original,
          sceneId,
          ...(held.id === storyReplyRef.current?.id || existing?.ephemeral
            ? { ephemeral: true }
            : {}),
        },
      );
    },
    [currentLine, prepareRequest, sceneId],
  );

  const performStoryReply = useCallback(
    async (line: CustomCastLine): Promise<boolean> => {
      const text = line.text.trim();
      if (!text || text.length > 220 || prepareAbortRef.current) {
        if (!text || text.length > 220) setError('Spoken line must contain 1 to 220 characters.');
        return false;
      }
      comparisonRef.current = null;
      setComparison(null);
      return prepareRequest(
        {
          language: 'en',
          avatars: true,
          referenceSet: 'scene',
          sceneId,
          framing: 'landscape',
          persistSnapshot: false,
          lines: [{ ...line, text }],
        },
        { kind: 'ephemeral', sceneId, auditionIndex: nextIndexRef.current },
      );
    },
    [prepareRequest, sceneId],
  );

  // One speculative line may render while the current media keeps playing.
  // It owns neither the visible job status nor the playback token.
  const prepareStoryReply = useCallback(
    async (line: CustomCastLine): Promise<CastClip | null> => {
      const text = line.text.trim();
      if (!text || text.length > 220 || prepareAbortRef.current || storyPreparationRef.current)
        return null;
      cancelStoryPreparation();
      const controller = new AbortController();
      const originScene = sceneId;
      let settled!: () => void;
      storySettledRef.current = new Promise<void>((resolve) => {
        settled = resolve;
      });
      storyPreparationRef.current = controller;
      let ownedId: string | null = null;
      const current = () => !controller.signal.aborted && sceneIdRef.current === originScene;
      const timeout = window.setTimeout(() => controller.abort(), 90_000);
      try {
        // Keep the POST alive until its job ID is known, even if the user cuts.
        // This lets a late acknowledgement be cancelled on the server as well.
        const response = await fetch('/api/performance/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: 'en',
            avatars: true,
            referenceSet: 'scene',
            sceneId: originScene,
            framing: 'landscape',
            persistSnapshot: false,
            lines: [{ ...line, text }],
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (response.status !== 202) return null;
        const initial = z.object({ id: z.string() }).safeParse(await response.json());
        if (!initial.success) return null;
        ownedId = initial.data.id;
        storyJobRef.current = ownedId;
        while (current()) {
          const poll = await fetch(`/api/performance/job/${encodeURIComponent(ownedId)}`, {
            signal: controller.signal,
          });
          if (!poll.ok) return null;
          const result = JobSchema.safeParse(await poll.json());
          if (!result.success || !current()) return null;
          if (result.data.status !== 'preparing') {
            const clip = result.data.lines[0];
            if (
              result.data.status !== 'ready' ||
              result.data.lines.length !== 1 ||
              !clip?.videoUrl ||
              !safeMediaUrl(clip.audioUrl) ||
              !safeMediaUrl(clip.videoUrl)
            )
              return null;
            const video = document.createElement('video');
            video.preload = 'auto';
            video.playsInline = true;
            video.src = clip.videoUrl;
            video.load();
            queuedStoryRef.current = { clip, sceneId: originScene, video };
            return clip;
          }
          await new Promise<void>((resolve, reject) => {
            const aborted = () => {
              window.clearTimeout(timer);
              controller.signal.removeEventListener('abort', aborted);
              reject(new DOMException('Aborted', 'AbortError'));
            };
            const timer = window.setTimeout(() => {
              controller.signal.removeEventListener('abort', aborted);
              resolve();
            }, 250);
            controller.signal.addEventListener('abort', aborted, { once: true });
          });
        }
        return null;
      } catch {
        return null;
      } finally {
        window.clearTimeout(timeout);
        if (controller.signal.aborted && ownedId) {
          try {
            await fetch(`/api/performance/job/${encodeURIComponent(ownedId)}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
              signal: AbortSignal.timeout(2000),
            });
            // DELETE acknowledges cancellation before the provider unwinds.
            // Wait for that job to release the single-generation slot.
            for (let i = 0; i < 20; i++) {
              const response = await fetch(`/api/performance/job/${encodeURIComponent(ownedId)}`, {
                signal: AbortSignal.timeout(1000),
              });
              if (!response.ok) break;
              const state = JobSchema.safeParse(await response.json());
              if (!state.success || state.data.status !== 'preparing') break;
              await new Promise((resolve) => window.setTimeout(resolve, 100));
            }
          } catch {
            /* A failed cancellation acknowledgement must not strand the UI. */
          }
        }
        if (storyPreparationRef.current === controller) storyPreparationRef.current = null;
        if (storyJobRef.current === ownedId) storyJobRef.current = null;
        settled();
      }
    },
    [cancelStoryPreparation, sceneId],
  );

  const playStoryClip = useCallback(
    async (clip: CastClip): Promise<boolean> => {
      const queued = queuedStoryRef.current;
      if (!queued || queued.sceneId !== sceneIdRef.current || queued.clip !== clip) return false;
      queuedStoryRef.current = null;
      storyReplyRef.current = clip;
      setHasStoryReply(true);
      runTokenRef.current++;
      setError(null);
      await startAt(nextIndexRef.current, runTokenRef.current, clip, queued.video);
      return true;
    },
    [startAt],
  );

  const auditionTake = useCallback(
    (take: CastTake) => {
      const pair = comparisonRef.current;
      if (!pair || pair.sceneId !== sceneId || pair.index !== nextIndexRef.current) return;
      const selected = pair[take];
      if (!pair.ephemeral)
        setClipList(
          clipsRef.current.map((clip, index) => (index === pair.index ? selected : clip)),
        );
      else storyReplyRef.current = selected;
      nextIndexRef.current = pair.index;
      runTokenRef.current++;
      const token = runTokenRef.current;
      setError(null);
      setPlaying(true);
      emit('playback_started');
      void startAt(pair.index, token, selected);
    },
    [emit, sceneId, setClipList, startAt],
  );

  const holdLine = useCallback(
    (index = 0) => {
      if (
        prepareAbortRef.current ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= clipsRef.current.length
      )
        return;
      runTokenRef.current++;
      stopMedia(true);
      nextIndexRef.current = index;
      setCurrentLine(clipsRef.current[index]!);
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setPlaybackMode('audio-only');
      setError(null);
      const pair = comparisonRef.current;
      if (pair && (pair.sceneId !== sceneId || pair.index !== index)) {
        comparisonRef.current = null;
        setComparison(null);
      }
    },
    [sceneId, stopMedia],
  );

  const cancelPreparation = useCallback(() => {
    const controller = prepareAbortRef.current;
    if (!controller) return;
    controller.abort();
    const id = jobIdRef.current;
    if (id)
      void fetch(`/api/performance/job/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }).catch(() => undefined);
    setJobStatus('cancelled');
  }, []);

  const replayStoryReply = useCallback(() => {
    const reply = storyReplyRef.current;
    if (!reply || prepareAbortRef.current || jobStatus === 'preparing') return;
    runTokenRef.current++;
    const token = runTokenRef.current;
    setError(null);
    setPlaying(true);
    emit('playback_started');
    void startAt(nextIndexRef.current, token, reply);
  }, [emit, jobStatus, startAt]);

  const roll = useCallback(() => {
    if (!clipsRef.current.length) {
      setError('No prepared cast clips are available yet.');
      return;
    }
    runTokenRef.current++;
    const token = runTokenRef.current;
    const index = currentLine ? nextIndexRef.current : 0;
    stopMedia(true);
    setError(null);
    setPlaying(true);
    setPlaybackMode('none');
    emit('playback_started');
    void startAt(index, token);
  }, [currentLine, emit, startAt, stopMedia]);

  const cut = useCallback(
    (eventAt?: number): number => {
      const started = eventAt ?? performance.now();
      runTokenRef.current++;
      const media = mediaRef.current;
      media?.pause();
      if (media) {
        media.onended = null;
        media.onerror = null;
        media.ontimeupdate = null;
        media.onloadedmetadata = null;
      }
      setVideo(media instanceof HTMLVideoElement ? media : null);
      setPlaying(false);
      const elapsed = Math.max(0, performance.now() - started);
      emit('playback_cut');
      return elapsed;
    },
    [emit],
  );

  const reset = useCallback(() => {
    cancelStoryPreparation();
    runTokenRef.current++;
    const controller = prepareAbortRef.current;
    if (controller) {
      controller.abort();
      const id = jobIdRef.current;
      if (id)
        void fetch(`/api/performance/job/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }).catch(() => undefined);
      setJobStatus('idle');
    }
    stopMedia(true);
    nextIndexRef.current = 0;
    setPlaying(false);
    setCurrentLine(null);
    setPlaybackMode('none');
    setError(null);
    storyReplyRef.current = null;
    setHasStoryReply(false);
    emit('playback_reset');
  }, [cancelStoryPreparation, emit, stopMedia]);

  useEffect(
    () => () => {
      cancelStoryPreparation();
      prepareAbortRef.current?.abort();
      const id = jobIdRef.current;
      if (id)
        void fetch(`/api/performance/job/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }).catch(() => undefined);
      prepareAbortRef.current = null;
      jobIdRef.current = null;
      runTokenRef.current++;
      storyReplyRef.current = null;
      stopMedia(true);
    },
    [cancelStoryPreparation, stopMedia],
  );

  return {
    mediaRef,
    clips,
    jobStatus,
    progress,
    currentTime,
    duration,
    playing,
    completionCount,
    currentLine,
    video,
    playbackMode,
    error,
    comparisonReady: Boolean(
      currentLine &&
      comparison &&
      comparison.sceneId === sceneId &&
      comparison.index === nextIndexRef.current,
    ),
    directCurrentLine,
    performStoryReply,
    prepareStoryReply,
    playStoryClip,
    cancelStoryPreparation,
    hasStoryReply,
    replayStoryReply,
    auditionTake,
    holdLine,
    prepare,
    prepareCustom,
    roll,
    cut,
    reset,
    cancelPreparation,
  };
}
