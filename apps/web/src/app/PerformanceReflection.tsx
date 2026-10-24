import { useEffect, useRef, useState } from 'react';

/** A low-resolution ambient spill from the existing player; it never creates another media/audio source. */
export function PerformanceReflection({
  video,
  imageUrl,
  reducedMotion,
}: {
  video: HTMLVideoElement | null;
  imageUrl: string;
  reducedMotion: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [paintedVideo, setPaintedVideo] = useState<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (
      !video ||
      reducedMotion ||
      window.matchMedia('(prefers-reduced-transparency: reduce)').matches
    )
      return;
    const target = canvas.current;
    if (!target) return;
    const context = target.getContext('2d', { alpha: false });
    if (!context) return;
    let alive = true;
    let frame = 0;
    let lastPaint = 0;
    const draw = () => {
      if (!alive || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      try {
        const ratio = target.width / target.height;
        const sourceRatio = video.videoWidth / video.videoHeight;
        const sourceWidth = sourceRatio > ratio ? video.videoHeight * ratio : video.videoWidth;
        const sourceHeight = sourceWidth / ratio;
        context.drawImage(
          video,
          (video.videoWidth - sourceWidth) / 2,
          (video.videoHeight - sourceHeight) / 2,
          sourceWidth,
          sourceHeight,
          0,
          0,
          target.width,
          target.height,
        );
        setPaintedVideo((previous) => (previous === video ? previous : video));
      } catch {
        /* Retain the scene artwork when a frame is unavailable. */
      }
    };
    const supportsVideoFrames = typeof video.requestVideoFrameCallback === 'function';
    const tick: VideoFrameRequestCallback = (now) => {
      if (!alive) return;
      if (!document.hidden && now - lastPaint >= 80) {
        draw();
        lastPaint = now;
      }
      frame = video.requestVideoFrameCallback(tick);
    };
    const fallbackTick = (now: number) => {
      if (!alive) return;
      if (!document.hidden && !video.paused && now - lastPaint >= 100) {
        draw();
        lastPaint = now;
      }
      frame = requestAnimationFrame(fallbackTick);
    };
    video.addEventListener('loadeddata', draw);
    video.addEventListener('seeked', draw);
    draw();
    frame = supportsVideoFrames
      ? video.requestVideoFrameCallback(tick)
      : requestAnimationFrame(fallbackTick);
    return () => {
      alive = false;
      video.removeEventListener('loadeddata', draw);
      video.removeEventListener('seeked', draw);
      if (supportsVideoFrames) video.cancelVideoFrameCallback(frame);
      else cancelAnimationFrame(frame);
    };
  }, [video, reducedMotion]);
  const live = video !== null && paintedVideo === video && !reducedMotion;
  return (
    <div className="player-ambient" aria-hidden="true">
      <img src={imageUrl} alt="" style={{ opacity: live ? 0 : 1 }} />
      <canvas width={320} height={180} ref={canvas} style={{ opacity: live ? 1 : 0 }} />
    </div>
  );
}
