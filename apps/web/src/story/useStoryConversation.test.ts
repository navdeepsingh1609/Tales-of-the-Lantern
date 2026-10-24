// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type DirectorMicCallbacks,
  type DirectorMicOptions,
  type StoryReply,
} from '../realtime/DirectorMic';
import type { useCastPerformance } from '../performance/useCastPerformance';
import { CHAPTERS, type Chapter } from './chapters';
import { useStoryConversation } from './useStoryConversation';

type FakeMic = {
  callbacks: DirectorMicCallbacks;
  options: DirectorMicOptions;
  isCapturingAudio: boolean;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  setInputEnabled: ReturnType<typeof vi.fn>;
  submitStoryText: ReturnType<typeof vi.fn>;
  updateStoryContext: ReturnType<typeof vi.fn>;
  continueStory: ReturnType<typeof vi.fn>;
};

const micStore = vi.hoisted(() => ({ instances: [] as unknown[] }));
vi.mock('../realtime/DirectorMic', () => ({
  DirectorMic: class MockDirectorMic {
    callbacks!: DirectorMicCallbacks;
    options!: DirectorMicOptions;
    isCapturingAudio = true;
    connect = vi.fn(async (callbacks: DirectorMicCallbacks, options: DirectorMicOptions) => {
      this.callbacks = callbacks;
      this.options = options;
      this.isCapturingAudio = options.captureAudio !== false;
    });
    disconnect = vi.fn();
    setInputEnabled = vi.fn();
    submitStoryText = vi.fn();
    updateStoryContext = vi.fn();
    continueStory = vi.fn();
    constructor() {
      micStore.instances.push(this);
    }
  },
}));

const asMic = (index = 0) => micStore.instances[index] as FakeMic;
const makeCast = () => {
  const prepared = {
    id: 'speculative',
    actor: 'odile',
    text: 'A prepared answer.',
    audioUrl: '/a',
    videoUrl: '/v',
  };
  const cast = {
    clips: [
      { id: 'scene-1', actor: 'odile', text: 'The sea is rising.' },
      { id: 'scene-2', actor: 'rocco', text: 'We need a better road.' },
      { id: 'scene-3', actor: 'pim', text: 'I know a pass.' },
    ],
    currentLine: { id: 'scene-2', actor: 'rocco', text: 'We need a better road.' },
    playing: false,
    completionCount: 0,
    cut: vi.fn(() => {
      cast.playing = false;
    }),
    cancelPreparation: vi.fn(),
    cancelStoryPreparation: vi.fn(),
    prepareStoryReply: vi.fn(async (line: { actor: string; text: string }) => ({
      ...prepared,
      ...line,
    })),
    playStoryClip: vi.fn(async (clip: { id: string; actor: string; text: string }) => {
      cast.playing = true;
      cast.currentLine = { id: clip.id, actor: clip.actor, text: clip.text };
      return true;
    }),
    performStoryReply: vi.fn(async (line: { actor: string; text: string; tags: string[] }) => {
      cast.playing = true;
      cast.currentLine = { id: 'ephemeral-reply', actor: line.actor, text: line.text };
      return true;
    }),
  };
  return cast;
};
const reply: StoryReply = { actor: 'pim', text: 'The northern pass is open.', emotion: 'relief' };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  micStore.instances.length = 0;
});

describe('useStoryConversation orchestration', () => {
  it('submits typed turns without enabling microphone capture', async () => {
    const cast = makeCast();
    const { result } = renderHook(() =>
      useStoryConversation(CHAPTERS[0]!, cast as unknown as ReturnType<typeof useCastPerformance>),
    );
    act(() => result.current.onTypedTurn('  Pim, what lies beyond the pass?  '));
    await waitFor(() =>
      expect(asMic().submitStoryText).toHaveBeenCalledWith('Pim, what lies beyond the pass?'),
    );
    expect(asMic().options).toMatchObject({ mode: 'story', captureAudio: false });
    expect(asMic().setInputEnabled).not.toHaveBeenCalledWith(true);
    expect(asMic().options.storyContext).toContain('Gull Point');
    const storyContext = JSON.parse(asMic().options.storyContext!);
    expect(storyContext.replyActor).toBe('pim');
    expect(storyContext.objective).toBe(CHAPTERS[0]!.objective);
    expect(storyContext.stakes).toBe(CHAPTERS[0]!.stakes);
    expect(storyContext.playerRole).toBe(CHAPTERS[0]!.playerRole);
    expect(result.current.status).toBe('thinking');
  });

  it.each(['model-first', 'transcript-first'] as const)(
    'waits for STT and model reply in either order and records the turn once (%s)',
    async (order) => {
      const cast = makeCast();
      const { result } = renderHook(() =>
        useStoryConversation(
          CHAPTERS[0]!,
          cast as unknown as ReturnType<typeof useCastPerformance>,
        ),
      );
      act(() => result.current.onMic());
      await waitFor(() => expect(asMic().setInputEnabled).toHaveBeenCalledWith(true));
      const mic = asMic();
      if (order === 'model-first') {
        act(() => mic.callbacks.onStoryReply?.(reply));
        expect(cast.performStoryReply).not.toHaveBeenCalled();
        act(() => mic.callbacks.onTranscript('Tell me about the pass.'));
      } else {
        act(() => mic.callbacks.onTranscript('Tell me about the pass.'));
        expect(cast.performStoryReply).not.toHaveBeenCalled();
        act(() => mic.callbacks.onStoryReply?.(reply));
      }
      await waitFor(() => expect(cast.performStoryReply).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(result.current.history).toEqual([
          { speaker: 'You', text: 'Tell me about the pass.' },
          { speaker: 'pim', text: reply.text },
        ]),
      );
      act(() => mic.callbacks.onStoryReply?.(reply));
      act(() => mic.callbacks.onTranscript('Tell me about the pass.'));
      expect(cast.performStoryReply).toHaveBeenCalledTimes(1);
      expect(result.current.history.filter(({ speaker }) => speaker === 'pim')).toHaveLength(1);
      expect(result.current.replyName).toBe('Pim');
    },
  );

  it('reconnects on new input to invalidate speculative responses and refresh context', async () => {
    const cast = makeCast();
    const { result } = renderHook(() =>
      useStoryConversation(CHAPTERS[0]!, cast as unknown as ReturnType<typeof useCastPerformance>),
    );
    act(() => result.current.onMic());
    await waitFor(() => expect(micStore.instances).toHaveLength(1));
    const mic = asMic();
    expect(mic.options).toMatchObject({ mode: 'story', captureAudio: true });
    act(() => mic.callbacks.onTranscript('We need to hurry.'));
    act(() => mic.callbacks.onStoryReply?.(reply));
    await waitFor(() => expect(result.current.history).toHaveLength(2));

    act(() => result.current.onTypedTurn('Who is waiting at the pass?'));
    await waitFor(() => expect(micStore.instances).toHaveLength(2));
    const nextMic = asMic(1);
    await waitFor(() =>
      expect(nextMic.submitStoryText).toHaveBeenCalledWith('Who is waiting at the pass?'),
    );
    const latestContext = nextMic.options.storyContext!;
    expect(latestContext).toContain('We need to hurry.');
    expect(latestContext).toContain(reply.text);
    expect(latestContext).not.toContain('Who is waiting at the pass?');
    expect(mic.disconnect).toHaveBeenCalled();
  });

  it('prefetches one continuation during playback and plays it only after natural completion', async () => {
    const cast = makeCast();
    let release!: (value: {
      id: string;
      actor: string;
      text: string;
      audioUrl: string;
      videoUrl: string;
    }) => void;
    cast.prepareStoryReply.mockImplementationOnce(
      (line: { actor: string; text: string }) =>
        new Promise((resolve) => {
          release = () => resolve({ id: 'prefetch-1', audioUrl: '/a', videoUrl: '/v', ...line });
        }),
    );
    const { result, rerender } = renderHook(() =>
      useStoryConversation(CHAPTERS[0]!, cast as unknown as ReturnType<typeof useCastPerformance>),
    );
    act(() => result.current.onTypedTurn('Pim, what is our next move?'));
    await waitFor(() => expect(asMic().submitStoryText).toHaveBeenCalledTimes(1));
    act(() => asMic().callbacks.onStoryReply?.(reply));
    await waitFor(() => expect(asMic().continueStory).toHaveBeenCalledTimes(1));
    expect(cast.playing).toBe(true);
    act(() =>
      asMic().callbacks.onStoryReply?.({
        actor: 'odile',
        text: 'I can mark the path.',
        emotion: 'determination',
      }),
    );
    await waitFor(() => expect(cast.prepareStoryReply).toHaveBeenCalledTimes(1));
    expect(cast.playStoryClip).not.toHaveBeenCalled();

    expect(result.current.history.map(({ speaker }) => speaker)).toEqual(['You', 'pim']);
    release({
      id: 'prefetch-1',
      actor: 'odile',
      text: 'I can mark the path.',
      audioUrl: '/a',
      videoUrl: '/v',
    });
    await waitFor(() => expect(cast.prepareStoryReply).toHaveBeenCalledTimes(1));
    expect(cast.playStoryClip).not.toHaveBeenCalled();
    cast.playing = false;
    cast.completionCount++;
    rerender();
    await waitFor(() => expect(cast.playStoryClip).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(result.current.history.map(({ speaker }) => speaker)).toEqual(['You', 'pim', 'odile']),
    );
    expect(asMic().continueStory).toHaveBeenCalledTimes(2);
  });

  it('finishes exactly three cast lines, then starts an explicit new beat with a fresh lookahead', async () => {
    const cast = makeCast();
    const { result, rerender } = renderHook(() =>
      useStoryConversation(CHAPTERS[0]!, cast as unknown as ReturnType<typeof useCastPerformance>),
    );
    act(() => result.current.onTypedTurn('Pim, what is the plan?'));
    await waitFor(() => expect(asMic().submitStoryText).toHaveBeenCalledTimes(1));
    const mic = asMic();
    act(() => mic.callbacks.onStoryReply?.(reply));
    await waitFor(() => expect(mic.continueStory).toHaveBeenCalledTimes(1));
    act(() =>
      mic.callbacks.onStoryReply?.({
        actor: 'odile',
        text: 'I mark the trail.',
        emotion: 'neutral',
      }),
    );
    await waitFor(() => expect(cast.prepareStoryReply).toHaveBeenCalledTimes(1));
    expect(result.current.history.map(({ speaker }) => speaker)).toEqual(['You', 'pim']);

    cast.playing = false;
    cast.completionCount++;
    rerender();
    await waitFor(() => expect(cast.playStoryClip).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mic.continueStory).toHaveBeenCalledTimes(2));
    act(() =>
      mic.callbacks.onStoryReply?.({
        actor: 'rocco',
        text: 'I will guard the bridge.',
        emotion: 'determination',
      }),
    );
    await waitFor(() => expect(cast.prepareStoryReply).toHaveBeenCalledTimes(2));
    expect(result.current.history.map(({ speaker }) => speaker)).toEqual(['You', 'pim', 'odile']);

    cast.playing = false;
    cast.completionCount++;
    rerender();
    await waitFor(() => expect(cast.playStoryClip).toHaveBeenCalledTimes(2));
    expect(mic.continueStory).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(result.current.history.map(({ speaker }) => speaker)).toEqual([
        'You',
        'pim',
        'odile',
        'rocco',
      ]),
    );

    cast.playing = false;
    cast.completionCount++;
    rerender();
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(mic.continueStory).toHaveBeenCalledTimes(2);
    expect(cast.prepareStoryReply).toHaveBeenCalledTimes(2);
    expect(result.current.canContinue).toBe(true);

    await act(async () => {
      await result.current.continueConversation();
    });
    await waitFor(() => expect(mic.continueStory).toHaveBeenCalledTimes(3));
    act(() =>
      mic.callbacks.onStoryReply?.({
        actor: 'pim',
        text: 'The route is clear.',
        emotion: 'relief',
      }),
    );
    await waitFor(() => expect(cast.playStoryClip).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(mic.continueStory).toHaveBeenCalledTimes(4));
    expect(result.current.history.at(-1)).toEqual({ speaker: 'pim', text: 'The route is clear.' });
  });

  it('ends safely after a speculative preparation failure without retrying or adding a fourth line', async () => {
    const cast = makeCast();
    cast.prepareStoryReply.mockImplementationOnce(async () => null as never);
    const { result, rerender } = renderHook(() =>
      useStoryConversation(CHAPTERS[0]!, cast as unknown as ReturnType<typeof useCastPerformance>),
    );
    act(() => result.current.onTypedTurn('What is the plan?'));
    await waitFor(() => expect(asMic().submitStoryText).toHaveBeenCalled());
    const mic = asMic();
    act(() => mic.callbacks.onStoryReply?.(reply));
    await waitFor(() => expect(mic.continueStory).toHaveBeenCalledTimes(1));
    act(() =>
      mic.callbacks.onStoryReply?.({
        actor: 'odile',
        text: 'I can scout ahead.',
        emotion: 'neutral',
      }),
    );
    await waitFor(() => expect(cast.prepareStoryReply).toHaveBeenCalledTimes(1));
    expect(cast.playing).toBe(true);
    expect(result.current.history.map(({ speaker }) => speaker)).toEqual(['You', 'pim']);
    cast.playing = false;
    cast.completionCount++;
    rerender();
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(cast.playStoryClip).not.toHaveBeenCalled();
    expect(mic.continueStory).toHaveBeenCalledTimes(1);
    expect(cast.prepareStoryReply).toHaveBeenCalledTimes(1);
    expect(result.current.canContinue).toBe(true);
  });

  it('resetContext clears committed history and discards an already prepared queued line', async () => {
    const cast = makeCast();
    const { result } = renderHook(() =>
      useStoryConversation(CHAPTERS[0]!, cast as unknown as ReturnType<typeof useCastPerformance>),
    );
    act(() => result.current.onTypedTurn('What is the plan?'));
    await waitFor(() => expect(asMic().submitStoryText).toHaveBeenCalled());
    const mic = asMic();
    act(() => mic.callbacks.onStoryReply?.(reply));
    await waitFor(() => expect(mic.continueStory).toHaveBeenCalledTimes(1));
    act(() =>
      mic.callbacks.onStoryReply?.({
        actor: 'odile',
        text: 'I can scout ahead.',
        emotion: 'neutral',
      }),
    );
    await waitFor(() => expect(cast.prepareStoryReply).toHaveBeenCalledTimes(1));
    expect(result.current.history).toHaveLength(2);
    act(() => result.current.resetContext());
    expect(result.current.history).toEqual([]);
    expect(result.current.transcript).toBe('');
    expect(result.current.status).toBe('idle');
    expect(cast.cancelStoryPreparation).toHaveBeenCalled();
    expect(cast.playStoryClip).not.toHaveBeenCalled();
    cast.currentLine = {
      id: 'directed-improv',
      actor: 'pim',
      text: 'The bridge is closed. Take the boat.',
    };
    act(() => result.current.onTypedTurn('Then I will row.'));
    await waitFor(() => expect(micStore.instances).toHaveLength(2));
    const revisedContext = JSON.parse(asMic(1).options.storyContext!);
    expect(revisedContext.conversation).toEqual([]);
    expect(revisedContext.recentSceneLines).toContainEqual({
      speaker: 'pim',
      text: 'The bridge is closed. Take the boat.',
    });
  });

  it.each(['cancel', 'new-input', 'chapter-change'] as const)(
    'discards a late prepared clip after %s',
    async (stopKind) => {
      const cast = makeCast();
      let release!: (value: {
        id: string;
        actor: string;
        text: string;
        audioUrl: string;
        videoUrl: string;
      }) => void;
      cast.prepareStoryReply.mockImplementationOnce(
        (_line: { actor: string; text: string }) =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      const { result, rerender } = renderHook(
        ({ chapter }: { chapter: Chapter }) =>
          useStoryConversation(chapter, cast as unknown as ReturnType<typeof useCastPerformance>),
        { initialProps: { chapter: CHAPTERS[0]! } },
      );
      act(() => result.current.onTypedTurn('What is the plan?'));
      await waitFor(() => expect(asMic().submitStoryText).toHaveBeenCalled());
      act(() => asMic().callbacks.onStoryReply?.(reply));
      await waitFor(() => expect(asMic().continueStory).toHaveBeenCalledTimes(1));
      act(() =>
        asMic().callbacks.onStoryReply?.({
          actor: 'odile',
          text: 'I can mark it.',
          emotion: 'neutral',
        }),
      );
      await waitFor(() => expect(cast.prepareStoryReply).toHaveBeenCalledTimes(1));
      if (stopKind === 'cancel') act(() => result.current.cancel());
      else if (stopKind === 'chapter-change') rerender({ chapter: CHAPTERS[1]! });
      else act(() => result.current.onTypedTurn('A new question'));
      release({
        id: 'late-clip',
        actor: 'odile',
        text: 'I can mark it.',
        audioUrl: '/a',
        videoUrl: '/v',
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(cast.cancelStoryPreparation).toHaveBeenCalled();
      expect(cast.playStoryClip).not.toHaveBeenCalled();
      if (stopKind === 'new-input')
        await waitFor(() =>
          expect(asMic(1).submitStoryText).toHaveBeenCalledWith('A new question'),
        );
    },
  );

  it('cancels remaining automatic replies when the user joins during a cast clip', async () => {
    const cast = makeCast();
    const { result } = renderHook(() =>
      useStoryConversation(CHAPTERS[0]!, cast as unknown as ReturnType<typeof useCastPerformance>),
    );
    act(() => result.current.onTypedTurn('What is the plan?'));
    await waitFor(() => expect(asMic().submitStoryText).toHaveBeenCalled());
    const firstMic = asMic();
    act(() => firstMic.callbacks.onStoryReply?.(reply));
    await waitFor(() => expect(cast.performStoryReply).toHaveBeenCalledTimes(1));
    expect(cast.playing).toBe(true);

    act(() => result.current.onMic());
    await waitFor(() => expect(micStore.instances).toHaveLength(2));
    expect(firstMic.disconnect).toHaveBeenCalled();
    await waitFor(() => expect(asMic(1).setInputEnabled).toHaveBeenCalledWith(true));
    cast.playing = false;
    expect(cast.completionCount).toBe(0);
    expect(firstMic.continueStory).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.status).toBe('listening'));
  });

  it('continues an expired session explicitly with a new text-only connection', async () => {
    const cast = makeCast();
    const { result } = renderHook(() =>
      useStoryConversation(CHAPTERS[0]!, cast as unknown as ReturnType<typeof useCastPerformance>),
    );
    act(() => result.current.onTypedTurn('Who sent the letter?'));
    await waitFor(() => expect(asMic().submitStoryText).toHaveBeenCalled());
    const expired = asMic();
    act(() => expired.callbacks.onStoryReply?.(reply));
    await waitFor(() => expect(result.current.history).toHaveLength(2));
    act(() => result.current.cancel());
    expect(expired.disconnect).toHaveBeenCalled();
    expect(result.current.canContinue).toBe(true);

    await act(async () => {
      await result.current.continueConversation();
    });
    await waitFor(() => expect(micStore.instances).toHaveLength(2));
    const reconnected = asMic(1);
    await waitFor(() => expect(reconnected.continueStory).toHaveBeenCalledTimes(1));
    expect(reconnected.options).toMatchObject({ mode: 'story', captureAudio: false });
    expect(reconnected.setInputEnabled).not.toHaveBeenCalledWith(true);
    expect(reconnected.submitStoryText).not.toHaveBeenCalled();
    expect(JSON.parse(reconnected.options.storyContext!).conversation).toEqual([
      { speaker: 'You', text: 'Who sent the letter?' },
      { speaker: 'pim', text: reply.text },
    ]);
  });

  it.each(['chapter-change', 'cancel'] as const)(
    'ignores late replies after %s',
    async (stopKind) => {
      const cast = makeCast();
      const { result, rerender } = renderHook(
        ({ chapter }: { chapter: Chapter }) =>
          useStoryConversation(chapter, cast as unknown as ReturnType<typeof useCastPerformance>),
        { initialProps: { chapter: CHAPTERS[0]! } },
      );
      act(() => result.current.onTypedTurn('Can you answer?'));
      await waitFor(() => expect(micStore.instances).toHaveLength(1));
      const staleCallbacks = asMic().callbacks;
      if (stopKind === 'chapter-change') rerender({ chapter: CHAPTERS[1]! });
      else act(() => result.current.cancel());
      expect(asMic().disconnect).toHaveBeenCalled();
      act(() => staleCallbacks.onStoryReply?.(reply));
      act(() => staleCallbacks.onTranscript('Can you answer?'));
      expect(cast.performStoryReply).not.toHaveBeenCalled();
      if (stopKind === 'chapter-change') expect(result.current.history).toEqual([]);
    },
  );
});
