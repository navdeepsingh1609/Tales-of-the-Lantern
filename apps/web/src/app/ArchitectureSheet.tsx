import { useRef } from 'react';
import '../styles/architecture-sheet.css';

const PIPELINE = [
  {
    step: '01',
    title: 'Your voice or text',
    detail: 'A spoken contribution or a typed story turn enters the scene.',
  },
  {
    step: '02',
    title: 'Higgs Realtime',
    detail:
      'Voice activity and transcription help capture the turn; text reasoning drafts the next words. It does not speak the actor’s finished line.',
  },
  {
    step: '03',
    title: 'One-line-ahead story scheduler',
    detail:
      'While a line plays, the scheduler can prepare one next story turn. The first turn still waits for generation.',
  },
  {
    step: '04',
    title: 'Higgs TTS',
    detail: 'The selected words and expressive voice direction become speech audio.',
  },
  {
    step: '05',
    title: 'Higgs Avatar',
    detail: 'The speech audio drives a facial performance video for the speaking character.',
  },
  {
    step: '06',
    title: 'Cached playback',
    detail: 'Prepared audio and video play in the scene and can be replayed from the local cache.',
  },
] as const;

export function ArchitectureSheet() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className="architecture-sheet-trigger"
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        How CUT! works
      </button>
      <dialog
        className="architecture-sheet"
        ref={dialogRef}
        aria-labelledby="architecture-sheet-title"
      >
        <div className="architecture-sheet-inner">
          <header className="architecture-sheet-header">
            <div>
              <p className="architecture-sheet-kicker">Behind the scene</p>
              <h2 id="architecture-sheet-title">How CUT! works</h2>
            </div>
            <button
              className="architecture-sheet-close"
              type="button"
              aria-label="Close How CUT! works"
              onClick={() => dialogRef.current?.close()}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <ol className="architecture-pipeline" aria-label="Story performance pipeline">
            {PIPELINE.map(({ step, title, detail }) => (
              <li key={step}>
                <span className="architecture-step" aria-hidden="true">
                  {step}
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <section className="architecture-retake" aria-labelledby="architecture-retake-title">
            <span aria-hidden="true">↳</span>
            <p>
              <strong id="architecture-retake-title">A director’s note?</strong> Edit the words or
              mood, then TTS and Avatar prepare a one-line retake.
            </p>
          </section>

          <section className="architecture-limits" aria-labelledby="architecture-limits-title">
            <h3 id="architecture-limits-title">What to expect</h3>
            <ul>
              <li>The establishing group view is a still illustration.</li>
              <li>Idle clips add subtle motion; they are not choreographed character animation.</li>
              <li>Realtime function tools remain gated, so turns use text reasoning.</li>
              <li>The first generated performance can take a moment to prepare.</li>
            </ul>
          </section>

          <footer className="architecture-sources" aria-label="Provider documentation">
            <span>Provider docs</span>
            <a
              href="https://docs.boson.ai/models/higgs-realtime/guides/connections-and-sessions"
              target="_blank"
              rel="noopener noreferrer"
            >
              Realtime
            </a>
            <a
              href="https://docs.boson.ai/models/higgs-tts/tags.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              TTS
            </a>
            <a
              href="https://docs.boson.ai/models/higgs-avatar/input-options"
              target="_blank"
              rel="noopener noreferrer"
            >
              Avatar
            </a>
          </footer>
        </div>
      </dialog>
    </>
  );
}
