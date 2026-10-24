import { describe, expect, it } from 'vitest';
import { hasPlausibleFmp4, parseWavDuration } from './avatar-probe.js';

function wavFixture(seconds: number): Buffer {
  const dataBytes = seconds * 24_000 * 2;
  const b = Buffer.alloc(44 + dataBytes);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + dataBytes, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(24_000, 24);
  b.writeUInt32LE(48_000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(dataBytes, 40);
  return b;
}

function box(type: string, payload = Buffer.alloc(0)): Buffer {
  const b = Buffer.alloc(8 + payload.length);
  b.writeUInt32BE(b.length, 0);
  b.write(type, 4, 'ascii');
  payload.copy(b, 8);
  return b;
}

describe('avatar probe format validation', () => {
  it('computes WAV duration and rejects malformed chunk bounds', () => {
    expect(parseWavDuration(wavFixture(2))).toBe(2);
    const malformed = wavFixture(1);
    malformed.writeUInt32LE(0xffff_ffff, 40);
    expect(() => parseWavDuration(malformed)).toThrow();
  });

  it('requires a structurally plausible fMP4 with initialization and media boxes', () => {
    const valid = Buffer.concat([
      box('ftyp', Buffer.from('isom')),
      box('moof'),
      box('mdat', Buffer.from([1, 2, 3])),
    ]);
    expect(hasPlausibleFmp4(valid)).toBe(true);
    expect(hasPlausibleFmp4(Buffer.concat([box('ftyp'), box('mdat')]))).toBe(false);
    expect(
      hasPlausibleFmp4(Buffer.concat([box('ftyp'), Buffer.from([0, 0, 0, 2, 109, 111, 111, 102])])),
    ).toBe(false);
  });
});
