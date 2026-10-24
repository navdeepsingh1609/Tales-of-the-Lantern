import { useEffect, useRef, useState } from 'react';
import '../styles/idle-reaction.css';

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

type IdleReactionProps = {
  src: string;
  reducedMotion: boolean;
  onReadyChange?: (ready: boolean) => void;
};

const CAPTURE_MAX_WIDTH = 640;
const LOOP_OVERLAP_SECONDS = 0.38;
const CROSSFADE_MS = 220;

export function IdleReaction({ src, reducedMotion, onReadyChange }: IdleReactionProps) {
  const videoRef = useRef<FrameVideo>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyChangeRef = useRef(onReadyChange);
  const currentSrcRef = useRef(src);
  const lastTime = useRef(-1);
  const holdingFrame = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    onReadyChangeRef.current = onReadyChange;
  }, [onReadyChange]);
  currentSrcRef.current = src;

  useEffect(() => {
    onReadyChangeRef.current?.(false);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !src || reducedMotion) return;

    let active = true;
    let frameHandle: number | null = null;
    let scheduleTimer: ReturnType<typeof setTimeout> | null = null;
    const frameVideo = video as FrameVideo;
    lastTime.current = -1;
    holdingFrame.current = false;
    setReadySrc(null);
    setHolding(false);
    setFading(false);
    setFailedSrc(null);

    const clearScheduledFrame = () => {
      if (scheduleTimer !== null) {
        clearTimeout(scheduleTimer);
        scheduleTimer = null;
      }
      if (frameHandle !== null) {
        frameVideo.cancelVideoFrameCallback?.(frameHandle);
        frameHandle = null;
      }
    };

    const captureLoopFrame = () => {
      if (!active || document.hidden || video.readyState < 2) return;
      const duration = video.duration;
      const currentTime = video.currentTime;
      if (holdingFrame.current && lastTime.current >= 0 && currentTime < lastTime.current - 0.15) {
        setFading(true);
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
        fadeTimer.current = setTimeout(() => {
          holdingFrame.current = false;
          setHolding(false);
          setFading(false);
          fadeTimer.current = null;
        }, CROSSFADE_MS);
      }
      lastTime.current = currentTime;

      if (
        !holdingFrame.current &&
        Number.isFinite(duration) &&
        duration > LOOP_OVERLAP_SECONDS &&
        currentTime >= duration - LOOP_OVERLAP_SECONDS
      ) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) return;
        const scale = Math.min(1, CAPTURE_MAX_WIDTH / width);
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        try {
          const context = canvas.getContext('2d');
          if (!context) return;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          holdingFrame.current = true;
          setHolding(true);
          setFading(false);
        } catch {
          /* Keep the looping video visible if the browser cannot copy this frame. */
        }
      }
    };

    const scheduleVideoFrame = () => {
      if (!active || document.hidden || !frameVideo.requestVideoFrameCallback) return;
      scheduleTimer = setTimeout(() => {
        scheduleTimer = null;
        if (!active || document.hidden) return;
        frameHandle = frameVideo.requestVideoFrameCallback!(() => {
          frameHandle = null;
          captureLoopFrame();
          scheduleVideoFrame();
        });
      }, 100);
    };

    const handleLoaded = () => {
      if (video.readyState >= 2) {
        setReadySrc(src);
        onReadyChangeRef.current?.(true);
      }
    };
    const handleError = () => {
      setFailedSrc(src);
      onReadyChangeRef.current?.(false);
    };
    const handleVisibility = () => {
      if (document.hidden) {
        clearScheduledFrame();
        video.pause();
      } else {
        // A muted autoplay can be paused while the page is backgrounded. Resume
        // explicitly on return; some browsers reject play() and that is OK.
        try {
          const playResult = video.play();
          playResult?.catch(() => undefined);
        } catch {
          // Ignore synchronous playback failures just like rejected play promises.
        }
        scheduleVideoFrame();
      }
    };

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;
    video.addEventListener('loadeddata', handleLoaded);
    video.addEventListener('error', handleError);
    if (!frameVideo.requestVideoFrameCallback) {
      video.addEventListener('timeupdate', captureLoopFrame);
    }
    document.addEventListener('visibilitychange', handleVisibility);
    handleLoaded();
    if (document.hidden) video.pause();
    else scheduleVideoFrame();

    return () => {
      active = false;
      clearScheduledFrame();
      if (fadeTimer.current) {
        clearTimeout(fadeTimer.current);
        fadeTimer.current = null;
      }
      video.removeEventListener('loadeddata', handleLoaded);
      video.removeEventListener('error', handleError);
      if (!frameVideo.requestVideoFrameCallback) {
        video.removeEventListener('timeupdate', captureLoopFrame);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      if (currentSrcRef.current === src) onReadyChangeRef.current?.(false);
      video.pause();
      if (video.getAttribute('src') === src) {
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [reducedMotion, src]);

  if (reducedMotion || !src) return null;

  return (
    <div
      className="idle-reaction"
      data-ready={readySrc === src}
      data-failed={failedSrc === src}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        src={src}
        muted
        autoPlay
        loop
        playsInline
        preload="auto"
        tabIndex={-1}
      />
      <canvas
        ref={canvasRef}
        className={`idle-reaction-frame${fading ? ' is-fading' : ''}`}
        data-holding={holding}
        hidden={!holding}
      />
    </div>
  );
}
