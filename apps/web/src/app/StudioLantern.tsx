import { useState, type PointerEvent } from 'react';
import '../styles/studio-lantern.css';

export function StudioLantern() {
  const [lit, setLit] = useState(false);

  const tilt = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    event.currentTarget.style.setProperty(
      '--lantern-tilt-x',
      `${Math.max(-1, Math.min(1, x)) * 5}deg`,
    );
    event.currentTarget.style.setProperty(
      '--lantern-tilt-y',
      `${Math.max(-1, Math.min(1, y)) * -5}deg`,
    );
  };

  const resetTilt = (event: { currentTarget: HTMLButtonElement }) => {
    event.currentTarget.style.setProperty('--lantern-tilt-x', '0deg');
    event.currentTarget.style.setProperty('--lantern-tilt-y', '0deg');
  };

  const label = lit ? 'Dim the lantern' : 'Light the lantern';

  return (
    <button
      className={`studio-lantern-button${lit ? ' is-lit' : ''}`}
      type="button"
      aria-label={label}
      aria-pressed={lit}
      title={label}
      onClick={() => setLit((value) => !value)}
      onPointerMove={tilt}
      onPointerLeave={resetTilt}
      onBlur={resetTilt}
    >
      <svg className="studio-lantern-art" viewBox="0 0 64 92" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="studio-lantern-brass" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#72512c" />
            <stop offset="0.2" stopColor="#edcf86" />
            <stop offset="0.48" stopColor="#aa7938" />
            <stop offset="0.72" stopColor="#f1d594" />
            <stop offset="1" stopColor="#78532b" />
          </linearGradient>
          <linearGradient id="studio-lantern-glass" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff0bd" stopOpacity="0.5" />
            <stop offset="0.15" stopColor="#edc271" stopOpacity="0.12" />
            <stop offset="0.5" stopColor="#edb95e" stopOpacity="0.2" />
            <stop offset="0.82" stopColor="#ffe3a1" stopOpacity="0.08" />
            <stop offset="1" stopColor="#ffe9b0" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="studio-lantern-glass-flare" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="0.34" stopColor="#fff8e8" stopOpacity="0.12" />
            <stop offset="0.68" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.4" />
          </linearGradient>
          <radialGradient id="studio-lantern-flame" cx="50%" cy="67%" r="72%">
            <stop offset="0" stopColor="#fffde8" />
            <stop offset="0.3" stopColor="#ffe58d" />
            <stop offset="0.72" stopColor="#ffad46" />
            <stop offset="1" stopColor="#d96c2d" />
          </radialGradient>
        </defs>
        <path className="lantern-handle" d="M18 25V14C18 7 23.8 3 32 3s14 4 14 11v11" />
        <path
          className="lantern-handle-inner"
          d="M21 24V14c0-5.3 4.2-8.2 11-8.2s11 2.9 11 8.2v10"
        />
        <path
          className="lantern-cap"
          d="M12 29c0-4.8 4.1-8.6 10-10.6 2.6-.9 6.1-1.4 10-1.4s7.4.5 10 1.4C47.9 20.4 52 24.2 52 29l-3.2 4H15.2z"
        />
        <path className="lantern-cap-ridge" d="M13 27.5h38M16.5 22.5h31" />
        <path className="lantern-vent" d="M25 20v3m5-4v3m5-3v3m5-2v3" />
        <path className="lantern-collar" d="M15 32h34l-2.2 4H17.2z" />
        <path
          className="lantern-glass"
          d="M18 35c-4.1 8.6-3.7 22.8.6 32.1 1.7 3.7 6.3 5.5 13.4 5.5s11.7-1.8 13.4-5.5c4.3-9.3 4.7-23.5.6-32.1z"
        />
        <path
          className="lantern-glass-flare"
          d="M20.2 37.5c-2.4 7.2-2.1 18.9.2 26.8 1.4-5.6 1.1-20.7-.2-26.8z"
        />
        <path className="lantern-glass-glint" d="M43.6 39c2.1 6.7 1.7 18.5-.7 24.8" />
        <path
          className="lantern-guardrail"
          d="M17 31c-5 9.2-5.1 26.8-.1 37.8 1.4 3.1 3.9 5.7 7.1 7.7M47 31c5 9.2 5.1 26.8.1 37.8-1.4 3.1-3.9 5.7-7.1 7.7"
        />
        <path
          className="lantern-crosswire"
          d="M16.2 39c10.4 3.5 21.2 3.5 31.6 0M15.8 65.5c10.6 3.4 21.8 3.4 32.4 0"
        />
        <path
          className="lantern-flame"
          d="M32 65c-8.3-6.1-5.7-12.9.8-21 0 5.8 6.7 9.1 4.2 15.7-.8 2.3-2.1 4.1-5 5.3z"
        />
        <path
          className="lantern-flame-core"
          d="M32 61c-3.4-3.4-2.4-7.2.1-10.7.4 3 3 4.8 2.1 8.1-.4 1.2-1.1 2-2.2 2.6z"
        />
        <path className="lantern-wick" d="M31 67h3" />
        <path
          className="lantern-base"
          d="M15.5 70.5c3.5 5.1 9 7.5 16.5 7.5s13-2.4 16.5-7.5l2.2 4.8c-2.7 3.8-6.3 6.2-10.5 7.1H23.8c-4.2-.9-7.8-3.3-10.5-7.1z"
        />
        <path className="lantern-base-ridge" d="M14 76h36M18 81h28" />
        <path className="lantern-foot" d="M22 84h20l-2 3H24z" />
      </svg>
    </button>
  );
}
