export type ActorId = 'odile' | 'rocco' | 'pim';
export type SceneId = 'lighthouse' | 'cyberpunk' | 'noir';

export interface ActorConfig {
  id: ActorId;
  name: string;
  role: string;
  position: [number, number, number];
  baseRotationY: number;
  scale: number;
  accentColor: string;
  clothingColor: string;
  detailColor: string;
}

export const ACTORS_CONFIG: Record<ActorId, ActorConfig> = {
  odile: {
    id: 'odile',
    name: 'Odile',
    role: 'The keeper',
    position: [-1.65, 0, 0.1],
    baseRotationY: 0.48,
    scale: 1,
    accentColor: '#4ea8de',
    clothingColor: '#713b3e', // Naval officer deep blue
    detailColor: '#e0a96d', // Brass buttons/trim
  },
  rocco: {
    id: 'rocco',
    name: 'Rocco',
    role: 'The smuggler',
    position: [0, 0, -1.05],
    baseRotationY: 0,
    scale: 1,
    accentColor: '#ff9f1c',
    clothingColor: '#285b58', // Distressed leather brown
    detailColor: '#c85a17', // Rust / holster accent
  },
  pim: {
    id: 'pim',
    name: 'Pim',
    role: 'The apprentice',
    position: [1.65, 0, 0.1],
    baseRotationY: -0.48,
    scale: 0.96,
    accentColor: '#2ec4b6',
    clothingColor: '#c89b43', // Apprentice charcoal tweed
    detailColor: '#e76f51', // Accent tie / scarf
  },
};

export interface SceneMeta {
  id: SceneId;
  title: string;
  tagline: string;
  primaryLight: string;
  ambientLight: string;
  fogColor: string;
  keywords: string[];
}

export const SCENES_META: Record<SceneId, SceneMeta> = {
  lighthouse: {
    id: 'lighthouse',
    title: 'Keeper’s sitting room',
    tagline: 'Dark storm, revolving sea beacon, crashing waves',
    primaryLight: '#ffd699',
    ambientLight: '#1a2836',
    fogColor: '#0c1521',
    keywords: ['storm', 'glass', 'waves', 'dark', 'barometer', 'thunder', 'rain', 'sea', 'captain'],
  },
  cyberpunk: {
    id: 'cyberpunk',
    title: 'City apartment',
    tagline: 'Reflective wet asphalt, glowing neon signage, steam vents',
    primaryLight: '#00f5d4',
    ambientLight: '#0b0f19',
    fogColor: '#070a14',
    keywords: ['crates', 'smuggler', 'market', 'neon', 'city', 'credits', 'tech', 'fine', 'eleven'],
  },
  noir: {
    id: 'noir',
    title: 'Evening study',
    tagline: 'Warm amber fireplace, slanting venetian blinds, mahogany wood',
    primaryLight: '#ffb703',
    ambientLight: '#2b1b11',
    fogColor: '#160e0a',
    keywords: [
      'quiet',
      'count',
      'whiskey',
      'detective',
      'secret',
      'night',
      'reasons',
      'loud',
      'nobody',
    ],
  },
};
