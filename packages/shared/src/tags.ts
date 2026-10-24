import { z } from 'zod';

// These values are taken from docs/03-CHARACTERS-AND-STORY.md and the
// official Higgs TTS tags document: https://docs.boson.ai/models/higgs-tts/tags.md
export const DOCUMENTED_TAGS = [
  'emotion:elation',
  'emotion:amusement',
  'emotion:enthusiasm',
  'emotion:determination',
  'emotion:pride',
  'emotion:contentment',
  'emotion:affection',
  'emotion:relief',
  'emotion:contemplation',
  'emotion:confusion',
  'emotion:surprise',
  'emotion:awe',
  'emotion:longing',
  'emotion:arousal',
  'emotion:anger',
  'emotion:fear',
  'emotion:disgust',
  'emotion:bitterness',
  'emotion:sadness',
  'emotion:shame',
  'emotion:helplessness',
  'style:singing',
  'style:shouting',
  'style:whispering',
  'sfx:cough',
  'sfx:laughter',
  'sfx:crying',
  'sfx:screaming',
  'sfx:burping',
  'sfx:humming',
  'sfx:sigh',
  'sfx:sniff',
  'sfx:sneeze',
  'prosody:speed_very_slow',
  'prosody:speed_slow',
  'prosody:speed_fast',
  'prosody:speed_very_fast',
  'prosody:pitch_low',
  'prosody:pitch_high',
  'prosody:pause',
  'prosody:long_pause',
  'prosody:expressive_high',
  'prosody:expressive_low',
  'reset',
] as const;

export type DocumentedTag = (typeof DOCUMENTED_TAGS)[number];
export const TagSchema = z.enum(DOCUMENTED_TAGS);
const tagSet: ReadonlySet<string> = new Set(DOCUMENTED_TAGS);

/** Validate an internal tag name such as `emotion:sadness` (without wrappers). */
export function isDocumentedTag(value: string): value is DocumentedTag {
  return tagSet.has(value);
}

export const TagsSchema = z.array(TagSchema);

/** Validates inline Higgs tokens embedded in authored text, when present. */
export const InlineTagTextSchema = z.string().superRefine((text, ctx) => {
  // Every opener and closer must belong to a complete token. This catches
  // misspelled, incomplete, and stray delimiters instead of accepting them as prose.
  const withoutTokens = text.replace(/<\|[^|]*\|>/g, '');
  if (withoutTokens.includes('<|') || withoutTokens.includes('|>')) {
    ctx.addIssue({ code: 'custom', message: 'Malformed inline tag delimiter', path: [] });
  }
  for (const match of text.matchAll(/<\|([^|]*)\|>/g)) {
    const token = match[1];
    if (token === undefined || !isDocumentedTag(token)) {
      ctx.addIssue({ code: 'custom', message: `Unknown inline tag: ${token}`, path: [] });
    }
  }
});
