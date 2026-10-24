import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { SceneSchema } from '../src/index.js';

const fixture = JSON.parse(
  await readFile(new URL('../../../content/scenes/lighthouse.json', import.meta.url), 'utf8'),
) as unknown;
const validScene = SceneSchema.parse(fixture);

describe('SceneSchema', () => {
  it('accepts the lighthouse fixture', () => {
    expect(validScene.id).toBe('lighthouse');
    expect(validScene.lines).toHaveLength(8);
  });

  it('rejects unknown tags and actors', () => {
    expect(
      SceneSchema.safeParse({
        ...(fixture as object),
        lines: [{ ...validScene.lines[0], tags: ['emotion:made_up'] }],
      }).success,
    ).toBe(false);
    expect(
      SceneSchema.safeParse({
        ...(fixture as object),
        lines: [{ ...validScene.lines[0], actor: 'wren' }],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate IDs, overlong text, and variants for unknown IDs', () => {
    const line = validScene.lines[0]!;
    expect(SceneSchema.safeParse({ ...validScene, lines: [line, line] }).success).toBe(false);
    expect(
      SceneSchema.safeParse({ ...validScene, lines: [{ ...line, text: 'x'.repeat(301) }] }).success,
    ).toBe(false);
    expect(
      SceneSchema.safeParse({ ...validScene, variants: { es: { missing: 'Hola' } } }).success,
    ).toBe(false);
  });

  it('rejects undocumented inline tokens', () => {
    const line = validScene.lines[0]!;
    expect(
      SceneSchema.safeParse({
        ...validScene,
        lines: [{ ...line, text: '<|emotion:made_up|>Hello' }],
      }).success,
    ).toBe(false);
    expect(
      SceneSchema.safeParse({
        ...validScene,
        lines: [{ ...line, text: '<|emotion:sadness Hello' }],
      }).success,
    ).toBe(false);
    expect(
      SceneSchema.safeParse({ ...validScene, lines: [{ ...line, text: 'Hello |>' }] }).success,
    ).toBe(false);
  });

  it('rejects duplicate declared actors', () => {
    expect(SceneSchema.safeParse({ ...validScene, actors: ['odile', 'odile'] }).success).toBe(
      false,
    );
  });

  it('rejects an empty inline token', () => {
    const line = validScene.lines[0]!;
    expect(
      SceneSchema.safeParse({ ...validScene, lines: [{ ...line, text: '<||>Hello' }] }).success,
    ).toBe(false);
  });
});
