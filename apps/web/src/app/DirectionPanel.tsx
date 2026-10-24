import { useEffect, useState, type CSSProperties } from 'react';
import '../styles/direction-panel.css';

const MOODS = [
  {
    id: 'sadness',
    emoji: '😔',
    label: 'Sadness',
    delivery: 'Slow and reflective',
    tags: ['emotion:sadness', 'prosody:speed_slow'],
  },
  {
    id: 'fear',
    emoji: '😟',
    label: 'Fear',
    delivery: 'Uneasy and alert',
    tags: ['emotion:fear'],
  },
  {
    id: 'whispering',
    emoji: '🤫',
    label: 'Whispering',
    delivery: 'Quiet and close',
    tags: ['style:whispering'],
  },
  {
    id: 'calm',
    emoji: '😌',
    label: 'Calm',
    delivery: 'Steady and unhurried',
    tags: ['emotion:contentment', 'prosody:speed_slow'],
  },
  {
    id: 'relief',
    emoji: '🙂',
    label: 'Relief',
    delivery: 'Warm and reassured',
    tags: ['emotion:relief'],
  },
  {
    id: 'resolve',
    emoji: '🔥',
    label: 'Resolve',
    delivery: 'Firm and expressive',
    tags: ['emotion:determination', 'prosody:expressive_high'],
  },
] as const;

type MoodId = (typeof MOODS)[number]['id'];

type DirectionPanelProps = {
  actorName: string;
  transcript: string;
  lineText: string;
  preparing: boolean;
  comparisonReady: boolean;
  onGenerate: (tags: string[], text: string) => void;
  onAudition: (take: 'original' | 'directed') => void;
};

export function DirectionPanel({
  actorName,
  transcript,
  lineText,
  preparing,
  comparisonReady,
  onGenerate,
  onAudition,
}: DirectionPanelProps) {
  const [selectedMood, setSelectedMood] = useState<MoodId>('resolve');
  const [text, setText] = useState(lineText);
  useEffect(() => setText(lineText), [lineText]);
  const selectedIndex = Math.max(
    0,
    MOODS.findIndex(({ id }) => id === selectedMood),
  );
  const selected = MOODS[selectedIndex]!;

  return (
    <section className="direction-panel" aria-labelledby="direction-title">
      <div className="direction-heading">
        <div>
          <span className="direction-eyebrow">{actorName}</span>
          <h2 id="direction-title">Direct this line</h2>
        </div>
        <p>Choose how to perform the note.</p>
      </div>

      <label className="direction-line-label" htmlFor="direction-spoken-line">
        Spoken line
      </label>
      <textarea
        id="direction-spoken-line"
        className="direction-spoken-line"
        value={text}
        maxLength={220}
        rows={3}
        disabled={preparing}
        onChange={(event) => setText(event.currentTarget.value)}
      />
      {transcript.trim() && (
        <blockquote className="direction-transcript">“{transcript}”</blockquote>
      )}

      <div className="direction-mood" role="group" aria-label="Mood direction">
        <label className="direction-mood-label" htmlFor="direction-mood-range">
          Mood
        </label>
        <input
          id="direction-mood-range"
          className="direction-mood-range"
          type="range"
          min={0}
          max={MOODS.length - 1}
          step={1}
          value={selectedIndex}
          aria-valuetext={`${selected.emoji} ${selected.label}`}
          disabled={preparing}
          style={
            {
              '--mood-position': `${(selectedIndex / (MOODS.length - 1)) * 100}%`,
            } as CSSProperties
          }
          onChange={(event) => {
            const nextMood = MOODS[Number(event.currentTarget.value)];
            if (nextMood) setSelectedMood(nextMood.id);
          }}
        />
        <div className="direction-mood-stops" aria-label="Mood choices">
          {MOODS.map(({ id, emoji, label }) => (
            <button
              className={`direction-mood-stop${selectedMood === id ? ' is-active' : ''}`}
              type="button"
              key={id}
              aria-label={`Set mood ${label}`}
              aria-pressed={selectedMood === id}
              disabled={preparing}
              onClick={() => setSelectedMood(id)}
            >
              <span aria-hidden="true">{emoji}</span>
              <small>{label}</small>
            </button>
          ))}
        </div>
        <div className="direction-mood-caption" aria-live="polite">
          <strong>
            {selected.emoji} {selected.label}
          </strong>
          <span className="direction-mood-tags">{selected.delivery}</span>
        </div>
      </div>

      <div className="direction-actions">
        <button
          className="direction-generate"
          type="button"
          disabled={preparing || text.trim().length < 1 || text.trim().length > 220}
          onClick={() => onGenerate([...selected.tags], text.trim())}
        >
          Prepare new take
        </button>
        {comparisonReady && (
          <div className="direction-auditions" aria-label="Compare takes">
            <button type="button" disabled={preparing} onClick={() => onAudition('original')}>
              Play original
            </button>
            <button type="button" disabled={preparing} onClick={() => onAudition('directed')}>
              Play new take
            </button>
          </div>
        )}
      </div>

      {preparing ? (
        <p className="direction-progress" role="status" aria-live="polite">
          <span className="direction-spinner" aria-hidden="true" />
          Preparing voice and face…
        </p>
      ) : (
        <p className="direction-help">
          Prepares only this line. New takes use credits; replaying saved takes does not.
        </p>
      )}
    </section>
  );
}
