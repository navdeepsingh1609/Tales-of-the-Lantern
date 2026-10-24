import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActorId } from '../stage/stageTypes';
import '../styles/film-stage.css';
import type { Chapter } from '../story/chapters';
import { IdleReaction } from './IdleReaction';

const NAMES = { odile: 'Odile', rocco: 'Rocco', pim: 'Pim' };
type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};
type TransitionState = 'hidden' | 'holding' | 'fading';

/** Show the original complete frame. A still-image alpha mask cannot follow generated motion. */
export function CinematicStage({
  actor,
  video,
  hasPerformance = false,
  paused,
  chapter,
  previewActor = null,
  listening = false,
  idleActor,
  reducedMotion,
}: {
  actor: ActorId;
  video: HTMLVideoElement | null;
  chapter: Chapter;
  paused: boolean;
  reducedMotion: boolean;
  hasPerformance?: boolean;
  previewActor?: ActorId | null;
  listening?: boolean;
  idleActor?: ActorId;
}) {
  const host = useRef<HTMLDivElement>(null);
  const buffer = useRef<HTMLCanvasElement>(null);
  const transitionCanvas = useRef<HTMLCanvasElement>(null);
  const [readyVideo, setReadyVideo] = useState<HTMLVideoElement | null>(null);
  const [readyIdleActor, setReadyIdleActor] = useState<ActorId | null>(null);
  const idleReady = useCallback(
    (ready: boolean) => setReadyIdleActor(ready ? (idleActor ?? null) : null),
    [idleActor],
  );
  const [wide, setWide] = useState(false);
  const [fullFrame, setFullFrame] = useState(false);
  const [transitionState, setTransitionState] = useState<TransitionState>('hidden');
  const [transitionActor, setTransitionActor] = useState<ActorId>('odile');
  const [transitionFullFrame, setTransitionFullFrame] = useState(false);
  const transitionStateRef = useRef<TransitionState>('hidden');
  const lastFrameView = useRef({ actor, fullFrame });
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setTransition = useCallback((next: TransitionState) => {
    transitionStateRef.current = next;
    setTransitionState(next);
  }, []);

  useEffect(() => {
    const holdLastFrame = () => {
      if (reducedMotion) return;
      const source = buffer.current;
      const target = transitionCanvas.current;
      if (!source?.width || !source.height || !target) return;
      target.width = source.width;
      target.height = source.height;
      const context = target.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, target.width, target.height);
      context.drawImage(source, 0, 0);
      setTransitionActor(lastFrameView.current.actor);
      setTransitionFullFrame(lastFrameView.current.fullFrame);
      setTransition('holding');
    };
    if (!video || !host.current) {
      if (!video) {
        setTransition('hidden');
        if (!hasPerformance || lastFrameView.current.actor !== actor) {
          if (buffer.current) {
            const context = buffer.current.getContext('2d');
            context?.clearRect(0, 0, buffer.current.width, buffer.current.height);
            buffer.current.width = 0;
            buffer.current.height = 0;
          }
          if (transitionCanvas.current) {
            transitionCanvas.current.width = 0;
            transitionCanvas.current.height = 0;
          }
        }
      }
      return;
    }
    const parent = host.current;
    holdLastFrame();
    video.className = 'film-video';
    video.setAttribute('aria-label', `${NAMES[actor]} Higgs performance`);
    video.controls = false;
    parent.appendChild(video);
    const ready = () => {
      if (video.readyState < 2) return;
      setReadyVideo(video);
      if (transitionStateRef.current === 'holding') {
        setTransition('fading');
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
        fadeTimer.current = setTimeout(() => {
          setTransition('hidden');
          fadeTimer.current = null;
        }, 220);
      } else setTransition('hidden');
    };
    video.addEventListener('loadeddata', ready);
    ready();
    return () => {
      video.removeEventListener('loadeddata', ready);
      if (video.parentNode === parent) parent.removeChild(video);
    };
  }, [actor, hasPerformance, reducedMotion, setTransition, video]);

  useEffect(() => {
    if (!video || reducedMotion) return;
    const frameVideo = video as FrameVideo;
    let active = true;
    let rafId: number | undefined;
    let interval: ReturnType<typeof setInterval> | null = null;
    let lastSample = -Infinity;
    const cancelLoop = () => {
      active = false;
      if (rafId !== undefined) frameVideo.cancelVideoFrameCallback?.(rafId);
      if (interval) clearInterval(interval);
      interval = null;
    };
    const copyFrame = (now = performance.now()) => {
      if (!active || document.visibilityState === 'hidden' || video.readyState < 2) return;
      if (now - lastSample < 100) return;
      const target = buffer.current;
      if (!target || video.videoWidth <= 0 || video.videoHeight <= 0) return;
      lastSample = now;
      const scale = Math.min(1, 960 / video.videoWidth, 720 / video.videoHeight);
      target.width = Math.max(1, Math.round(video.videoWidth * scale));
      target.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = target.getContext('2d');
      if (!context) return;
      context.drawImage(video, 0, 0, target.width, target.height);
      lastFrameView.current = { actor, fullFrame };
    };
    const schedule = () => {
      if (!active || paused || document.visibilityState === 'hidden') return;
      if (frameVideo.requestVideoFrameCallback) {
        rafId = frameVideo.requestVideoFrameCallback((now) => {
          copyFrame(now);
          schedule();
        });
      } else if (!interval) interval = setInterval(() => copyFrame(), 100);
    };
    copyFrame();
    schedule();
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        if (rafId !== undefined) frameVideo.cancelVideoFrameCallback?.(rafId);
        rafId = undefined;
        if (interval) clearInterval(interval);
        interval = null;
      } else schedule();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelLoop();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [actor, fullFrame, paused, reducedMotion, video]);

  useEffect(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = null;
    if (buffer.current) {
      const context = buffer.current.getContext('2d');
      context?.clearRect(0, 0, buffer.current.width, buffer.current.height);
      buffer.current.width = 0;
      buffer.current.height = 0;
    }
    if (transitionCanvas.current) {
      transitionCanvas.current.width = 0;
      transitionCanvas.current.height = 0;
    }
    setTransition('hidden');
  }, [chapter.id, setTransition]);

  useEffect(
    () => () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      if (buffer.current) {
        buffer.current.width = 0;
        buffer.current.height = 0;
      }
      if (transitionCanvas.current) {
        transitionCanvas.current.width = 0;
        transitionCanvas.current.height = 0;
      }
    },
    [],
  );
  const showingScene = listening || !hasPerformance || wide;
  const preview = !hasPerformance && !listening ? previewActor : null;
  const hasFrame = video !== null && readyVideo === video;
  const showingIdle = idleActor !== undefined && !reducedMotion;
  const showingReadyIdle = showingIdle && readyIdleActor === idleActor;
  const drifting = showingScene && !paused && !reducedMotion;
  return (
    <div
      className="film-stage"
      data-view={showingScene ? 'scene' : 'performance'}
      data-framing={fullFrame ? 'full' : 'close'}
      data-actor={actor}
    >
      <img
        className={`film-master${preview ? ' is-reference' : ''}${drifting ? ' is-drifting' : ''}`}
        src={
          listening
            ? `${chapter.previewBase}/listening-v1.png`
            : preview
              ? `${chapter.previewBase}/${preview}-landscape-v1.png`
              : chapter.masterUrl
        }
        alt={
          listening
            ? 'Odile, Rocco and Pim looking toward your seat at the table; listening illustration.'
            : preview
              ? `${NAMES[preview]} in the ${chapter.title} setting; static shot reference.`
              : `Odile, Pim and Rocco together in ${chapter.title}; a shared scene illustration.`
        }
        hidden={!showingScene}
      />
      <div className="film-coverage" hidden={showingScene}>
        <img
          className="film-portrait"
          src={`${chapter.previewBase}/${actor}-landscape-v1.png`}
          alt={`${NAMES[actor]} still portrait`}
          style={{ visibility: hasFrame ? 'hidden' : 'visible' }}
        />
        <canvas ref={buffer} className="film-frame-buffer" aria-hidden="true" />
        <canvas
          ref={transitionCanvas}
          className={`film-transition-frame${transitionState === 'fading' ? ' is-fading' : ''}`}
          data-transition={transitionState}
          data-transition-actor={transitionActor}
          data-transition-framing={transitionFullFrame ? 'full' : 'close'}
          aria-hidden="true"
          hidden={transitionState === 'hidden'}
        />
        <div
          className="film-video-host"
          ref={host}
          style={{ visibility: hasFrame ? 'visible' : 'hidden' }}
        />
      </div>
      {showingIdle && (
        <IdleReaction
          key={`${chapter.id}-${idleActor}`}
          src={`${chapter.previewBase}/idle-${idleActor}-v1.mp4`}
          reducedMotion={reducedMotion}
          onReadyChange={idleReady}
        />
      )}
      <div className="film-topline">
        <span>
          {showingReadyIdle
            ? `${NAMES[idleActor!]} · Listening`
            : showingScene
              ? listening
                ? 'The cast is listening to you'
                : `${chapter.settingLabel} · Establishing shot`
              : `${NAMES[actor]}${paused ? ' · Held' : video ? '' : ' · Audio only / still portrait'}`}
        </span>
        {hasPerformance && !listening && (
          <div className="film-view-controls">
            {!showingScene && (
              <button
                className="film-view-button"
                aria-pressed={fullFrame}
                onClick={() => setFullFrame((value) => !value)}
              >
                {fullFrame ? 'Close-up' : 'Full frame'}
              </button>
            )}
            <button
              className="film-view-button"
              aria-pressed={wide}
              onClick={() => setWide((value) => !value)}
            >
              {wide ? 'Show performance' : 'Show scene'}
            </button>
          </div>
        )}
      </div>
      {showingReadyIdle ? (
        <span className="film-generated-label">Higgs-generated idle reaction</span>
      ) : showingScene ? (
        <span className="film-reference-label">
          {listening ? 'Listening illustration' : 'Scene illustration'}
        </span>
      ) : (
        <span className="film-generated-label">Higgs-generated performance</span>
      )}
    </div>
  );
}
