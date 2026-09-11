import type { Level } from '../game/types';

/** Hand-authored sector schedules. Times are seconds; speeds are logical pixels/second. */
export const LEVELS: Level[] = [
  {
    id: 1,
    name: 'PERIMETER DRIFT',
    subtitle: 'MIRNY-7 / OUTER ORBIT',
    briefing: 'Voss, wake the Strelka-9. The perimeter drones are flying an order nobody sent.',
    color: 0x8b77d8,
    transmissionId: 'cold-start',
    waves: [
      { at: 2, kind: 'straight', formation: 'chevron', count: 5, hp: 2, speed: 112, hold: 2.6, drop: 'rapid' },
      { at: 10, kind: 'straight', formation: 'arc', count: 6, hp: 2, speed: 120, hold: 2.2, drop: 'health' },
      { at: 20, kind: 'weaver', formation: 'pincer', count: 4, hp: 2, speed: 115, hold: 2.4, drop: 'spread' },
      { at: 30, kind: 'straight', formation: 'chevron', count: 7, hp: 2, speed: 138, hold: 2.0, drop: 'rapid' },
    ],
  },
  {
    id: 2,
    name: 'DEAD RELAY',
    subtitle: 'TELEMETRY BELT / NODE 06',
    briefing: 'The relay is still transmitting. Follow its carrier through the crossing patrols.',
    color: 0x647fd0,
    waves: [
      { at: 2, kind: 'weaver', formation: 'arc', count: 6, hp: 2, speed: 125, hold: 2.0, drop: 'spread' },
      { at: 10, kind: 'straight', formation: 'column', count: 5, hp: 2, speed: 165, hold: 1.6, drop: 'rapid' },
      { at: 18, kind: 'shooter', formation: 'line', count: 3, hp: 3, speed: 84, hold: 2.8, drop: 'health' },
      { at: 26, kind: 'weaver', formation: 'pincer', count: 6, hp: 2, speed: 148, hold: 1.6, drop: 'spread' },
      { at: 35, kind: 'straight', formation: 'chevron', count: 7, hp: 3, speed: 156, hold: 1.8, drop: 'damage' },
    ],
  },
  {
    id: 3,
    name: 'ARSENAL GRAVEYARD',
    subtitle: 'KOSMOFLOT / RESERVE YARD',
    briefing: 'Sealed weapons crates. Live targeting radars. Someone brought the reserve fleet back.',
    color: 0x9f739f,
    transmissionId: 'voss-echo',
    waves: [
      { at: 2, kind: 'straight', formation: 'chevron', count: 6, hp: 3, speed: 148, hold: 1.7, drop: 'damage' },
      { at: 10, kind: 'shooter', formation: 'arc', count: 4, hp: 4, speed: 90, hold: 2.2, drop: 'rapid' },
      { at: 18, kind: 'weaver', formation: 'pincer', count: 7, hp: 3, speed: 154, hold: 1.4, drop: 'health' },
      { at: 28, kind: 'shooter', formation: 'line', count: 5, hp: 4, speed: 98, hold: 2.0, drop: 'spread' },
      { at: 38, kind: 'straight', formation: 'column', count: 8, hp: 3, speed: 185, hold: 1.4, drop: 'damage' },
    ],
  },
  {
    id: 4,
    name: 'STATIC WALL',
    subtitle: 'EXCLUSION ZONE / NO BEACON',
    briefing: 'The stars end here. Keep moving between the red returns. Trust your instruments.',
    color: 0x9765d7,
    waves: [
      { at: 2, kind: 'weaver', formation: 'pincer', count: 8, hp: 3, speed: 168, hold: 1.5, drop: 'spread' },
      { at: 9, kind: 'shooter', formation: 'chevron', count: 5, hp: 4, speed: 96, hold: 1.8, drop: 'rapid' },
      { at: 17, kind: 'straight', formation: 'column', count: 7, hp: 3, speed: 205, hold: 1.2, drop: 'health' },
      { at: 25, kind: 'weaver', formation: 'arc', count: 8, hp: 3, speed: 175, hold: 1.3, drop: 'damage' },
      { at: 33, kind: 'shooter', formation: 'line', count: 5, hp: 4, speed: 105, hold: 1.8, drop: 'spread' },
      { at: 41, kind: 'straight', formation: 'chevron', count: 8, hp: 4, speed: 190, hold: 1.2, drop: 'health' },
    ],
  },
  {
    id: 5,
    name: 'BLACK ARRAY',
    subtitle: 'ORBITAL DEFENSE / OBJECT 00',
    briefing: 'An abandoned defense platform is answering with your callsign. Disable its core.',
    color: 0xbd647e,
    transmissionId: 'open-channel',
    boss: { name: 'KOSCHEI // DEFENSE ARRAY', hp: 180 },
    waves: [
      { at: 2, kind: 'straight', formation: 'chevron', count: 8, hp: 4, speed: 174, hold: 1.5, drop: 'rapid' },
      { at: 11, kind: 'shooter', formation: 'arc', count: 5, hp: 5, speed: 104, hold: 1.6, drop: 'damage' },
      { at: 21, kind: 'weaver', formation: 'pincer', count: 8, hp: 4, speed: 182, hold: 1.3, drop: 'spread' },
      { at: 34, kind: 'straight', formation: 'line', count: 6, hp: 4, speed: 180, hold: 1.8, drop: 'health' },
    ],
  },
];
