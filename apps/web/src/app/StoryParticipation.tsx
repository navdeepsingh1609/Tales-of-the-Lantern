import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import '../styles/story-participation.css';
import { StudioIcon } from './StudioIcon';

type StoryParticipationProps = {
  status: 'idle' | 'connecting' | 'listening' | 'thinking' | 'rendering' | 'replying' | 'error';
  level: number;
  sessionActive?: boolean;
  disabled?: boolean;
  canInterrupt?: boolean;
  starters?: readonly string[];
  onReplay?: () => void;
  transcript: string;
  error: string;
  onMic: () => void;
  onTypedTurn: (text: string) => void;
  onCancel: () => void;
};

const BUSY_STATES = ['connecting', 'thinking', 'rendering'] as const;

const statusCopy: Record<StoryParticipationProps['status'], string> = {
  idle: 'Ready when you are.',
  connecting: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  rendering: 'Preparing response…',
  replying: 'The cast is continuing…',
  error: 'Connection needs attention.',
};

export function StoryParticipation({
  status,
  level,
  sessionActive = false,
  disabled = false,
  canInterrupt = false,
  starters = [],
  onReplay,
  transcript,
  error,
  onMic,
  onTypedTurn,
  onCancel,
}: StoryParticipationProps) {
  const [typedText, setTypedText] = useState(transcript.slice(0, 500));
  const writeDisclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => setTypedText(transcript.slice(0, 500)), [transcript]);

  const busy = BUSY_STATES.includes(status as (typeof BUSY_STATES)[number]) && !canInterrupt;
  const isListening = status === 'listening';
  const normalizedLevel = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
  const intensity = 0.12 + normalizedLevel * 0.34;
  const micStyle = {
    '--mic-level': normalizedLevel,
    '--ring-scale-near': 1 + normalizedLevel * 0.12,
    '--ring-scale-mid': 1.16 + normalizedLevel * 0.18,
    '--ring-scale-far': 1.32 + normalizedLevel * 0.25,
    '--ring-opacity-near': intensity,
    '--ring-opacity-mid': intensity * 0.7,
    '--ring-opacity-far': intensity * 0.44,
    '--ember-seed-scale': 0.92 + normalizedLevel * 0.22,
  } as CSSProperties;
  const helper = status === 'error' && error ? error : statusCopy[status];
  const micLabel = isListening ? 'Stop listening' : 'Join the conversation';

  const submitTypedLine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const line = typedText.trim();
    if (!disabled && !busy && !isListening && line) {
      onTypedTurn(line);
      setTypedText('');
      if (writeDisclosure.current) writeDisclosure.current.open = false;
    }
  };

  const selectStarter = (starter: string) => {
    if (disabled || busy || isListening || !starter.trim()) return;
    onTypedTurn(starter);
    if (writeDisclosure.current) writeDisclosure.current.open = false;
  };

  return (
    <div
      className={`story-participation${isListening ? ' is-listening' : ''}`}
      role="group"
      aria-label="Join the conversation"
      aria-busy={busy}
      style={micStyle}
    >
      <div className="story-voice-control">
        <div className="story-ember-wrap">
          <span
            className="story-level-reading"
            role="meter"
            aria-label="Microphone level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(normalizedLevel * 100)}
          />
          <span className="story-ember" aria-hidden="true">
            <i className="story-ember-ring ring-near" />
            <i className="story-ember-ring ring-mid" />
            <i className="story-ember-ring ring-far" />
            <i className="story-ember-seed" />
          </span>
        </div>
        <button
          className="story-join-button"
          type="button"
          aria-label={micLabel}
          title={isListening ? 'Stop listening' : 'Join as the fourth character'}
          aria-describedby="story-participation-status"
          disabled={disabled || busy}
          onClick={onMic}
        >
          <span>{isListening ? 'Stop' : 'Join in'}</span>
        </button>
      </div>

      <span
        className={`story-participation-status${status === 'error' ? ' is-error' : ''}`}
        id="story-participation-status"
        role="status"
        aria-live="polite"
        title={isListening && transcript ? transcript : helper}
      >
        {isListening && transcript ? transcript : helper}
      </span>

      <details className="story-write" ref={writeDisclosure}>
        <summary aria-label="Write a reply" title="Write a reply">
          <StudioIcon name="write" size={18} />
          <span className="story-visually-hidden">Write a reply</span>
        </summary>
        <form className="story-write-popover" onSubmit={submitTypedLine}>
          {starters.length > 0 && (
            <section className="story-starters" aria-label="Conversation starters">
              <h3>Try a line</h3>
              <p>Starts a new cast response</p>
              <div className="story-starter-list">
                {starters.slice(0, 3).map((starter, index) => (
                  <button
                    className="story-starter-button"
                    type="button"
                    key={`${index}-${starter}`}
                    disabled={disabled || busy || isListening}
                    onClick={() => selectStarter(starter)}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </section>
          )}
          <label htmlFor="story-typed-line">Write a reply</label>
          <textarea
            id="story-typed-line"
            value={typedText}
            maxLength={500}
            rows={3}
            disabled={disabled || busy || isListening}
            placeholder="Add a line to the story…"
            onChange={(event) => setTypedText(event.currentTarget.value)}
          />
          <div className="story-write-footer">
            <span aria-live="off">{typedText.length}/500</span>
            <button type="submit" disabled={disabled || busy || isListening || !typedText.trim()}>
              Send
            </button>
          </div>
        </form>
      </details>

      {onReplay && !busy && !isListening && (
        <button
          className="story-icon-control"
          type="button"
          aria-label="Replay reply"
          title="Replay reply"
          onClick={onReplay}
        >
          <StudioIcon name="replay" size={18} />
        </button>
      )}

      {busy && (
        <button
          className="story-icon-control"
          type="button"
          aria-label="Cancel"
          title="Cancel current action"
          onClick={onCancel}
        >
          <StudioIcon name="close" size={18} />
        </button>
      )}
      {sessionActive && !busy && (
        <button
          className="story-icon-control"
          type="button"
          aria-label="End story session"
          title="End story session"
          onClick={onCancel}
        >
          <StudioIcon name="close" size={18} />
        </button>
      )}
    </div>
  );
}
