// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdleReaction } from './IdleReaction';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});

const readyVideo = (video: HTMLVideoElement) => {
  Object.defineProperty(video, 'readyState', { configurable: true, value: 2 });
};

describe('IdleReaction', () => {
  it('uses one muted inline looping video and waits for loaded data before showing it', () => {
    const onReadyChange = vi.fn();
    const { container } = render(
      <IdleReaction
        src="/scenes/gull-point/idle-odile-v1.mp4"
        reducedMotion={false}
        onReadyChange={onReadyChange}
      />,
    );
    const video = container.querySelector('video');

    expect(video).not.toBeNull();
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(container.querySelectorAll('audio')).toHaveLength(0);
    expect(video?.muted).toBe(true);
    expect(video?.playsInline).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
    expect(video?.getAttribute('src')).toBe('/scenes/gull-point/idle-odile-v1.mp4');
    expect(container.querySelector('.idle-reaction')?.getAttribute('data-ready')).toBe('false');
    expect(onReadyChange).toHaveBeenLastCalledWith(false);

    readyVideo(video!);
    fireEvent.loadedData(video!);
    expect(container.querySelector('.idle-reaction')?.getAttribute('data-ready')).toBe('true');
    expect(onReadyChange).toHaveBeenLastCalledWith(true);
  });

  it('renders no idle video when reduced motion is requested', () => {
    const onReadyChange = vi.fn();
    const { container } = render(
      <IdleReaction src="/idle.mp4" reducedMotion onReadyChange={onReadyChange} />,
    );
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('audio')).toBeNull();
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
  });

  it('hides the idle overlay after a media error so the underlying scene can show', () => {
    const onReadyChange = vi.fn();
    const { container } = render(
      <IdleReaction src="/idle.mp4" reducedMotion={false} onReadyChange={onReadyChange} />,
    );
    const video = container.querySelector('video')!;
    fireEvent.error(video);
    expect(container.querySelector('.idle-reaction')?.getAttribute('data-failed')).toBe('true');
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
  });

  it('uses the latest readiness callback without reloading the active clip', () => {
    const firstCallback = vi.fn();
    const nextCallback = vi.fn();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const { container, rerender } = render(
      <IdleReaction src="/idle.mp4" reducedMotion={false} onReadyChange={firstCallback} />,
    );
    const video = container.querySelector('video')!;
    firstCallback.mockClear();

    rerender(<IdleReaction src="/idle.mp4" reducedMotion={false} onReadyChange={nextCallback} />);
    expect(container.querySelector('video')).toBe(video);
    expect(pause).not.toHaveBeenCalled();
    readyVideo(video);
    fireEvent.loadedData(video);
    expect(firstCallback).not.toHaveBeenCalled();
    expect(nextCallback).toHaveBeenLastCalledWith(true);
  });

  it('preserves a replacement source when the same video element changes clips', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const { container, rerender } = render(
      <IdleReaction src="/idle-first.mp4" reducedMotion={false} />,
    );
    const video = container.querySelector('video');

    rerender(<IdleReaction src="/idle-second.mp4" reducedMotion={false} />);
    expect(container.querySelector('video')).toBe(video);
    expect(video?.getAttribute('src')).toBe('/idle-second.mp4');
    expect(pause).toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it('pauses on an initially hidden mount and resumes playback when visible', () => {
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const { container, unmount } = render(<IdleReaction src="/idle.mp4" reducedMotion={false} />);
    const video = container.querySelector('video')!;

    expect(pause).toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    fireEvent(document, new Event('visibilitychange'));
    expect(play).toHaveBeenCalledTimes(1);

    unmount();
    if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor);
    else Reflect.deleteProperty(document, 'hidden');
    expect(video.hasAttribute('src')).toBe(false);
  });

  it('handles a rejected play promise when a hidden page becomes visible', async () => {
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValue(new Error('blocked'));
    const { unmount } = render(<IdleReaction src="/idle.mp4" reducedMotion={false} />);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    fireEvent(document, new Event('visibilitychange'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(play).toHaveBeenCalledTimes(1);
    unmount();
    if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor);
    else Reflect.deleteProperty(document, 'hidden');
  });

  it('cancels pending frame callbacks and releases the video on unmount', () => {
    vi.useFakeTimers();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const originalRequest = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'requestVideoFrameCallback',
    );
    const originalCancel = Object.getOwnPropertyDescriptor(
      HTMLVideoElement.prototype,
      'cancelVideoFrameCallback',
    );
    const cancel = vi.fn();
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      value: vi.fn(() => 41),
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
      configurable: true,
      value: cancel,
    });
    const onReadyChange = vi.fn();
    const { container, unmount } = render(
      <IdleReaction src="/idle.mp4" reducedMotion={false} onReadyChange={onReadyChange} />,
    );
    const video = container.querySelector('video')! as HTMLVideoElement & {
      requestVideoFrameCallback: (callback: (now: number) => void) => number;
      cancelVideoFrameCallback: (handle: number) => void;
    };

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);

    unmount();
    expect(cancel).toHaveBeenCalledWith(41);
    expect(pause).toHaveBeenCalled();
    expect(load).toHaveBeenCalled();
    expect(video.hasAttribute('src')).toBe(false);
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
    if (originalRequest) {
      Object.defineProperty(
        HTMLVideoElement.prototype,
        'requestVideoFrameCallback',
        originalRequest,
      );
    } else {
      Reflect.deleteProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback');
    }
    if (originalCancel) {
      Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', originalCancel);
    } else {
      Reflect.deleteProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback');
    }
  });
});
