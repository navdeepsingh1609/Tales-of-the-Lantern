import { describe, expect, it } from 'vitest';
import { bytesToBase64, floatToPCM16LE, LinearResampler } from './pcm';

describe('microphone PCM boundary', () => {
  it('clips float input and encodes signed little-endian PCM', () => {
    const bytes = floatToPCM16LE(Float32Array.from([-2, -0.5, 0, 0.5, 2, NaN]));
    const view = new DataView(bytes.buffer);
    expect(Array.from({ length: 6 }, (_, index) => view.getInt16(index * 2, true))).toEqual([
      -32768, -16384, 0, 16384, 32767, 0,
    ]);
    expect(Buffer.from(bytesToBase64(bytes), 'base64')).toEqual(Buffer.from(bytes));
  });

  it('preserves resampling continuity across capture blocks', () => {
    const input = Float32Array.from({ length: 2205 }, (_, index) => Math.sin(index * 0.09));
    const whole = new LinearResampler(44_100).push(input);
    const split = new LinearResampler(44_100);
    const parts = [
      split.push(input.slice(0, 128)),
      split.push(input.slice(128, 1024)),
      split.push(input.slice(1024)),
    ];
    const joined = Float32Array.from(parts.flatMap((part) => Array.from(part)));
    expect(joined.length).toBe(whole.length);
    for (let index = 0; index < whole.length; index++)
      expect(joined[index]).toBeCloseTo(whole[index]!, 5);
    expect(whole.length).toBeGreaterThanOrEqual(1199);
    expect(whole.length).toBeLessThanOrEqual(1200);
  });
});
