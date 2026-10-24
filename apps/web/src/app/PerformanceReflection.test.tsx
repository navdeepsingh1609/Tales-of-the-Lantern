// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformanceReflection } from './PerformanceReflection';

type VideoWithFrameCallbacks = HTMLVideoElement & {
  requestVideoFrameCallback: (callback: VideoFrameRequestCallback) => number;
  cancelVideoFrameCallback: (handle: number) => void;
};

const makeVideo = () => {
  const video = document.createElement('video') as VideoWithFrameCallbacks;
  Object.defineProperties(video, {
    readyState: { configurable: true, value: 2 },
    videoWidth: { configurable: true, value: 640 },
    videoHeight: { configurable: true, value: 360 },
    paused: { configurable: true, value: false },
  });
  let nextHandle = 1;
  video.requestVideoFrameCallback = vi.fn(() => nextHandle++);
  video.cancelVideoFrameCallback = vi.fn();
  return video;
};

const drawImage = vi.fn();
const context = { drawImage } as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  drawImage.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PerformanceReflection', () => {
  it('draws the provided video into its canvas without creating another media element', () => {
    const video = makeVideo();
    const createElement = vi.spyOn(document, 'createElement');
    const { container } = render(
      <PerformanceReflection video={video} imageUrl="/scene.webp" reducedMotion={false} />,
    );

    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 360, 0, 0, 320, 180);
    expect(container.querySelectorAll('video, audio')).toHaveLength(0);
    expect(
      createElement.mock.calls.filter(([tag]) => ['video', 'audio'].includes(tag.toLowerCase())),
    ).toHaveLength(0);
    expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
  });

  it('cancels the old frame callback when the video changes and on unmount', () => {
    const firstVideo = makeVideo();
    const secondVideo = makeVideo();
    const { rerender, unmount } = render(
      <PerformanceReflection video={firstVideo} imageUrl="/scene.webp" reducedMotion={false} />,
    );

    rerender(
      <PerformanceReflection video={secondVideo} imageUrl="/scene.webp" reducedMotion={false} />,
    );
    expect(firstVideo.cancelVideoFrameCallback).toHaveBeenCalledWith(1);
    expect(secondVideo.requestVideoFrameCallback).toHaveBeenCalledTimes(1);

    unmount();
    expect(secondVideo.cancelVideoFrameCallback).toHaveBeenCalledWith(1);
  });

  it('does not draw or start live frame callbacks when reduced motion is enabled', () => {
    const video = makeVideo();
    render(<PerformanceReflection video={video} imageUrl="/scene.webp" reducedMotion />);

    expect(drawImage).not.toHaveBeenCalled();
    expect(video.requestVideoFrameCallback).not.toHaveBeenCalled();
    expect(video.cancelVideoFrameCallback).not.toHaveBeenCalled();
  });

  it('cancels the pending animation frame when using the fallback frame loop', () => {
    const video = document.createElement('video');
    Object.defineProperties(video, {
      readyState: { configurable: true, value: 2 },
      videoWidth: { configurable: true, value: 640 },
      videoHeight: { configurable: true, value: 360 },
      paused: { configurable: true, value: false },
    });
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(37);
    const cancelRaf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const { unmount } = render(
      <PerformanceReflection video={video} imageUrl="/scene.webp" reducedMotion={false} />,
    );

    expect(raf).toHaveBeenCalledTimes(1);
    act(() => unmount());
    expect(cancelRaf).toHaveBeenCalledWith(37);
  });
});
