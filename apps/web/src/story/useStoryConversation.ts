import { useCallback, useEffect, useRef, useState } from 'react';
import { DirectorMic, type StoryReply } from '../realtime/DirectorMic';
import type { useCastPerformance } from '../performance/useCastPerformance';
import type { Chapter } from './chapters';

export type StoryStatus =
  'idle' | 'connecting' | 'listening' | 'thinking' | 'rendering' | 'replying' | 'error';
type Turn = { speaker: string; text: string };
type CastPerformance = ReturnType<typeof useCastPerformance>;
type BeatTurn = 'user' | 'continuation';

/** One bounded Realtime connection carries successive turns; media preparation remains explicit. */
export function useStoryConversation(chapter: Chapter, cast: CastPerformance) {
  const [status, setStatus] = useState<StoryStatus>('idle');
  const [sessionActive, setSessionActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Turn[]>([]);
  const [replyName, setReplyName] = useState('');
  const latest = useRef({ chapter, cast });
  latest.current = { chapter, cast };
  const session = useRef<DirectorMic | null>(null);
  const version = useRef(0);
  const historyRef = useRef<Turn[]>([]);
  const state = useRef<StoryStatus>('idle');
  const awaiting = useRef(false);
  const turnKind = useRef<BeatTurn>('user');
  const userText = useRef('');
  const pendingReply = useRef<StoryReply | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rendering = useRef(false);
  const sessionReady = useRef(false);
  const beatRemaining = useRef(0);
  const waitingForClip = useRef(false);
  const queuedBeat = useRef<{
    reply: StoryReply;
    clip: Awaited<ReturnType<CastPerformance['prepareStoryReply']>>;
  } | null>(null);
  const preparingBeat = useRef(false);
  const continueBeatRef = useRef<((token: number) => void) | null>(null);
  const clipCompletionBaseline = useRef(0);
  const lastSceneLines = useRef<Array<{ speaker: string; text: string }>>([]);
  const transition = useCallback((next: StoryStatus) => {
    state.current = next;
    setStatus(next);
  }, []);
  const clearDeadline = useCallback(() => {
    if (deadline.current) clearTimeout(deadline.current);
    deadline.current = null;
  }, []);
  const remember = useCallback((turn: Turn) => {
    historyRef.current = [...historyRef.current, turn].slice(-10);
    setHistory(historyRef.current);
  }, []);
  const context = useCallback(() => {
    const { chapter: current, cast: performance } = latest.current;
    const index = performance.clips.findIndex((clip) => clip.id === performance.currentLine?.id);
    const actors = ['odile', 'rocco', 'pim'] as const;
    const sceneLines =
      index < 0
        ? [
            ...(lastSceneLines.current.length
              ? lastSceneLines.current
              : performance.clips.slice(-5).map(({ actor, text }) => ({ speaker: actor, text }))),
            ...(performance.currentLine
              ? [{ speaker: performance.currentLine.actor, text: performance.currentLine.text }]
              : []),
          ].slice(-6)
        : performance.clips
            .slice(Math.max(0, index - 4), index + 1)
            .map(({ actor, text }) => ({ speaker: actor, text }));
    if (index >= 0) lastSceneLines.current = sceneLines;
    const lastSpeaker =
      [...historyRef.current]
        .reverse()
        .find((turn) => actors.some((actor) => actor === turn.speaker))?.speaker ??
      performance.currentLine?.actor ??
      'odile';
    const addressed =
      turnKind.current === 'user'
        ? actors.find((actor) => new RegExp(`\\b${actor}\\b`, 'i').test(userText.current))
        : undefined;
    const replyActor =
      addressed ??
      actors[(actors.indexOf(lastSpeaker as (typeof actors)[number]) + 1) % actors.length];
    return JSON.stringify({
      replyActor,
      chapter: current.title,
      premise: current.description,
      objective: current.objective,
      stakes: current.stakes,
      playerRole: current.playerRole,
      recentSceneLines: sceneLines,
      conversation: historyRef.current,
    });
  }, []);
  const playQueued = useCallback(
    async (token: number) => {
      const queued = queuedBeat.current;
      if (!queued || token !== version.current) return;
      queuedBeat.current = null;
      setReplyName({ odile: 'Odile', rocco: 'Rocco', pim: 'Pim' }[queued.reply.actor]);
      transition('replying');
      const ok = await latest.current.cast.playStoryClip(queued.clip!);
      if (token !== version.current) return;
      if (!ok) {
        beatRemaining.current = 0;
        transition('idle');
        return;
      }
      remember({ speaker: queued.reply.actor, text: queued.reply.text });
      waitingForClip.current = true;
      clipCompletionBaseline.current = latest.current.cast.completionCount;
      transition('replying');
      if (beatRemaining.current > 0) continueBeatRef.current?.(token);
    },
    [remember, transition],
  );
  const cancel = useCallback(() => {
    version.current++;
    awaiting.current = false;
    turnKind.current = 'user';
    pendingReply.current = null;
    queuedBeat.current = null;
    preparingBeat.current = false;
    latest.current.cast.cancelStoryPreparation();
    beatRemaining.current = 0;
    waitingForClip.current = false;
    clipCompletionBaseline.current = latest.current.cast.completionCount;
    sessionReady.current = false;
    clearDeadline();
    session.current?.disconnect();
    session.current = null;
    setSessionActive(false);
    if (rendering.current) latest.current.cast.cancelPreparation();
    rendering.current = false;
    if (latest.current.cast.playing) latest.current.cast.cut();
    setLevel(0);
    transition('idle');
  }, [clearDeadline, transition]);
  useEffect(() => {
    historyRef.current = [];
    lastSceneLines.current = [];
    setHistory([]);
    setTranscript('');
    setError('');
    return cancel;
  }, [chapter.id, cancel]);
  const fail = useCallback(
    (message: string) => {
      awaiting.current = false;
      pendingReply.current = null;
      beatRemaining.current = 0;
      waitingForClip.current = false;
      queuedBeat.current = null;
      preparingBeat.current = false;
      latest.current.cast.cancelStoryPreparation();
      clipCompletionBaseline.current = latest.current.cast.completionCount;
      sessionReady.current = false;
      clearDeadline();
      session.current?.setInputEnabled(false);
      setLevel(0);
      setError(message);
      transition('error');
    },
    [clearDeadline, transition],
  );
  const finishReply = useCallback(
    async (token: number) => {
      const reply = pendingReply.current;
      const kind = turnKind.current;
      if (
        token !== version.current ||
        !awaiting.current ||
        !reply ||
        (kind === 'user' && !userText.current)
      )
        return;
      awaiting.current = false;
      pendingReply.current = null;
      clearDeadline();
      if (kind === 'user') remember({ speaker: 'You', text: userText.current });
      if (kind === 'continuation') {
        preparingBeat.current = true;
        transition(latest.current.cast.playing ? 'replying' : 'rendering');
        const clip = await latest.current.cast.prepareStoryReply({
          actor: reply.actor,
          text: reply.text,
          tags: reply.emotion === 'neutral' ? [] : [`emotion:${reply.emotion}`],
        });
        if (token !== version.current) return;
        preparingBeat.current = false;
        if (!clip) {
          beatRemaining.current = 0;
          queuedBeat.current = null;
          if (!latest.current.cast.playing) transition('idle');
          return;
        }
        queuedBeat.current = { reply, clip };
        if (!latest.current.cast.playing && !waitingForClip.current) void playQueued(token);
        return;
      }
      transition('rendering');
      rendering.current = true;
      setReplyName({ odile: 'Odile', rocco: 'Rocco', pim: 'Pim' }[reply.actor]);
      clipCompletionBaseline.current = latest.current.cast.completionCount;
      const success = await latest.current.cast.performStoryReply({
        actor: reply.actor,
        text: reply.text,
        tags: reply.emotion === 'neutral' ? [] : [`emotion:${reply.emotion}`],
      });
      if (token !== version.current) return;
      rendering.current = false;
      if (!success) {
        beatRemaining.current = 0;
        fail('The response could not be prepared. Your chapter is still saved.');
        return;
      }
      remember({ speaker: reply.actor, text: reply.text });
      if (kind === 'user') beatRemaining.current = 2;
      waitingForClip.current = true;
      transition('replying');
      if (beatRemaining.current > 0) continueBeatRef.current?.(token);
    },
    [clearDeadline, fail, playQueued, remember, transition],
  );
  const ensureSession = useCallback(
    async (captureAudio: boolean, token: number) => {
      if (
        session.current &&
        sessionReady.current &&
        (!captureAudio || session.current.isCapturingAudio)
      ) {
        session.current.updateStoryContext(context());
        return session.current;
      }
      const old = session.current;
      session.current = null;
      sessionReady.current = false;
      old?.disconnect();
      const mic = new DirectorMic();
      session.current = mic;
      const isCurrent = () => token === version.current && session.current === mic;
      transition('connecting');
      await mic.connect(
        {
          onStatus: (next, message) => {
            if (!isCurrent()) return;
            if (next === 'error') {
              sessionReady.current = false;
              setSessionActive(false);
              session.current = null;
              fail(message ?? 'The story connection could not start.');
            }
            if (next === 'off') {
              sessionReady.current = false;
              setSessionActive(false);
              session.current = null;
              if (turnKind.current === 'continuation' && awaiting.current) {
                awaiting.current = false;
                pendingReply.current = null;
                beatRemaining.current = 0;
                clearDeadline();
                setLevel(0);
                transition('idle');
                return;
              }
              if (
                state.current === 'listening' ||
                state.current === 'connecting' ||
                state.current === 'thinking'
              )
                fail(message ?? 'The story session ended. Start another turn when ready.');
            }
          },
          onSpeechStarted: () => {
            if (!isCurrent() || !awaiting.current) return;
            latest.current.cast.cut();
            transition('listening');
          },
          onSpeechStopped: () => {
            if (isCurrent() && awaiting.current) {
              setLevel(0);
              transition('thinking');
            }
          },
          onTranscript: (text) => {
            if (!isCurrent() || !awaiting.current || turnKind.current !== 'user') return;
            userText.current = text.trim().slice(0, 500);
            setTranscript(userText.current);
            void finishReply(token);
          },
          onStoryReply: (reply) => {
            if (!isCurrent() || !awaiting.current) return;
            pendingReply.current = reply;
            void finishReply(token);
          },
          onLevel: (value) => {
            if (isCurrent()) setLevel(state.current === 'listening' ? value : 0);
          },
          onEvent: (name) => {
            if (isCurrent() && name === 'story_reply_invalid')
              fail('The cast could not form a reply. Try a shorter line.');
          },
        },
        { mode: 'story', storyContext: context(), captureAudio },
      );
      if (token !== version.current) {
        mic.disconnect();
        return null;
      }
      setSessionActive(true);
      sessionReady.current = true;
      return mic;
    },
    [clearDeadline, context, fail, finishReply, transition],
  );
  const begin = useCallback(
    async (typed?: string) => {
      if (
        (['connecting', 'thinking', 'rendering'].includes(state.current) &&
          turnKind.current !== 'continuation') ||
        (typed && state.current === 'listening')
      )
        return;
      if (!typed && state.current === 'listening') {
        cancel();
        return;
      }
      version.current++;
      queuedBeat.current = null;
      preparingBeat.current = false;
      latest.current.cast.cancelStoryPreparation();
      session.current?.disconnect();
      session.current = null;
      sessionReady.current = false;
      setSessionActive(false);
      beatRemaining.current = 0;
      waitingForClip.current = false;
      turnKind.current = 'user';
      clipCompletionBaseline.current = latest.current.cast.completionCount;
      latest.current.cast.cut();
      const token = version.current;
      setError('');
      setTranscript(typed ?? '');
      userText.current = typed ?? '';
      pendingReply.current = null;
      awaiting.current = true;
      transition('connecting');
      clearDeadline();
      deadline.current = setTimeout(() => {
        if (token === version.current && awaiting.current)
          fail('The turn timed out. Your chapter is still saved.');
      }, 45_000);
      try {
        const mic = await ensureSession(!typed, token);
        if (!mic || token !== version.current) return;
        if (typed) {
          transition('thinking');
          mic.submitStoryText(typed);
        } else {
          mic.setInputEnabled(true);
          transition('listening');
        }
      } catch {
        if (token === version.current)
          fail('The story connection could not start. You can keep playing the saved chapter.');
      }
    },
    [cancel, clearDeadline, ensureSession, fail, transition],
  );
  const continueBeat = useCallback(
    (token: number) => {
      if (token !== version.current || beatRemaining.current <= 0) return;
      const mic = session.current;
      if (!mic || !sessionReady.current) {
        beatRemaining.current = 0;
        transition('idle');
        return;
      }
      beatRemaining.current--;
      turnKind.current = 'continuation';
      userText.current = '';
      pendingReply.current = null;
      awaiting.current = true;
      transition(latest.current.cast.playing ? 'replying' : 'thinking');
      clearDeadline();
      deadline.current = setTimeout(() => {
        if (token === version.current && awaiting.current)
          fail('The story session ended before the cast could continue.');
      }, 45_000);
      try {
        mic.updateStoryContext(context());
        mic.continueStory();
      } catch {
        if (token === version.current) fail('The cast could not continue this scene.');
      }
    },
    [clearDeadline, context, fail, transition],
  );
  continueBeatRef.current = continueBeat;
  const canContinue =
    history.some(({ speaker }) => ['odile', 'rocco', 'pim'].includes(speaker)) &&
    ['idle', 'error', 'replying'].includes(status) &&
    !awaiting.current &&
    !rendering.current &&
    !waitingForClip.current &&
    !preparingBeat.current &&
    !queuedBeat.current &&
    !latest.current.cast.playing;
  const continuationPending =
    turnKind.current === 'continuation' &&
    (awaiting.current || preparingBeat.current || !!queuedBeat.current || waitingForClip.current);
  const continueConversation = useCallback(async () => {
    const hasCastTurn = historyRef.current.some(({ speaker }) =>
      ['odile', 'rocco', 'pim'].includes(speaker),
    );
    if (
      !hasCastTurn ||
      !['idle', 'error', 'replying'].includes(state.current) ||
      awaiting.current ||
      rendering.current
    )
      return;
    beatRemaining.current = 3;
    waitingForClip.current = false;
    turnKind.current = 'continuation';
    userText.current = '';
    pendingReply.current = null;
    clipCompletionBaseline.current = latest.current.cast.completionCount;
    latest.current.cast.cut();
    setError('');
    transition('connecting');
    const token = version.current;
    try {
      const mic = await ensureSession(false, token);
      if (!mic || token !== version.current) return;
      continueBeat(token);
    } catch {
      if (token === version.current)
        fail('The story connection could not start. You can keep playing the saved chapter.');
    }
  }, [continueBeat, ensureSession, fail, transition]);
  useEffect(() => {
    if (!waitingForClip.current) return;
    if (cast.completionCount <= clipCompletionBaseline.current) return;
    waitingForClip.current = false;
    if (queuedBeat.current) void playQueued(version.current);
    else if (preparingBeat.current) transition('rendering');
    else if (awaiting.current) transition('thinking');
    else if (beatRemaining.current > 0 && !awaiting.current) continueBeat(version.current);
    else transition('idle');
  }, [cast.completionCount, continueBeat, playQueued, status, transition]);
  return {
    status,
    sessionActive,
    level,
    transcript,
    error,
    history,
    replyName,
    canContinue,
    canInterrupt: continuationPending,
    continueConversation,
    onMic: () => void begin(),
    onTypedTurn: (text: string) => {
      const bounded = text.trim().slice(0, 500);
      if (bounded) void begin(bounded);
    },
    cancel,
    resetContext: () => {
      cancel();
      historyRef.current = [];
      lastSceneLines.current = [];
      setHistory([]);
      setTranscript('');
      setError('');
    },
    attention: ['connecting', 'listening', 'thinking', 'rendering'].includes(status),
  };
}
