export type EnemyKind = 'straight' | 'weaver' | 'shooter' | 'debris';
export type ShipId = 'strelka' | 'manta';
export type WeaponKind = 'pulse' | 'lance' | 'scatter';
export type HandlingKind = 'balanced' | 'agile' | 'armored';
export type ReactorKind = 'balanced' | 'rapid' | 'heavy';
export interface ShipLoadout { handling: HandlingKind; reactor: ReactorKind; }
export type PickupKind = 'health' | 'rapid' | 'spread' | 'damage' | 'supercharge' | 'multishot' | 'weapon-pulse' | 'weapon-lance' | 'weapon-scatter' | 'ship-part';
export type FormationKind = 'chevron' | 'arc' | 'pincer' | 'column' | 'line';
export interface Wave { at: number; kind: EnemyKind; formation: FormationKind; count: number; hp: number; speed: number; hold: number; drop?: PickupKind; powerUpDrops?: number; tier?: number; }
export interface Level { id: number; name: string; subtitle: string; briefing: string; color: number; waves: Wave[]; boss?: { name: string; hp: number; kind?: 'warden' | 'twins' | 'carrier' | 'lattice' | 'koschei'; count?: number }; transmissionId?: string; }
export interface Transmission { id: string; sender: string; title: string; frequency: string; text: string; afterLevel: number; }
export interface Preferences { music: boolean; sfx: boolean; reducedMotion: boolean; trainingWheels: boolean; }
export interface Checkpoint { level: number; score: number; hp: number; shipId?: ShipId; loadout?: ShipLoadout; }
export interface SaveData { version: 1; bestScore: number; furthestLevel: number; checkpoint: Checkpoint | null; unlockedTransmissions: string[]; preferences: Preferences; hangar: { selectedShip: ShipId; parts: number; loadouts: Record<ShipId, ShipLoadout> }; }
export interface HudState { level: number; score: number; hp: number; maxHp: number; shipId: ShipId; weapon: WeaponKind; multishot: number; weaponPower: number; effectiveWeaponPower?: number; blastMultiplier: number; shipParts: number; projectiles: number; buffs: Partial<Record<PickupKind, number>>; progress: number; wave: number; waveKind: 'combat' | 'debris' | 'guardian'; totalWaves: number; bossHp?: number; bossMaxHp?: number; bossName?: string; }
export type Outcome = { type: 'complete' | 'defeat'; level: number; score: number; hp: number; maxHp: number; kills: number; };
export type SoundName = 'shoot' | 'hit' | 'explosion' | 'pickup' | 'complete' | 'defeat' | 'click';
export interface CombatCallbacks { onReady: () => void; onHud: (state: HudState) => void; onOutcome: (outcome: Outcome) => void; onPause: () => void; onSound: (sound: SoundName) => void; onNotice: (text: string) => void; onShipPart: () => void; }
