/** Stateful linear resampler so interpolation remains continuous across worklet blocks. */
export class LinearResampler {
  private samples = new Float32Array(0);
  private position = 0;
  private readonly step: number;

  constructor(
    readonly inputRate: number,
    readonly outputRate = 24_000,
  ) {
    if (!(inputRate > 0) || !(outputRate > 0))
      throw new RangeError('Sample rates must be positive');
    this.step = inputRate / outputRate;
  }

  push(input: Float32Array): Float32Array {
    if (!input.length) return new Float32Array(0);
    const joined = new Float32Array(this.samples.length + input.length);
    joined.set(this.samples);
    joined.set(input, this.samples.length);
    const result: number[] = [];
    while (this.position + 1 < joined.length) {
      const left = Math.floor(this.position);
      const fraction = this.position - left;
      const first = joined[left]!;
      const second = joined[left + 1]!;
      result.push(first + (second - first) * fraction);
      this.position += this.step;
    }
    const consumed = Math.min(Math.floor(this.position), joined.length - 1);
    this.samples = joined.slice(consumed);
    this.position -= consumed;
    return Float32Array.from(result);
  }
}

export function floatToPCM16LE(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i]!;
    const sample = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
    view.setInt16(
      i * 2,
      sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767),
      true,
    );
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  // Chunking avoids overflowing the argument stack on larger buffers.
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
  }
  return btoa(binary);
}
