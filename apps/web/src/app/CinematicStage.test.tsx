// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHAPTERS } from '../story/chapters';
import { CinematicStage } from './CinematicStage';

const context = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
};
type TestVideo = {
  element: HTMLVideoElement;
  frameCallbacks: Map<number, (now: number) => void>;
  request: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
};
let frameId = 0;
function makeVideo(readyState = 2): TestVideo {
  const element = document.createElement('video');
  Object.defineProperties(element, {
    readyState: { configurable: true, value: readyState },
    videoWidth: { configurable: true, value: 640 },
    videoHeight: { configurable: true, value: 480 },
  });
  const frameCallbacks = new Map<number, (now: number) => void>();
  const request = vi.fn((callback: (now: number) => void) => {
    const id = ++frameId;
    frameCallbacks.set(id, callback);
    return id;
  });
  const cancel = vi.fn((id: number) => frameCallbacks.delete(id));
  Object.defineProperties(element, {
    requestVideoFrameCallback: { configurable: true, value: request },
    cancelVideoFrameCallback: { configurable: true, value: cancel },
  });
  return { element, frameCallbacks, request, cancel };
}

const props = (
  video: HTMLVideoElement | null,
  extra: { reducedMotion?: boolean; actor?: 'odile' | 'rocco' } = {},
) => ({
  actor: extra.actor ?? 'odile',
  video,
  hasPerformance: true,
  paused: false,
  chapter: CHAPTERS[0]!,
  reducedMotion: extra.reducedMotion ?? false,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  context.drawImage.mockClear();
  context.clearRect.mockClear();
});

describe('CinematicStage transitions', () => {
  it('holds the last sampled frame until the next video has data, then fades it away', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => context as unknown as CanvasRenderingContext2D,
    );
    const first = makeVideo(2);
    const second = makeVideo(0);
    const { rerender, container, unmount } = render(<CinematicStage {...props(first.element)} />);
    await waitFor(() => expect(first.request).toHaveBeenCalled());
    const latestFrame = Math.max(...first.frameCallbacks.keys());
    first.frameCallbacks.get(latestFrame)?.(performance.now() + 150);

    rerender(<CinematicStage {...props(second.element, { actor: 'rocco' })} />);
    const held = container.querySelector('.film-transition-frame') as HTMLCanvasElement;
    expect(held.dataset.transition).toBe('holding');
    expect(held.hidden).toBe(false);
    expect(held.dataset.transitionActor).toBe('odile');
    expect(context.drawImage).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 0, 0);
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(container.querySelectorAll('audio')).toHaveLength(0);

    Object.defineProperty(second.element, 'readyState', { configurable: true, value: 2 });
    act(() => second.element.dispatchEvent(new Event('loadeddata')));
    expect(held.dataset.transition).toBe('fading');
    await waitFor(() => expect(held.dataset.transition).toBe('hidden'), { timeout: 800 });
    expect(first.cancel).toHaveBeenCalled();
    unmount();
    expect(second.cancel).toHaveBeenCalled();
  });

  it('skips held-frame dissolves with reduced motion and keeps one media element', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => context as unknown as CanvasRenderingContext2D,
    );
    const first = makeVideo(2);
    const second = makeVideo(0);
    const { rerender, container } = render(
      <CinematicStage {...props(first.element, { reducedMotion: true })} />,
    );
    expect(first.request).not.toHaveBeenCalled();
    rerender(
      <CinematicStage {...props(second.element, { reducedMotion: true, actor: 'rocco' })} />,
    );
    const held = container.querySelector('.film-transition-frame') as HTMLCanvasElement;
    expect(held.dataset.transition).toBe('hidden');
    expect(held.hidden).toBe(true);
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(container.querySelectorAll('audio')).toHaveLength(0);
  });

  it('clears the stored prior-scene frame when the chapter changes', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => context as unknown as CanvasRenderingContext2D,
    );
    const first = makeVideo(2);
    const { rerender, container } = render(<CinematicStage {...props(first.element)} />);
    await waitFor(() => expect(first.request).toHaveBeenCalled());
    const id = Math.max(...first.frameCallbacks.keys());
    first.frameCallbacks.get(id)?.(performance.now() + 150);
    rerender(<CinematicStage {...props(null)} chapter={CHAPTERS[1]!} />);
    const held = container.querySelector('.film-transition-frame') as HTMLCanvasElement;
    expect(held.dataset.transition).toBe('hidden');
    expect(held.hidden).toBe(true);
    const offscreen = container.querySelector('.film-frame-buffer') as HTMLCanvasElement;
    expect(offscreen.width).toBe(0);
    expect(offscreen.height).toBe(0);
  });

  it('shows a selected held still without covering it with the prior actor frame', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => context as unknown as CanvasRenderingContext2D,
    );
    const first = makeVideo(2);
    const { rerender, container } = render(<CinematicStage {...props(first.element)} />);
    await waitFor(() => expect(first.request).toHaveBeenCalled());
    const frame = Math.max(...first.frameCallbacks.keys());
    first.frameCallbacks.get(frame)?.(performance.now() + 150);
    const buffer = container.querySelector('.film-frame-buffer') as HTMLCanvasElement;
    expect(buffer.width).toBe(640);

    rerender(<CinematicStage {...props(null, { actor: 'rocco' })} />);
    const transition = container.querySelector('.film-transition-frame') as HTMLCanvasElement;
    expect(transition.hidden).toBe(true);
    expect(transition.dataset.transition).toBe('hidden');
    expect(buffer.width).toBe(0);
    expect(buffer.height).toBe(0);
    expect(container.querySelector('.film-portrait')?.getAttribute('src')).toContain(
      'rocco-landscape',
    );
  });
});
