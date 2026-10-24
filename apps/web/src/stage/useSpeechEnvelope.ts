import { useEffect, useRef } from 'react';

/** Local cached WAV energy, not phoneme alignment or Avatar-to-mesh retargeting. */
export function useSpeechEnvelope(url: string | undefined) {
  const envelope = useRef<Float32Array | null>(null);
  useEffect(() => {
    envelope.current = null;
    if (!url) return;
    const controller = new AbortController();
    let alive = true;
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return;
        const context = new OfflineAudioContext(1, 1, 24000);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        const samples = buffer.getChannelData(0);
        const stride = Math.round(buffer.sampleRate / 30);
        const levels = new Float32Array(Math.ceil(samples.length / stride));
        for (let frame = 0; frame < levels.length; frame++) {
          const end = Math.min(samples.length, (frame + 1) * stride);
          let square = 0;
          for (let i = frame * stride; i < end; i++) square += (samples[i] ?? 0) ** 2;
          levels[frame] = Math.min(1, Math.sqrt(square / Math.max(1, end - frame * stride)) * 5);
        }
        if (alive) envelope.current = levels;
      } catch {
        /* A failed local decode leaves the mouth closed; playback remains intact. */
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [url]);
  return envelope;
}
