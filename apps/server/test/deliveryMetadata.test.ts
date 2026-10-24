import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifiedDeliveryTags } from '../src/deliveryMetadata';

const line = {
  id: 'custom-123',
  actor: 'odile',
  text: 'Keep the lantern lit.',
  voice: 'eleanor',
  language: 'en',
};
const recording = (tags: string[]) => {
  const audioHash = createHash('sha256')
    .update(
      JSON.stringify({
        model: 'higgs-tts-3',
        line: line.id,
        text: line.text,
        tags,
        voice: line.voice,
        language: line.language,
      }),
    )
    .digest('hex');
  return { ...line, audioUrl: `/api/performance/media/${audioHash}/audio` };
};
describe('verified delivery metadata', () => {
  it('recovers the exact delivery of an older cached recording using its request hash', () => {
    expect(
      verifiedDeliveryTags(recording(['emotion:determination', 'prosody:expressive_high'])),
    ).toEqual(['emotion:determination', 'prosody:expressive_high']);
    expect(verifiedDeliveryTags(recording([]))).toEqual([]);
  });
  it('does not infer delivery from matching prose when the recording hash disagrees', () => {
    expect(
      verifiedDeliveryTags({ ...recording(['emotion:fear']), text: 'Different words.' }),
    ).toBeUndefined();
    expect(
      verifiedDeliveryTags({ ...line, audioUrl: `/api/performance/media/${'a'.repeat(64)}/audio` }),
    ).toBeUndefined();
  });
});
