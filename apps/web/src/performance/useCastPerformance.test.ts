// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCastPerformance } from './useCastPerformance';

type TestClip = {
  id: string;
  actor: 'odile' | 'rocco' | 'pim';
  language: string;
  text: string;
  voice: string;
  audioUrl: string;
  videoUrl?: string;
  mode: 'avatar' | 'audio-only';
  cached: boolean;
};
const audioUrl = `/api/performance/media/${'a'.repeat(64)}/audio`;
const videoUrl = `/api/performance/media/${'b'.repeat(64)}/video`;
const clip = (id: string, actor: TestClip['actor'], video = false): TestClip => ({
  id,
  actor,
  language: 'en',
  text: `Line ${id}`,
  voice: 'eleanor',
  audioUrl,
  ...(video ? { videoUrl } : {}),
  mode: video ? 'avatar' : 'audio-only',
  cached: true,
});
const response = (lines: TestClip[]): Response =>
  ({
    ok: true,
    json: async () => ({ lines }),
  }) as Response;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useCastPerformance scene and playback regressions', () => {
  it('prepares and preloads one story clip without touching the current player, then plays it locally', async () => {
    const originals = [clip('baseline', 'odile', true)];
    const next = clip('next-reply', 'pim', true);
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (String(input).includes('/latest')) return response(originals);
      if (init?.method === 'POST') return Response.json({ id: 'lookahead' }, { status: 202 });
      return Response.json({ id: 'lookahead', status: 'ready', progress: 1, lines: [next] });
    });
    vi.stubGlobal('fetch', fetchMock);
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCastPerformance());
    await waitFor(() => expect(result.current.clips).toHaveLength(1));
    act(() => result.current.roll());
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    const currentVideo = result.current.video;
    let prepared: Awaited<ReturnType<typeof result.current.prepareStoryReply>> = null;
    await act(async () => {
      prepared = await result.current.prepareStoryReply({
        actor: 'pim',
        text: 'I will watch the sea.',
        tags: [],
      });
    });
    expect(prepared).toMatchObject({ id: next.id });
    expect(result.current.video).toBe(currentVideo);
    expect(result.current.currentLine?.id).toBe('baseline');
    expect(result.current.playing).toBe(true);
    expect(result.current.jobStatus).toBe('ready');
    expect(play).toHaveBeenCalledTimes(1);
    const fetchesBeforePlayback = fetchMock.mock.calls.length;
    await act(async () => {
      expect(await result.current.playStoryClip(prepared!)).toBe(true);
    });
    expect(result.current.currentLine?.id).toBe(next.id);
    expect(result.current.clips).toEqual(originals);
    expect(fetchMock.mock.calls).toHaveLength(fetchesBeforePlayback);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('cancels a late acknowledged speculative job and never makes it playable', async () => {
    let acknowledge!: (response: Response) => void;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (String(input).includes('/latest')) return response([clip('baseline', 'odile')]);
      if (init?.method === 'POST')
        return new Promise<Response>((resolve) => {
          acknowledge = resolve;
        });
      return Response.json({ id: 'late-lookahead', status: 'cancelled', progress: 0, lines: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCastPerformance());
    await waitFor(() => expect(result.current.clips).toHaveLength(1));
    let pending!: ReturnType<typeof result.current.prepareStoryReply>;
    act(() => {
      pending = result.current.prepareStoryReply({
        actor: 'pim',
        text: 'Discard this future.',
        tags: [],
      });
    });
    act(() => result.current.cancelStoryPreparation());
    let directed!: Promise<void>;
    act(() => {
      directed = result.current.directCurrentLine(['emotion:fear'], 'A superseded direction.');
      result.current.reset();
    });
    await act(async () => {
      acknowledge(Response.json({ id: 'late-lookahead' }, { status: 202 }));
      expect(await pending).toBeNull();
      await directed;
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).endsWith('/job/late-lookahead') && init?.method === 'DELETE',
      ),
    ).toBe(true);
    await act(async () => {
      expect(await result.current.playStoryClip(clip('stale', 'pim', true))).toBe(false);
    });
    expect(result.current.currentLine).toBeNull();
  });

  it('directs the current improvised line and compares takes without replacing an authored line', async () => {
    const originals = [clip('chapter', 'odile', true)];
    const reply = { ...clip('improv', 'pim', true), text: 'The tide is rising.' };
    const directed = { ...clip('improv-new', 'pim', true), text: 'We should leave now.' };
    let posts = 0;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (String(input).includes('/latest')) return response(originals);
      if (init?.method === 'POST') return Response.json({ id: `job-${++posts}` }, { status: 202 });
      return Response.json({
        id: `job-${posts}`,
        status: 'ready',
        progress: 1,
        lines: [posts === 1 ? reply : directed],
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCastPerformance());
    await waitFor(() => expect(result.current.clips).toHaveLength(1));
    await act(async () => {
      await result.current.performStoryReply({ actor: 'pim', text: reply.text, tags: [] });
    });
    act(() => result.current.cut());
    await act(async () => {
      await result.current.directCurrentLine(['emotion:fear'], directed.text);
    });
    const post = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').at(-1);
    expect(JSON.parse(String(post?.[1]?.body)).lines).toEqual([
      { actor: 'pim', text: directed.text, tags: ['emotion:fear'] },
    ]);
    expect(result.current.clips).toEqual(originals);
    expect(result.current.currentLine?.id).toBe(directed.id);
    act(() => result.current.auditionTake('original'));
    await waitFor(() => expect(result.current.currentLine?.id).toBe(reply.id));
    act(() => result.current.auditionTake('directed'));
    await waitFor(() => expect(result.current.currentLine?.id).toBe(directed.id));
    expect(result.current.clips).toEqual(originals);
  });
  it('stops old scene playback on switch and ignores its captured onended handler', async () => {
    const lighthouse = [
      clip('l1', 'odile', true),
      clip('l2', 'rocco'),
      clip('l3', 'pim'),
      clip('l4', 'odile'),
    ];
    const tavern = [clip('t1', 'pim'), clip('t2', 'odile'), clip('t3', 'rocco'), clip('t4', 'pim')];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        String(input).includes('sceneId=tavern') ? response(tavern) : response(lighthouse),
      );
    vi.stubGlobal('fetch', fetchMock);
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result, rerender } = renderHook(
      ({ sceneId }: { sceneId: 'lighthouse' | 'tavern' }) => useCastPerformance({ sceneId }),
      {
        initialProps: { sceneId: 'lighthouse' },
      },
    );
    await waitFor(() =>
      expect(result.current.clips.map(({ actor }) => actor)).toEqual([
        'odile',
        'rocco',
        'pim',
        'odile',
      ]),
    );
    act(() => result.current.roll());
    await waitFor(() => expect(result.current.video).not.toBeNull());
    const oldVideo = result.current.video!;
    const oldEnded = oldVideo.onended;
    expect(oldEnded).toBeTypeOf('function');

    rerender({ sceneId: 'tavern' });
    await waitFor(() =>
      expect(result.current.clips.map(({ actor }) => actor)).toEqual([
        'pim',
        'odile',
        'rocco',
        'pim',
      ]),
    );
    expect(pause).toHaveBeenCalledWith();
    expect(play).toHaveBeenCalledTimes(1);
    act(() => oldEnded?.call(oldVideo, new Event('ended')));
    expect(play).toHaveBeenCalledTimes(1);
    expect(result.current.clips.map(({ id }) => id)).toEqual(['t1', 't2', 't3', 't4']);
  });

  it('does not let a late prior-scene restore replace the current scene', async () => {
    let releaseLighthouse!: (result: Response) => void;
    const delayed = new Promise<Response>((resolve) => {
      releaseLighthouse = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      if (String(input).includes('sceneId=lighthouse')) return delayed;
      return response([clip('tavern-line', 'rocco')]);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(
      ({ sceneId }: { sceneId: 'lighthouse' | 'tavern' }) => useCastPerformance({ sceneId }),
      {
        initialProps: { sceneId: 'lighthouse' },
      },
    );
    rerender({ sceneId: 'tavern' });
    await waitFor(() => expect(result.current.clips.map(({ id }) => id)).toEqual(['tavern-line']));
    await act(async () => {
      releaseLighthouse(response([clip('stale-line', 'odile')]));
    });
    expect(result.current.clips.map(({ id }) => id)).toEqual(['tavern-line']);
  });

  it('keeps the cut video frame and can retake its cached URL without a prepare POST', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response([clip('l1', 'odile', true)]));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCastPerformance());
    await waitFor(() => expect(result.current.clips).toHaveLength(1));
    act(() => result.current.roll());
    await waitFor(() => expect(result.current.video).not.toBeNull());
    const video = result.current.video!;
    Object.defineProperty(video, 'currentTime', { configurable: true, writable: true, value: 2.5 });
    const sourceAtCut = video.src;
    act(() => result.current.cut());
    expect(pause).toHaveBeenCalled();
    expect(result.current.video).toBe(video);
    expect(video.currentTime).toBe(2.5);
    act(() => result.current.roll());
    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(result.current.video?.src).toBe(sourceAtCut);
    expect(
      fetchMock.mock.calls.every(
        ([input, init]) =>
          String(init?.method ?? 'GET').toUpperCase() === 'GET' &&
          String(input).includes('/latest'),
      ),
    ).toBe(true);
  });

  it('holds an existing line without fetching or playing, then roll resumes from that index', async () => {
    const original = [
      clip('scene-1', 'odile'),
      clip('scene-2', 'rocco', true),
      clip('scene-3', 'pim'),
    ];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response(original));
    vi.stubGlobal('fetch', fetchMock);
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCastPerformance());
    await waitFor(() =>
      expect(result.current.clips.map(({ id }) => id)).toEqual(['scene-1', 'scene-2', 'scene-3']),
    );
    act(() => result.current.holdLine(1));
    expect(result.current.currentLine?.id).toBe('scene-2');
    expect(result.current.playing).toBe(false);
    expect(result.current.playbackMode).toBe('audio-only');
    expect(result.current.clips.map(({ id }) => id)).toEqual(['scene-1', 'scene-2', 'scene-3']);
    expect(play).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/latest');

    act(() => result.current.roll());
    await waitFor(() => expect(result.current.currentLine?.id).toBe('scene-2'));
    expect(result.current.video?.src).toContain('/api/performance/media/');
    expect(play).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('increments completionCount only when a clip ends naturally, never on a cut', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response([clip('scene-1', 'odile', true)]));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCastPerformance());
    await waitFor(() => expect(result.current.clips).toHaveLength(1));

    act(() => result.current.roll());
    await waitFor(() => expect(result.current.video).not.toBeNull());
    const cutVideo = result.current.video!;
    expect(result.current.completionCount).toBe(0);
    act(() => result.current.cut());
    expect(cutVideo.onended).toBeNull();
    expect(result.current.completionCount).toBe(0);

    act(() => result.current.roll());
    await waitFor(() => expect(result.current.video).not.toBeNull());
    const naturalVideo = result.current.video!;
    act(() => naturalVideo.onended?.call(naturalVideo, new Event('ended')));
    await waitFor(() => expect(result.current.completionCount).toBe(1));
  });

  it('replaces only the held line after a directed avatar is ready and auditions without another POST', async () => {
    const originals = [
      clip('scene-1', 'odile', true),
      clip('scene-2', 'rocco'),
      clip('scene-3', 'pim'),
    ];
    const directed = { ...clip('directed-1', 'odile', true), text: 'Line scene-1' };
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (String(input).endsWith('/latest?sceneId=lighthouse')) return response(originals);
      if (String(input).endsWith('/prepare') && init?.method === 'POST')
        return { status: 202, json: async () => ({ id: 'direct-job' }) } as Response;
      if (String(input).includes('/job/direct-job'))
        return {
          ok: true,
          json: async () => ({ id: 'direct-job', status: 'ready', progress: 1, lines: [directed] }),
        } as Response;
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCastPerformance());
    await waitFor(() =>
      expect(result.current.clips.map(({ id }) => id)).toEqual(['scene-1', 'scene-2', 'scene-3']),
    );
    await act(async () => {
      await result.current.directCurrentLine(['emotion:determination'], 'The beacon is still lit.');
    });
    expect(result.current.comparisonReady).toBe(true);
    expect(result.current.clips.map(({ id }) => id)).toEqual(['directed-1', 'scene-2', 'scene-3']);
    const postCalls = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(postCalls()).toHaveLength(1);
    const payload = JSON.parse(String(postCalls()[0]?.[1]?.body));
    expect(payload).toMatchObject({
      avatars: true,
      framing: 'landscape',
      persistSnapshot: false,
      lines: [
        { actor: 'odile', text: 'The beacon is still lit.', tags: ['emotion:determination'] },
      ],
    });

    act(() => result.current.auditionTake('original'));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    const originalVideo = result.current.video!;
    act(() => originalVideo.onended?.call(originalVideo, new Event('ended')));
    expect(result.current.currentLine?.id).toBe('scene-1');
    expect(result.current.clips.map(({ id }) => id)).toEqual(['scene-1', 'scene-2', 'scene-3']);

    act(() => result.current.auditionTake('directed'));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    const directedVideo = result.current.video!;
    act(() => directedVideo.onended?.call(directedVideo, new Event('ended')));
    expect(result.current.currentLine?.id).toBe('directed-1');
    expect(result.current.clips.map(({ id }) => id)).toEqual(['directed-1', 'scene-2', 'scene-3']);
    expect(postCalls()).toHaveLength(1);
  });

  it('keeps the existing scene line selected when directed generation fails', async () => {
    const originals = [clip('scene-1', 'odile'), clip('scene-2', 'rocco')];
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (String(input).endsWith('/latest?sceneId=lighthouse')) return response(originals);
      if (String(input).endsWith('/prepare') && init?.method === 'POST')
        return { status: 202, json: async () => ({ id: 'failed-job' }) } as Response;
      if (String(input).includes('/job/failed-job'))
        return {
          ok: true,
          json: async () => ({
            id: 'failed-job',
            status: 'error',
            progress: 0,
            lines: [],
            error: 'generation_failed',
          }),
        } as Response;
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCastPerformance());
    await waitFor(() =>
      expect(result.current.clips.map(({ id }) => id)).toEqual(['scene-1', 'scene-2']),
    );
    await act(async () => {
      await result.current.directCurrentLine(['emotion:affection']);
    });
    expect(result.current.clips.map(({ id }) => id)).toEqual(['scene-1', 'scene-2']);
    expect(result.current.currentLine).toBeNull();
    expect(result.current.comparisonReady).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('plays a ready story reply as an ephemeral audition without changing chapter clips', async () => {
    const chapter = [
      clip('chapter-1', 'odile', true),
      clip('chapter-2', 'rocco'),
      clip('chapter-3', 'pim'),
    ];
    const reply: TestClip = {
      ...clip('reply-1', 'pim', true),
      text: 'I found the tide chart.',
    };
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (String(input).endsWith('/latest?sceneId=lighthouse')) return response(chapter);
      if (String(input).endsWith('/prepare') && init?.method === 'POST')
        return { status: 202, json: async () => ({ id: 'reply-job' }) } as Response;
      if (String(input).includes('/job/reply-job'))
        return {
          ok: true,
          json: async () => ({ id: 'reply-job', status: 'ready', progress: 1, lines: [reply] }),
        } as Response;
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCastPerformance());
    await waitFor(() =>
      expect(result.current.clips.map(({ id }) => id)).toEqual([
        'chapter-1',
        'chapter-2',
        'chapter-3',
      ]),
    );
    let succeeded = false;
    await act(async () => {
      succeeded = await result.current.performStoryReply({
        actor: 'pim',
        text: 'I found the tide chart.',
        tags: ['emotion:relief'],
      });
    });
    expect(succeeded).toBe(true);
    expect(result.current.currentLine?.id).toBe('reply-1');
    expect(result.current.clips.map(({ id }) => id)).toEqual([
      'chapter-1',
      'chapter-2',
      'chapter-3',
    ]);
    expect(result.current.comparisonReady).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      avatars: true,
      framing: 'landscape',
      persistSnapshot: false,
      lines: [{ actor: 'pim', text: 'I found the tide chart.', tags: ['emotion:relief'] }],
    });
    const replyVideo = result.current.video!;
    act(() => replyVideo.onended?.call(replyVideo, new Event('ended')));
    expect(result.current.currentLine?.id).toBe('reply-1');
    expect(result.current.playing).toBe(false);
    expect(result.current.clips.map(({ id }) => id)).toEqual([
      'chapter-1',
      'chapter-2',
      'chapter-3',
    ]);
    expect(result.current.hasStoryReply).toBe(true);
    act(() => result.current.replayStoryReply());
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    expect(result.current.currentLine?.id).toBe('reply-1');
    expect(result.current.clips.map(({ id }) => id)).toEqual([
      'chapter-1',
      'chapter-2',
      'chapter-3',
    ]);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    act(() => result.current.reset());
    expect(result.current.hasStoryReply).toBe(false);
  });

  it('clears the saved story reply when the chapter changes', async () => {
    const chapter = [clip('chapter-1', 'odile')];
    const reply: TestClip = { ...clip('reply-1', 'pim', true), text: 'A new signal.' };
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (String(input).includes('/latest?sceneId='))
        return response(String(input).includes('sceneId=tavern') ? [] : chapter);
      if (String(input).endsWith('/prepare') && init?.method === 'POST')
        return { status: 202, json: async () => ({ id: 'reply-job' }) } as Response;
      if (String(input).includes('/job/reply-job'))
        return {
          ok: true,
          json: async () => ({ id: 'reply-job', status: 'ready', progress: 1, lines: [reply] }),
        } as Response;
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result, rerender } = renderHook(
      ({ sceneId }: { sceneId: 'lighthouse' | 'tavern' }) => useCastPerformance({ sceneId }),
      { initialProps: { sceneId: 'lighthouse' } },
    );
    await waitFor(() => expect(result.current.clips).toHaveLength(1));
    let succeeded = false;
    await act(async () => {
      succeeded = await result.current.performStoryReply({
        actor: 'pim',
        text: 'A new signal.',
        tags: [],
      });
    });
    expect(succeeded).toBe(true);
    expect(result.current.hasStoryReply).toBe(true);
    const replyVideo = result.current.video!;
    act(() => replyVideo.onended?.call(replyVideo, new Event('ended')));
    rerender({ sceneId: 'tavern' });
    await waitFor(() => expect(result.current.hasStoryReply).toBe(false));
    act(() => result.current.replayStoryReply());
    expect(play).toHaveBeenCalledTimes(1);
    expect(result.current.currentLine).toBeNull();
  });

  it('falls back to story reply audio without changing the saved chapter clip', async () => {
    const chapter = [clip('chapter-1', 'odile', true), clip('chapter-2', 'rocco')];
    const reply: TestClip = { ...clip('reply-1', 'pim', true), text: 'A new signal.' };
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (String(input).endsWith('/latest?sceneId=lighthouse')) return response(chapter);
      if (String(input).endsWith('/prepare') && init?.method === 'POST')
        return { status: 202, json: async () => ({ id: 'reply-job' }) } as Response;
      if (String(input).includes('/job/reply-job'))
        return {
          ok: true,
          json: async () => ({ id: 'reply-job', status: 'ready', progress: 1, lines: [reply] }),
        } as Response;
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCastPerformance());
    await waitFor(() =>
      expect(result.current.clips.map(({ id }) => id)).toEqual(['chapter-1', 'chapter-2']),
    );
    await act(async () => {
      await result.current.performStoryReply({ actor: 'pim', text: 'A new signal.', tags: [] });
    });
    const replyVideo = result.current.video!;
    act(() => replyVideo.onerror?.call(replyVideo, new Event('error')));
    await waitFor(() => expect(result.current.playbackMode).toBe('audio-only'));
    expect(play).toHaveBeenCalledTimes(2);
    expect(result.current.currentLine?.id).toBe('reply-1');
    expect(result.current.clips.map(({ id }) => id)).toEqual(['chapter-1', 'chapter-2']);
    expect(result.current.clips[0]).toMatchObject({ videoUrl, mode: 'avatar' });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });

  it('returns false on partial story generation and preserves the chapter array and held line', async () => {
    const chapter = [clip('chapter-1', 'odile', true), clip('chapter-2', 'rocco')];
    const partialReply = clip('reply-audio', 'pim');
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      if (String(input).endsWith('/latest?sceneId=lighthouse')) return response(chapter);
      if (String(input).endsWith('/prepare') && init?.method === 'POST')
        return { status: 202, json: async () => ({ id: 'partial-job' }) } as Response;
      if (String(input).includes('/job/partial-job'))
        return {
          ok: true,
          json: async () => ({
            id: 'partial-job',
            status: 'partial',
            progress: 1,
            lines: [partialReply],
          }),
        } as Response;
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCastPerformance());
    await waitFor(() =>
      expect(result.current.clips.map(({ id }) => id)).toEqual(['chapter-1', 'chapter-2']),
    );
    act(() => result.current.roll());
    await waitFor(() => expect(result.current.currentLine?.id).toBe('chapter-1'));
    act(() => result.current.cut());
    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.performStoryReply({
        actor: 'pim',
        text: 'Wait for me.',
        tags: [],
      });
    });
    expect(succeeded).toBe(false);
    expect(result.current.currentLine?.id).toBe('chapter-1');
    expect(result.current.clips.map(({ id }) => id)).toEqual(['chapter-1', 'chapter-2']);
    expect(result.current.error).toContain('story reply');
  });
});
