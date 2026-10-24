import { isDocumentedTag } from '@cut/shared';
import '../styles/delivery-badge.css';

const labels: Record<string, string> = {
  'emotion:determination': 'Resolve',
  'emotion:contemplation': 'Reflective',
  'emotion:contentment': 'Calm',
  'emotion:relief': 'Relief',
  'emotion:fear': 'Fear',
  'emotion:sadness': 'Sadness',
  'style:whispering': 'Whispered',
  'prosody:speed_slow': 'Unhurried',
  'prosody:expressive_high': 'Expressive',
};

export function DeliveryBadge({ tags, text }: { tags?: readonly string[]; text: string }) {
  const inline = [...text.matchAll(/<\|([^|]+)\|>/g)].map((match) => match[1]!);
  const actual = [...new Set([...(tags ?? []), ...inline])].filter(isDocumentedTag);
  if (tags === undefined && !actual.length) return null;
  const label = actual.length
    ? actual
        .map(
          (tag) =>
            labels[tag] ??
            tag
              .split(':')
              .at(-1)!
              .replaceAll('_', ' ')
              .replace(/^\w/, (letter) => letter.toUpperCase()),
        )
        .join(' · ')
    : 'Natural';
  return (
    <details className="delivery-badge">
      <summary aria-label={`Delivery: ${label}`}>{label}</summary>
      <div className="delivery-details">
        <strong>Higgs TTS delivery</strong>
        {actual.length ? (
          actual.map((tag) => <code key={tag}>{`<|${tag}|>`}</code>)
        ) : (
          <small>No added delivery tags.</small>
        )}
        <small>Applied to this recording; a specific facial pose is not guaranteed.</small>
      </div>
    </details>
  );
}
