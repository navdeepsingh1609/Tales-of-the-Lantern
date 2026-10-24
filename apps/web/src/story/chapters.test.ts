import { describe, expect, it } from 'vitest';
import { InlineTagTextSchema, TagsSchema } from '@cut/shared';
import { CHAPTERS } from './chapters';

describe('authored chapters', () => {
  it('has unique chapter ids and matching scene artwork paths', () => {
    expect(new Set(CHAPTERS.map((chapter) => chapter.id)).size).toBe(CHAPTERS.length);
    for (const chapter of CHAPTERS) {
      expect(chapter.masterUrl).toBe(
        `/scenes/${chapter.id === 'lighthouse' ? 'gull-point' : chapter.id}/master-v1.png`,
      );
      expect(chapter.previewBase).toBe(
        `/scenes/${chapter.id === 'lighthouse' ? 'gull-point' : chapter.id}`,
      );
    }
  });

  it('keeps each new scene concise, playable, and within documented emotion tags', () => {
    for (const chapter of CHAPTERS.filter(({ id }) => id !== 'lighthouse')) {
      expect(chapter.lines).toHaveLength(4);
      expect(chapter.lines.reduce((sum, line) => sum + line.text.length, 0)).toBeLessThanOrEqual(
        650,
      );
      expect(chapter.lines.every((line) => line.text.length <= 180)).toBe(true);
      expect(new Set(chapter.lines.map((line) => line.actor))).toEqual(
        new Set(['odile', 'rocco', 'pim']),
      );
      expect(
        chapter.lines
          .map((line) => line.actor)
          .some((actor, index, actors) => actors.indexOf(actor) !== index),
      ).toBe(true);
      for (const line of chapter.lines) {
        expect(InlineTagTextSchema.safeParse(line.text).success).toBe(true);
        expect(TagsSchema.safeParse([`emotion:${line.emotion}`]).success).toBe(true);
      }
    }
  });
});
