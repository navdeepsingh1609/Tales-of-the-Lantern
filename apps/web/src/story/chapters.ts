import { z } from 'zod';
import { TagSchema } from '@cut/shared';
import lighthouseDialogue from '../../../../content/storyboard/gull-point/dialogue-v1.json';
import tavernDialogue from '../../../../content/storyboard/tavern/dialogue-v1.json';
import observatoryDialogue from '../../../../content/storyboard/observatory/dialogue-v1.json';

export type ChapterId = 'lighthouse' | 'tavern' | 'observatory';

const ChapterLineSchema = z.object({
  actor: z.enum(['odile', 'rocco', 'pim']),
  text: z.string().min(1).max(180),
  emotion: z.string().refine((emotion) => TagSchema.safeParse(`emotion:${emotion}`).success, {
    message: 'Emotion must be a documented emotion tag',
  }),
});

const DialogueSchema = z.object({
  scene: z.enum(['lighthouse', 'tavern', 'observatory']),
  lines: z.array(ChapterLineSchema),
});

export type ChapterLine = z.infer<typeof ChapterLineSchema>;

const lighthouseLines = DialogueSchema.parse(lighthouseDialogue).lines;
const tavernLines = DialogueSchema.parse(tavernDialogue).lines;
const observatoryLines = DialogueSchema.parse(observatoryDialogue).lines;

export interface Chapter {
  id: ChapterId;
  title: string;
  eyebrow: string;
  description: string;
  masterUrl: string;
  previewBase: string;
  lines: ChapterLine[];
  settingLabel: string;
  objective: string;
  stakes: string;
  playerRole: string;
  starters: readonly string[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'lighthouse',
    starters: [
      'Rocco, who sent the letter?',
      'I can carry the spare lantern to the harbour. What is the safest route?',
      'Pim, count the flashes while we guide the boat.',
    ],
    title: 'Gull Point',
    eyebrow: 'The lighthouse',
    settingLabel: 'Lighthouse',
    objective: 'Bring the boat safely into harbour and decide whether to open the letter.',
    stakes: 'The lantern is failing as the storm closes around the rocks.',
    playerRole: 'A traveler sheltering with the keeper; your ideas can help guide the boat.',
    description: 'A letter from the sea arrives as a storm closes in.',
    masterUrl: '/scenes/gull-point/master-v1.png',
    previewBase: '/scenes/gull-point',
    lines: lighthouseLines,
  },
  {
    id: 'tavern',
    starters: [
      'What does the silver coin buy us?',
      'Someone is listening. Who can we trust?',
      'I can help find a guide. What do we know about the north pass?',
    ],
    title: 'The Last Hearth',
    eyebrow: 'A storm-night meeting',
    settingLabel: 'Tavern',
    objective: 'Discover who sent the sealed letter and find a guide through the north pass.',
    stakes: 'The roads close at dawn; the silver coin may be your only safe passage.',
    playerRole: 'A fellow traveler at the table with a clue, a question, or a different plan.',
    description: 'A sealed letter and a silver coin could buy a safe road home.',
    masterUrl: '/scenes/tavern/master-v1.png',
    previewBase: '/scenes/tavern',
    lines: tavernLines,
  },
  {
    id: 'observatory',
    starters: [
      'Pim, what does the star chart tell us?',
      'I can hold the mirror. Where should we send the signal?',
      'Which light in the valley is the way home?',
    ],
    title: 'The Starward Tower',
    eyebrow: 'A signal in the ruins',
    settingLabel: 'Observatory',
    objective: 'Work out the signal and use the brass mirror to contact the valley.',
    stakes: 'The travelers must reach home before their lantern runs out.',
    playerRole: 'A fourth traveler helping interpret the chart and decide where to send the light.',
    description: 'Three travelers try one last lantern signal to reach home.',
    masterUrl: '/scenes/observatory/master-v1.png',
    previewBase: '/scenes/observatory',
    lines: observatoryLines,
  },
];
