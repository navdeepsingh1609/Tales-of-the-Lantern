import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useCastPerformance } from '../performance/useCastPerformance';
import { DirectorMic, type DirectorMicStatus } from '../realtime/DirectorMic';
import type { ActorId } from '../stage/stageTypes';
import { CHAPTERS, type ChapterId } from '../story/chapters';
import { PerformanceReflection } from './PerformanceReflection';
import { CinematicStage } from './CinematicStage';
import { DirectionPanel } from './DirectionPanel';
import { StoryParticipation } from './StoryParticipation';
import { StudioLantern } from './StudioLantern';
import { StudioIcon } from './StudioIcon';
import { DeliveryBadge } from './DeliveryBadge';
import { ArchitectureSheet } from './ArchitectureSheet';
import { useStoryConversation } from '../story/useStoryConversation';
import '../styles/studio.css';

const cast = [
  { id: 'odile' as const, name: 'Odile', role: 'Keeper', voice: 'Eleanor' },
  { id: 'rocco' as const, name: 'Rocco', role: 'Smuggler', voice: 'Jake' },
  { id: 'pim' as const, name: 'Pim', role: 'Apprentice', voice: 'Chloe' },
];
const emotionNames = [
  'neutral',
  'contentment',
  'amusement',
  'whispering',
  'anger',
  'enthusiasm',
  'determination',
  'relief',
  'confusion',
  'longing',
  'fear',
  'sadness',
  'contemplation',
  'interrupted',
] as const;
const DraftSchema = z
  .object({
    scene: z.enum(['lighthouse', 'tavern', 'observatory', 'cyberpunk', 'noir']),
    lines: z
      .array(
        z.object({
          actor: z.enum(['odile', 'rocco', 'pim']),
          text: z.string().trim().min(1).max(220),
          emotion: z.enum(emotionNames),
        }),
      )
      .min(1)
      .max(6),
  })
  .refine((draft) => draft.lines.reduce((sum, line) => sum + line.text.length, 0) <= 1000);
type Draft = z.infer<typeof DraftSchema>;
const clean = (text: string) => text.replace(/<\|.*?\|>/g, '').trim();
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const emotionTags = (emotion: string): string[] =>
  emotion === 'neutral' || emotion === 'interrupted'
    ? []
    : [emotion === 'whispering' ? 'style:whispering' : `emotion:${emotion}`];

export function App() {
  const [interactionMode, setInteractionMode] = useState<'director' | 'story'>('director');
  const [chapterId, setChapterId] = useState<ChapterId>('lighthouse');
  const chapter = CHAPTERS.find((item) => item.id === chapterId)!;
  const [selected, setSelected] = useState<ActorId | null>(null);
  const [held, setHeld] = useState(false);
  const [writerOpen, setWriterOpen] = useState(false);
  const [directOpen, setDirectOpen] = useState(false);
  const performance = useCastPerformance({ sceneId: chapterId });
  const story = useStoryConversation(chapter, performance);
  const {
    cancel: cancelStory,
    attention: storyAttention,
    canContinue,
    continueConversation,
  } = story;
  const castRef = useRef(performance);
  castRef.current = performance;
  const [micStatus, setMicStatus] = useState<DirectorMicStatus>('off');
  const [micMessage, setMicMessage] = useState('');
  const [transcript, setTranscript] = useState('');
  const micRef = useRef<DirectorMic | null>(null);
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState<Draft | null>(() =>
    DraftSchema.parse({ scene: 'lighthouse', lines: CHAPTERS[0]!.lines }),
  );
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [scriptConfigured, setScriptConfigured] = useState<boolean | null>(null);
  const [customPrepared, setCustomPrepared] = useState(false);

  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const preparing = performance.jobStatus === 'preparing';
  const performanceHeld =
    interactionMode === 'story'
      ? !performance.playing && performance.currentLine !== null
      : held ||
        (performance.comparisonReady && !performance.playing && performance.currentLine !== null);
  const actor = performance.currentLine?.actor ?? selected ?? 'odile';
  const active = cast.find((person) => person.id === actor)!;
  const reacting =
    interactionMode === 'story' && (story.status === 'thinking' || story.status === 'rendering');
  const reactionActor =
    story.status === 'rendering'
      ? (cast.find((person) => person.name === story.replyName)?.id ?? actor)
      : cast[(cast.findIndex((person) => person.id === actor) + 1) % cast.length]!.id;

  const micActive = micStatus === 'listening' || micStatus === 'connecting';

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/script/status', { signal: controller.signal })
      .then((response) => response.json())
      .then((data: unknown) => {
        const result = z.object({ configured: z.boolean() }).safeParse(data);
        if (result.success) setScriptConfigured(result.data.configured);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const cut = useCallback(
    (at?: number) => {
      if (!castRef.current.playing) return;
      if (interactionMode === 'story') cancelStory();
      else castRef.current.cut(at);
      setHeld(true);
    },
    [interactionMode, cancelStory],
  );
  const play = useCallback(() => {
    if (interactionMode === 'story' && storyAttention) return;
    setHeld(false);
    if (interactionMode === 'story' && canContinue) continueConversation();
    else castRef.current.roll();
  }, [interactionMode, storyAttention, canContinue, continueConversation]);
  const reset = useCallback(() => {
    cancelStory();
    castRef.current.reset();
    setHeld(false);
    setTranscript('');
  }, [cancelStory]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, [contenteditable]')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (castRef.current.playing) cut();
        else play();
      }
      if (event.key.toLowerCase() === 'r') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cut, play, reset]);
  const startMic = useCallback(async () => {
    if (micRef.current) {
      micRef.current.disconnect();
      micRef.current = null;
      return;
    }
    const mic = new DirectorMic();
    micRef.current = mic;
    setMicMessage('');
    setTranscript('');
    try {
      await mic.connect({
        onStatus: (status, message) => {
          setMicStatus(status);
          setMicMessage(message ?? '');
          if (status === 'off' || status === 'error') micRef.current = null;
        },
        onSpeechStarted: (at) => cut(at),
        onTranscript: setTranscript,
        onEvent: () => undefined,
      });
    } catch {
      setMicMessage('Microphone connection failed. Check permission or the session limit.');
    }
  }, [cut]);
  useEffect(() => () => micRef.current?.disconnect(), []);
  const draftScene = async () => {
    if (drafting || !prompt.trim()) return;
    setDrafting(true);
    setDraftError('');
    try {
      const response = await fetch('/api/script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, scene: chapterId }),
      });
      if (!response.ok) throw new Error('draft');
      const parsed = DraftSchema.safeParse(await response.json());
      if (!parsed.success) throw new Error('draft');
      setDraft(parsed.data);
      setCustomPrepared(false);
    } catch {
      setDraftError('The script could not be drafted. Your current performance is unchanged.');
    } finally {
      setDrafting(false);
    }
  };
  const renderDraft = () => {
    const parsed = DraftSchema.safeParse(draft);
    if (!parsed.success) {
      setDraftError('Use up to six lines, 220 characters per line and 1,000 characters in total.');
      return;
    }
    setHeld(false);
    setCustomPrepared(true);
    void performance.prepareCustom(
      parsed.data.lines.map((line) => ({
        actor: line.actor,
        text: line.text,
        tags: emotionTags(line.emotion),
      })),
      'scene',
      'landscape',
    );
  };
  const selectMode = (mode: 'director' | 'story') => {
    if (mode === interactionMode || preparing) return;
    story.cancel();
    micRef.current?.disconnect();
    micRef.current = null;
    setInteractionMode(mode);
    setHeld(performance.currentLine !== null);
    setTranscript('');
  };
  const selectChapter = (next: ChapterId) => {
    if (next === chapterId || preparing) return;
    const nextChapter = CHAPTERS.find((item) => item.id === next)!;
    story.cancel();
    micRef.current?.disconnect();
    micRef.current = null;
    castRef.current.reset();
    setChapterId(next);
    setHeld(false);
    setDirectOpen(false);
    setSelected(null);
    setPrompt('');
    setTranscript('');
    setDraftError('');
    setCustomPrepared(false);
    setDraft(DraftSchema.parse({ scene: next, lines: nextChapter.lines }));
  };
  const prepareChapter = () => {
    setHeld(false);
    setCustomPrepared(false);
    void performance.prepareCustom(
      chapter.lines.map((line) => ({
        actor: line.actor,
        text: line.text,
        tags: emotionTags(line.emotion),
      })),
      'scene',
      'landscape',
    );
  };
  return (
    <div className="cut-studio">
      <header className="studio-header">
        <a href="#performance" className="studio-wordmark">
          CUT<span>!</span>
        </a>
        <span className="studio-descriptor">Tales of the Lantern</span>
        <StudioLantern />
      </header>
      <main>
        <div className="studio-navigation">
          <nav className="chapter-nav" aria-label="Story chapters">
            {CHAPTERS.map((item, index) => (
              <button
                key={item.id}
                className={`chapter-button ${chapterId === item.id ? 'is-active' : ''}`}
                disabled={preparing}
                aria-current={chapterId === item.id ? 'page' : undefined}
                onClick={() => selectChapter(item.id)}
              >
                <span className="chapter-ordinal">{['I', 'II', 'III'][index]}</span>
                <span className="chapter-copy">{item.settingLabel}</span>
              </button>
            ))}
          </nav>
          <button
            className="write-scene-toggle"
            aria-expanded={writerOpen}
            aria-controls="writing-desk"
            onClick={() => setWriterOpen((value) => !value)}
          >
            <StudioIcon name="write" />
            Write a scene
          </button>
        </div>
        <div id="writing-desk" hidden={!writerOpen}>
          <div className="writing-desk">
            <section className="script-workspace">
              <div className="workspace-heading">
                <div>
                  <span className="section-label">Writing room</span>
                  <h2>Draft a scene</h2>
                  <p>
                    Review this chapter’s draft below, or write a new premise. No media is generated
                    until you prepare the performance.
                  </p>
                </div>
                <span className="workflow-label">Draft → Review → Perform</span>
              </div>
              <label htmlFor="premise">Scene premise</label>
              <div className="draft-input">
                <textarea
                  id="premise"
                  maxLength={500}
                  rows={2}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="A visitor arrives with news the keeper has waited years to hear."
                  disabled={drafting || preparing}
                />
                <button
                  className="secondary-button"
                  disabled={drafting || preparing || !prompt.trim() || scriptConfigured === false}
                  onClick={() => void draftScene()}
                >
                  {drafting ? 'Drafting…' : 'Draft dialogue'}
                </button>
              </div>
              {scriptConfigured === false && (
                <p className="studio-hint">
                  Script drafting is unavailable. Configure the script provider on the local server;
                  saved performances remain available.
                </p>
              )}
              {draftError && (
                <p className="studio-error" role="alert">
                  {draftError}
                </p>
              )}
              {draft && (
                <div className="script-review">
                  <div className="review-heading">
                    <h3>Review dialogue</h3>
                    <span>
                      {draft.lines.length} lines ·{' '}
                      {draft.lines.reduce((sum, line) => sum + line.text.length, 0)} characters
                    </span>
                  </div>
                  {draft.lines.map((line, index) => (
                    <div className="script-line" key={index}>
                      <label htmlFor={`line-${index}`}>
                        {cast.find((person) => person.id === line.actor)?.name}
                        <small>{line.emotion}</small>
                      </label>
                      <textarea
                        id={`line-${index}`}
                        maxLength={220}
                        value={line.text}
                        disabled={preparing}
                        rows={2}
                        onChange={(event) => {
                          const text = event.target.value;
                          setDraft((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  lines: previous.lines.map((item, i) =>
                                    i === index ? { ...item, text } : item,
                                  ),
                                }
                              : null,
                          );
                          setCustomPrepared(false);
                        }}
                      />
                    </div>
                  ))}
                  <div className="render-action">
                    <p>
                      Prepare generates real Higgs voices and facial performances and uses API
                      credits. Play and Retake reuse saved clips.
                    </p>
                    <button
                      className="primary-button"
                      disabled={preparing || performance.playing}
                      onClick={renderDraft}
                    >
                      Prepare performance
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
        <section className="scene-heading">
          <div>
            <span className="activity-label">
              {preparing
                ? 'Preparing the next take'
                : story.status === 'listening'
                  ? 'Listening to you'
                  : performance.playing
                    ? 'The cast is performing'
                    : directOpen
                      ? 'Directing the scene'
                      : 'Ready for the next moment'}
            </span>
            <h1>{customPrepared ? 'A new telling' : chapter.title}</h1>
            <p className="chapter-description">{chapter.description}</p>
          </div>
          <details className="story-brief">
            <summary>Your part</summary>
            <div>
              <p>
                <strong>Your role</strong>
                {chapter.playerRole}
              </p>
              <p>
                <strong>The objective</strong>
                {chapter.objective}
              </p>
              <p>
                <strong>At stake</strong>
                {chapter.stakes}
              </p>
            </div>
          </details>
        </section>
        <div className="story-stage-layout">
          <div className="performance-surround">
            <PerformanceReflection
              video={interactionMode === 'story' && story.attention ? null : performance.video}
              imageUrl={
                interactionMode === 'story' && story.attention
                  ? `${chapter.previewBase}/listening-v1.png`
                  : chapter.masterUrl
              }
              reducedMotion={reducedMotion}
            />
            <section
              id="performance"
              className={`performance-screen ${performanceHeld ? 'is-held' : ''}`}
              aria-label="Conversation performance"
            >
              <CinematicStage
                key={chapterId}
                actor={actor}
                video={performance.video}
                chapter={chapter}
                listening={interactionMode === 'story' && story.attention}
                {...(reacting
                  ? { idleActor: reactionActor }
                  : selected && !performance.currentLine && !performance.playing
                    ? { idleActor: selected }
                    : {})}
                previewActor={selected}
                paused={performanceHeld}
                reducedMotion={reducedMotion}
                hasPerformance={performance.currentLine !== null}
              />
              {interactionMode === 'director' && performanceHeld && (
                <div className="hold-note" role="status">
                  <span>Cut</span>
                  <strong>Holding {active.name}’s line.</strong>
                  <p>{transcript || 'Give your note, then retake the line.'}</p>
                </div>
              )}
              {performance.currentLine && !(interactionMode === 'story' && story.attention) && (
                <div className="scene-subtitle">
                  <span>{active.name}</span>
                  <DeliveryBadge
                    {...(performance.currentLine.tags !== undefined
                      ? { tags: performance.currentLine.tags }
                      : {})}
                    text={performance.currentLine.text}
                  />
                  <p>{clean(performance.currentLine.text)}</p>
                </div>
              )}
              {interactionMode === 'story' && story.attention && story.transcript && (
                <div className="scene-subtitle">
                  <span>You</span>
                  <p>{story.transcript}</p>
                </div>
              )}
            </section>
          </div>
        </div>
        <section className="transport" aria-label="Story playback and interaction">
          <div className="transport-main">
            <button
              className="tool-button tool-play"
              aria-label={
                performance.playing
                  ? 'Cut performance'
                  : interactionMode === 'story' && story.canContinue
                    ? 'Continue story'
                    : performance.clips.length
                      ? 'Play chapter'
                      : 'Prepare chapter'
              }
              title={
                performance.playing
                  ? 'Cut performance · Space'
                  : interactionMode === 'story' && story.canContinue
                    ? 'Continue story · Space'
                    : 'Play chapter · Space'
              }
              disabled={preparing || story.attention}
              onClick={() =>
                performance.playing ? cut() : performance.clips.length ? play() : prepareChapter()
              }
            >
              <StudioIcon name={performance.playing ? 'pause' : 'play'} />
            </button>
            <button
              className="tool-button"
              aria-label="Reset performance"
              title="Reset · R"
              disabled={preparing}
              onClick={reset}
            >
              <StudioIcon name="reset" />
            </button>
            <span className="transport-time">
              {clock(performance.currentTime)} <span>/ {clock(performance.duration)}</span>
            </span>
          </div>
          <span className="toolbar-divider" aria-hidden="true" />
          <button
            className="tool-button tool-labelled"
            title="Direct: rewrite the current line and choose its delivery"
            aria-expanded={directOpen}
            disabled={preparing || !performance.clips.length}
            onClick={() => {
              if (directOpen) {
                setDirectOpen(false);
                return;
              }
              selectMode('director');
              cut();
              if (!performance.currentLine) performance.holdLine(0);
              setHeld(true);
              setDirectOpen(true);
            }}
          >
            <StudioIcon name="direct" />
            <span>Direct</span>
          </button>
          <StoryParticipation
            starters={chapter.starters}
            status={story.status}
            canInterrupt={story.canInterrupt}
            disabled={preparing && interactionMode === 'director'}
            sessionActive={story.sessionActive}
            {...(performance.hasStoryReply
              ? {
                  onReplay: () => {
                    story.cancel();
                    performance.replayStoryReply();
                  },
                }
              : {})}
            level={story.level}
            transcript={story.transcript}
            error={story.error}
            onMic={() => {
              if (preparing) return;
              selectMode('story');
              setDirectOpen(false);
              story.onMic();
            }}
            onTypedTurn={(text) => {
              if (preparing) return;
              selectMode('story');
              setDirectOpen(false);
              story.onTypedTurn(text);
            }}
            onCancel={story.cancel}
          />

          <div className="toolbar-end">
            <button
              className={`tool-button ${micActive ? 'is-active' : ''}`}
              aria-label={micActive ? 'Stop interruption listening' : 'Listen for interruptions'}
              title={micActive ? 'Stop interruption listening' : 'Listen for interruptions'}
              aria-pressed={micActive}
              disabled={preparing || story.attention}
              onClick={() => {
                selectMode('director');
                void startMic();
              }}
            >
              <StudioIcon name="headphones" />
            </button>
            <details className="settings-panel toolbar-settings">
              <summary aria-label="Scene settings" title="Scene settings">
                <StudioIcon name="settings" />
                <span className="sr-only">Scene settings</span>
              </summary>
              <div className="settings-content">
                <label className="motion-setting">
                  <span>Character motion</span>
                  <input
                    type="checkbox"
                    checked={!reducedMotion}
                    onChange={(event) => setReducedMotion(!event.currentTarget.checked)}
                  />
                </label>
                <p className="settings-note">
                  {reducedMotion
                    ? 'Still artwork and reduced transitions. Enable for saved character reactions.'
                    : 'Saved character reactions and gentle transitions. No generation required.'}
                </p>
                <div className="settings-fields">
                  <div className="setting-field">
                    <span id="reference-preview-label">Reference preview</span>
                    <div
                      className="reference-preview-options"
                      role="group"
                      aria-labelledby="reference-preview-label"
                    >
                      {[{ id: null, name: 'Whole scene' }, ...cast].map((option) => (
                        <button
                          key={option.id ?? 'whole-scene'}
                          type="button"
                          className="reference-preview-option"
                          aria-pressed={selected === option.id}
                          disabled={preparing || performance.playing}
                          onClick={() => {
                            if (selected === option.id) return;
                            story.cancel();
                            performance.reset();
                            setHeld(false);
                            setSelected(option.id);
                          }}
                        >
                          {option.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={preparing || performance.playing}
                    onClick={prepareChapter}
                  >
                    Prepare chapter
                  </button>
                </div>
                <p className="settings-note">
                  Preparation uses API credits for missing voices and landscape facial clips. Saved
                  clips are reused. Chapter selection and replay do not generate media.
                </p>
              </div>
            </details>
          </div>
        </section>
        {(micMessage || performance.error) && (
          <p className="studio-error" role="alert">
            {micMessage || performance.error}
          </p>
        )}
        {directOpen && interactionMode === 'director' && performance.currentLine && (
          <DirectionPanel
            actorName={active.name}
            transcript={transcript}
            lineText={clean(performance.currentLine?.text ?? '')}
            preparing={preparing}
            comparisonReady={performance.comparisonReady}
            onGenerate={(tags, text) => {
              story.resetContext();
              setHeld(true);
              void performance.directCurrentLine(tags, text);
            }}
            onAudition={(take) => {
              setHeld(false);
              performance.auditionTake(take);
            }}
          />
        )}
        {preparing && interactionMode === 'director' && (
          <div className="preparation-progress" role="status">
            <span>
              Preparing{' '}
              {performanceHeld ? 'directed take' : customPrepared ? 'new performance' : 'chapter'} ·{' '}
              {performance.progress} lines saved
            </span>
            <progress
              value={performance.progress}
              max={
                customPrepared
                  ? (draft?.lines.length ?? chapter.lines.length)
                  : chapter.lines.length
              }
            />
            <button className="quiet-button" onClick={performance.cancelPreparation}>
              Stop preparation
            </button>
          </div>
        )}
      </main>
      <footer className="studio-footer">
        CUT! · Higgs Audio Hackathon <span>Real facial performances · cached playback</span>
        <ArchitectureSheet />
      </footer>
    </div>
  );
}
