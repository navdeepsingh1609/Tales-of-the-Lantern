import { useCallback, useEffect, useRef, useState } from 'react';
import '../styles/spike-review.css';

type Evidence = Record<string, unknown>;
type EvidenceBundle = { tts?: Evidence; avatar?: Evidence; realtime?: Evidence };
type MseState = 'idle' | 'running' | 'pass' | 'fail';
const MSE_MIME = 'video/mp4; codecs="avc1.64001e, mp4a.40.2"';
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function timing(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? `${Math.round(value)} ms`
    : 'Not recorded';
}
function text(value: unknown, fallback = 'Not recorded'): string {
  return typeof value === 'string' && /^[a-zA-Z0-9 _.-]{1,80}$/.test(value) ? value : fallback;
}
function status(value: unknown): 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT RUN' {
  return value === 'PASS' || value === 'PARTIAL' || value === 'FAIL' ? value : 'NOT RUN';
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="spike-metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function SpikeReview() {
  const [evidence, setEvidence] = useState<EvidenceBundle | null>(null);
  const [evidenceError, setEvidenceError] = useState(false);
  const [mseState, setMseState] = useState<MseState>('idle');
  const [mseMessage, setMseMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const mseUrlRef = useRef<string | null>(null);
  const mseControllerRef = useRef<AbortController | null>(null);
  const mseRunRef = useRef(0);

  const clearMse = useCallback(() => {
    mseRunRef.current += 1;
    mseControllerRef.current?.abort();
    mseControllerRef.current = null;
    if (mseUrlRef.current) URL.revokeObjectURL(mseUrlRef.current);
    mseUrlRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.src = '/api/spike-media/video';
      video.load();
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/spike-evidence', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('unavailable');
        const payload: unknown = await response.json();
        if (!record(payload)) throw new Error('unavailable');
        const pick = (key: string): Evidence | undefined =>
          record(payload[key]) ? (payload[key] as Evidence) : undefined;
        const ttsEvidence = pick('tts');
        const avatarEvidence = pick('avatar');
        const realtimeEvidence = pick('realtime');
        setEvidence({
          ...(ttsEvidence ? { tts: ttsEvidence } : {}),
          ...(avatarEvidence ? { avatar: avatarEvidence } : {}),
          ...(realtimeEvidence ? { realtime: realtimeEvidence } : {}),
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setEvidenceError(true);
      });
    return () => {
      controller.abort();
      clearMse();
    };
  }, [clearMse]);

  const runMseTest = async () => {
    clearMse();
    const run = mseRunRef.current;
    if (!('MediaSource' in window) || !MediaSource.isTypeSupported(MSE_MIME)) {
      setMseState('fail');
      setMseMessage('This browser does not support the saved clip’s MP4 codec combination.');
      return;
    }
    const controller = new AbortController();
    mseControllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    setMseState('running');
    setMseMessage('Loading saved stream in bounded chunks…');
    try {
      const response = await fetch('/api/spike-media/video', { signal: controller.signal });
      if (!response.ok) throw new Error('Saved video is unavailable.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.byteLength > MAX_VIDEO_BYTES)
        throw new Error('Saved video is empty or exceeds the review limit.');
      if (run !== mseRunRef.current) return;

      const mediaSource = new MediaSource();
      const objectUrl = URL.createObjectURL(mediaSource);
      mseUrlRef.current = objectUrl;
      const video = videoRef.current;
      if (!video) throw new Error('Video player is unavailable.');
      video.pause();
      video.src = objectUrl;
      video.muted = true;

      await new Promise<void>((resolve, reject) => {
        const onOpen = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('MediaSource could not be opened.'));
        };
        const cleanup = () => {
          mediaSource.removeEventListener('sourceopen', onOpen);
          mediaSource.removeEventListener('error', onError);
          controller.signal.removeEventListener('abort', onAbort);
        };
        const onAbort = () => {
          cleanup();
          reject(new Error('Test cancelled.'));
        };
        mediaSource.addEventListener('sourceopen', onOpen, { once: true });
        mediaSource.addEventListener('error', onError, { once: true });
        controller.signal.addEventListener('abort', onAbort, { once: true });
      });
      if (run !== mseRunRef.current) return;
      const sourceBuffer = mediaSource.addSourceBuffer(MSE_MIME);
      for (let offset = 0; offset < bytes.length; offset += 64 * 1024) {
        if (controller.signal.aborted || run !== mseRunRef.current) return;
        const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + 64 * 1024));
        await new Promise<void>((resolve, reject) => {
          const onUpdate = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error('The browser rejected an MP4 media segment.'));
          };
          const cleanup = () => {
            sourceBuffer.removeEventListener('updateend', onUpdate);
            sourceBuffer.removeEventListener('error', onError);
            sourceBuffer.removeEventListener('abort', onAbort);
            controller.signal.removeEventListener('abort', onAbort);
          };
          const onAbort = () => {
            cleanup();
            reject(new Error('Test cancelled.'));
          };
          sourceBuffer.addEventListener('updateend', onUpdate, { once: true });
          sourceBuffer.addEventListener('error', onError, { once: true });
          sourceBuffer.addEventListener('abort', onAbort, { once: true });
          controller.signal.addEventListener('abort', onAbort, { once: true });
          try {
            sourceBuffer.appendBuffer(chunk);
          } catch (error) {
            cleanup();
            reject(error);
          }
        });
      }
      if (run !== mseRunRef.current || controller.signal.aborted) return;
      if (mediaSource.readyState === 'open') mediaSource.endOfStream();
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          video.removeEventListener('playing', onPlaying);
          video.removeEventListener('error', onVideoError);
          video.removeEventListener('loadedmetadata', onMetadata);
          controller.signal.removeEventListener('abort', onAbort);
          if (error) reject(error);
          else resolve();
        };
        const verify = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0 && !video.paused) finish();
        };
        const onPlaying = () => verify();
        const onMetadata = () => verify();
        const onVideoError = () =>
          finish(new Error('The saved MP4 could not be decoded for playback.'));
        const onAbort = () => finish(new Error('Test cancelled.'));
        video.addEventListener('playing', onPlaying);
        video.addEventListener('loadedmetadata', onMetadata);
        video.addEventListener('error', onVideoError);
        controller.signal.addEventListener('abort', onAbort, { once: true });
        void video
          .play()
          .then(verify)
          .catch(() => finish(new Error('The browser could not start muted playback.')));
        window.setTimeout(() => {
          if (video.videoWidth > 0 && video.videoHeight > 0 && !video.paused) verify();
          else finish(new Error('No decoded video frame was observed.'));
        }, 8000);
      });
      if (run !== mseRunRef.current) return;
      setMseState('pass');
      setMseMessage(`Playback decoded at ${video.videoWidth} × ${video.videoHeight}.`);
    } catch {
      if (run !== mseRunRef.current) return;
      setMseState('fail');
      setMseMessage(
        'MSE playback test failed. The direct saved-video player remains available below.',
      );
      clearMse();
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const tts = evidence?.tts ?? {};
  const avatar = evidence?.avatar ?? {};
  const realtime = evidence?.realtime ?? {};
  const realtimeTimings = record(realtime.timingMs) ? realtime.timingMs : {};

  return (
    <main className="page-shell spike-review">
      <header className="masthead spike-masthead">
        <a className="wordmark" href="/" aria-label="CUT! home">
          CUT<span>!</span>
        </a>
        <span className="masthead-note">A voice-directed theatre</span>
        <span className="preview-label">
          <span className="status-dot" />
          Offline media review
        </span>
      </header>
      <section className="spike-heading">
        <div>
          <p className="eyebrow">Gull Point Playhouse · feasibility notes</p>
          <h1>Feasibility review</h1>
        </div>
        <a className="quiet-button spike-back" href="/">
          ← Back to the stage
        </a>
      </section>
      <p className="spike-deck">
        Replay of REAL Higgs outputs. This page reviews saved artifacts only; it does not make fresh
        generations.
      </p>

      {evidenceError && (
        <p className="spike-notice" role="status">
          Evidence summary is unavailable. Saved media controls can still be tried.
        </p>
      )}

      <div className="spike-grid">
        <section className="spike-panel" aria-labelledby="audio-title">
          <p className="eyebrow">01 · Speech</p>
          <h2 id="audio-title">Higgs TTS</h2>
          <p className="spike-copy">Saved speech clip from the local probe run.</p>
          <audio className="spike-audio" controls preload="metadata" src="/api/spike-media/audio">
            Your browser does not support audio playback.
          </audio>
          <dl className="spike-metrics">
            <Metric label="Probe result" value={status(tts.outcome)} />
            <Metric label="First audio bytes" value={timing(tts.firstAudioMs)} />
            <Metric label="Clip duration" value={timing(tts.audioDurationMs)} />
            <Metric label="Saved audio" value={text(tts.wavFile, 'Not available')} />
          </dl>
        </section>

        <section className="spike-panel spike-avatar-panel" aria-labelledby="avatar-title">
          <p className="eyebrow">02 · Performance</p>
          <h2 id="avatar-title">Higgs Avatar stream</h2>
          <p className="spike-copy">
            Saved fragmented MP4. First-byte timing measures stream arrival, not first-frame
            latency.
          </p>
          <video
            ref={videoRef}
            className="spike-video"
            controls
            preload="metadata"
            width="480"
            height="640"
            src="/api/spike-media/video"
          >
            Your browser does not support video playback.
          </video>
          <dl className="spike-metrics">
            <Metric label="Probe result" value={status(avatar.outcome)} />
            <Metric label="First stream byte" value={timing(avatar.firstByteMs)} />
            <Metric label="Stream complete" value={timing(avatar.totalMs)} />
            <Metric label="Saved output" value={text(avatar.savedPath, 'Not available')} />
          </dl>
          <div className="spike-mse">
            <button
              className="primary-button"
              type="button"
              onClick={() => void runMseTest()}
              disabled={mseState === 'running'}
            >
              {mseState === 'running' ? 'Testing saved clip…' : 'Test MSE compatibility'}
            </button>
            {mseState !== 'idle' && (
              <p className={`spike-mse-result is-${mseState}`} role="status">
                {mseMessage}
              </p>
            )}
          </div>
        </section>

        <section className="spike-panel spike-realtime" aria-labelledby="realtime-title">
          <p className="eyebrow">03 · Interaction</p>
          <h2 id="realtime-title">Realtime session</h2>
          <p className="spike-copy">
            The local probe result, including any failure, is shown as recorded.
          </p>
          <dl className="spike-metrics">
            <Metric label="Probe result" value={text(realtime.status, 'NOT RUN').toUpperCase()} />
            <Metric label="Session timing" value={timing(realtimeTimings.websocketSession)} />
            <Metric label="Total probe time" value={timing(realtimeTimings.total)} />
            <Metric
              label="Recorded outcome"
              value={text(
                realtime.failureCode,
                realtime.status === 'completed' ? 'completed' : 'No failure code',
              )}
            />
          </dl>
        </section>
      </div>
      <footer className="stage-notes spike-footnote">
        <p>
          Review uses locally saved Higgs artifacts and sanitized evidence. Stream arrival and
          decoded playback are separate observations.
        </p>
        <span>Feasibility review</span>
      </footer>
    </main>
  );
}

export default SpikeReview;
