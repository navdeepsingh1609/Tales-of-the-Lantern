// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const appState = vi.hoisted(() => ({
  stageProps: vi.fn(),
  performance: {
    jobStatus: 'idle',
    progress: 0,
    error: '',
    clips: [
      {
        id: 'line-1',
        actor: 'odile',
        language: 'en',
        text: 'The lantern is still burning.',
        voice: 'eleanor',
        audioUrl: `/api/performance/media/${'a'.repeat(64)}/audio`,
        mode: 'audio-only',
        cached: true,
      },
    ],
    currentLine: null,
    playing: false,
    comparisonReady: false,
    video: null,
    currentTime: 0,
    duration: 12,
    hasStoryReply: false,
    prepareCustom: vi.fn(),
    roll: vi.fn(),
    cut: vi.fn(),
    reset: vi.fn(),
    holdLine: vi.fn(),
    cancelPreparation: vi.fn(),
    directCurrentLine: vi.fn(),
    auditionTake: vi.fn(),
    replayStoryReply: vi.fn(),
  },
  story: {
    status: 'idle',
    sessionActive: false,
    attention: false,
    level: 0,
    transcript: '',
    error: '',
    cancel: vi.fn(),
    onMic: vi.fn(),
    onTypedTurn: vi.fn(),
  },
}));

vi.mock('../performance/useCastPerformance', () => ({
  useCastPerformance: () => appState.performance,
}));
vi.mock('../story/useStoryConversation', () => ({
  useStoryConversation: () => appState.story,
}));
vi.mock('./CinematicStage', () => ({
  CinematicStage: (props: Record<string, unknown>) => {
    appState.stageProps(props);
    return null;
  },
}));
vi.mock('./PerformanceReflection', () => ({ PerformanceReflection: () => null }));
vi.mock('./StudioLantern', () => ({ StudioLantern: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/script/status') return Response.json({ configured: true });
      return Response.json({});
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App conversation layout', () => {
  it('offers chapter-specific story starters through the typed response path', () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText('Write a reply', { selector: 'summary' }));
    const starters = screen.getByRole('region', { name: 'Conversation starters' });
    fireEvent.click(within(starters).getByRole('button', { name: 'Rocco, who sent the letter?' }));
    expect(appState.story.onTypedTurn).toHaveBeenCalledWith('Rocco, who sent the letter?');
    expect(appState.story.onMic).not.toHaveBeenCalled();
    expect(appState.performance.prepareCustom).not.toHaveBeenCalled();
  });
  it('cancels queued story work before resetting the player', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset performance' }));
    expect(appState.story.cancel).toHaveBeenCalledOnce();
    expect(appState.performance.reset).toHaveBeenCalledOnce();
    expect(appState.story.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      appState.performance.reset.mock.invocationCallOrder[0]!,
    );
  });
  it('defaults to system reduced motion and allows explicitly enabling saved reactions', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    render(<App />);
    fireEvent.click(screen.getByLabelText('Scene settings'));
    const motion = screen.getByRole('checkbox', { name: 'Character motion' });
    expect((motion as HTMLInputElement).checked).toBe(false);
    expect(appState.stageProps.mock.calls.at(-1)?.[0].reducedMotion).toBe(true);
    fireEvent.click(motion);
    expect(appState.stageProps.mock.calls.at(-1)?.[0].reducedMotion).toBe(false);
    expect(appState.performance.prepareCustom).not.toHaveBeenCalled();
    expect(vi.mocked(fetch).mock.calls.some((call) => call[1]?.method === 'POST')).toBe(false);
  });
  it('keeps Direct and Join in the same toolbar and removes the inspector and mode tabs', () => {
    render(<App />);
    const toolbar = screen.getByRole('region', { name: 'Story playback and interaction' });
    expect(within(toolbar).getByRole('button', { name: 'Direct' })).toBeTruthy();
    expect(within(toolbar).getByRole('group', { name: 'Join the conversation' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Inspector' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Director' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Story' })).toBeNull();
  });

  it('opens Direct on a saved line without rolling playback or requesting media', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<App />);
    const toolbar = screen.getByRole('region', { name: 'Story playback and interaction' });
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Direct' }));

    expect(appState.performance.holdLine).toHaveBeenCalledWith(0);
    expect(appState.performance.roll).not.toHaveBeenCalled();
    expect(appState.performance.prepareCustom).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some((call) => {
        const url = String(call[0]);
        const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
        return method === 'POST' || url.includes('/api/performance/prepare');
      }),
    ).toBe(false);
  });

  it('reveals the scene premise and existing review draft from Write a scene', () => {
    render(<App />);
    expect(screen.queryByRole('heading', { name: 'Review dialogue' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Write a scene' }));
    expect(screen.getByRole('textbox', { name: 'Scene premise' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Review dialogue' })).toBeTruthy();
    expect(screen.getAllByRole('textbox', { name: /Odile/ }).length).toBeGreaterThan(0);
  });

  it('selects Pim for idle preview, resets playback and makes no media request', () => {
    const fetchMock = vi.mocked(fetch);
    render(<App />);
    const settings = screen.getByRole('group', { name: 'Reference preview' });
    const pim = within(settings).getByRole('button', { name: 'Pim' });
    expect(
      within(settings).getByRole('button', { name: 'Whole scene' }).getAttribute('aria-pressed'),
    ).toBe('true');

    fireEvent.click(pim);

    expect(pim.getAttribute('aria-pressed')).toBe('true');
    expect(appState.performance.reset).toHaveBeenCalledTimes(1);
    expect(appState.stageProps.mock.lastCall?.[0]).toMatchObject({ idleActor: 'pim' });
    expect(
      fetchMock.mock.calls.some((call) => {
        const method = (call[1] as RequestInit | undefined)?.method ?? 'GET';
        return method === 'POST';
      }),
    ).toBe(false);
  });
});
