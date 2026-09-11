export type EnemyKind = 'straight' | 'weaver' | 'shooter';
export type PickupKind = 'health' | 'rapid' | 'spread' | 'damage';
export type FormationKind = 'chevron' | 'arc' | 'pincer' | 'column' | 'line';
export interface Wave { at: number; kind: EnemyKind; formation: FormationKind; count: number; hp: number; speed: number; hold: number; drop?: PickupKind; }
export interface Level { id: number; name: string; subtitle: string; briefing: string; color: number; waves: Wave[]; boss?: { name: string; hp: number }; transmissionId?: string; }
export interface Transmission { id: string; sender: string; title: string; frequency: string; text: string; afterLevel: number; }
export interface Preferences { music: boolean; sfx: boolean; reducedMotion: boolean; }
export interface Checkpoint { level: number; score: number; hp: number; }
export interface SaveData { version: 1; bestScore: number; furthestSector: number; checkpoint: Checkpoint | null; unlockedTransmissions: string[]; preferences: Preferences; }
export interface HudState { level: number; score: number; hp: number; maxHp: number; buffs: Partial<Record<PickupKind, number>>; progress: number; wave: number; totalWaves: number; bossHp?: number; bossMaxHp?: number; bossName?: string; }
export type Outcome = { type: 'complete' | 'defeat'; level: number; score: number; hp: number; kills: number; };
export type SoundName = 'shoot' | 'hit' | 'explosion' | 'pickup' | 'complete' | 'defeat' | 'click';
export interface CombatCallbacks { onReady: () => void; onHud: (state: HudState) => void; onOutcome: (outcome: Outcome) => void; onPause: () => void; onSound: (sound: SoundName) => void; onNotice: (text: string) => void; }
