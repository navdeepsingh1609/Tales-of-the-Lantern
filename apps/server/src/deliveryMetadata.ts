import { createHash } from 'node:crypto';
import { DOCUMENTED_TAGS } from '@cut/shared';

type RecordedLine = {
  id: string;
  actor: string;
  text: string;
  voice: string;
  language: string;
  audioUrl: string;
  tags?: string[] | undefined;
};
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const candidates: string[][] = [
  [],
  ...DOCUMENTED_TAGS.map((tag) => [tag]),
  ['emotion:sadness', 'prosody:speed_slow'],
  ['emotion:contentment', 'prosody:speed_slow'],
  ['emotion:determination', 'prosody:expressive_high'],
];

/** Recover old metadata only when the exact cached TTS request hash agrees. */
export function verifiedDeliveryTags(line: RecordedLine): string[] | undefined {
  if (line.tags !== undefined) return line.tags;
  for (const tags of candidates) {
    const audioHash = hash({
      model: 'higgs-tts-3',
      line: line.id,
      text: line.text,
      tags,
      voice: line.voice,
      language: line.language,
    });
    if (line.audioUrl === `/api/performance/media/${audioHash}/audio`) return tags;
  }
  return undefined;
}
