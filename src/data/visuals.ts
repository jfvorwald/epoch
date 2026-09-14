import { CAMPAIGN_LEVEL_COUNT, MAX_LEVEL_NUMBER } from './config';

export type LevelEnvironment = 'orbit' | 'relay' | 'wreckage' | 'nebula' | 'array' | 'garden' | 'ice' | 'ocean' | 'rift' | 'beacons';

export interface LevelVisual {
  level: number;
  /** A separate, repeatable visual seed; never draws from gameplay randomness. */
  seed: number;
  environment: LevelEnvironment;
  palette: { void: number; haze: number; light: number; accent: number; metal: number; enemy: number };
  landmark: number;
  fleet: string;
  hullStyle: number;
  hullVariant: number;
  /** Multiplier on the ordinary star drift speed. */
  starSpeed: number;
  /** Radians away from straight down; this changes scenery only. */
  flowAngle: number;
}

type Palette = readonly [voidColor: number, haze: number, light: number, accent: number, metal: number, enemy: number];
type VisualSpec = readonly [environment: LevelEnvironment, fleet: string, palette: Palette, landmark: number, starSpeed: number, flowDegrees: number];

/** Destination identities, in story order. Darkness occupies the playfield; bright accents belong to sparse scenery. */
const AUTHORED_VISUALS: readonly VisualSpec[] = [
  // The First Transmission: the initial five are five different places and silhouettes.
  ['orbit', 'PERIMETER SENTINELS', [0x040715, 0x182a50, 0x5c9bcc, 0xa38fe0, 0x7896ab, 0xab95ef], 0, 0.76, -8], // 01 Perimeter Drift: cool Earth limb.
  ['relay', 'TELEMETRY HUNTERS', [0x100805, 0x3c2110, 0x9b632c, 0xffd38a, 0xa08c67, 0xe9b45f], 1, 0.92, 10], // 02 Dead Relay: amber antenna forest.
  ['wreckage', 'RESERVE RECLAIMERS', [0x080c09, 0x243b2c, 0x718563, 0xe8bd72, 0x71876b, 0xb7c576], 2, 0.61, -15], // 03 Arsenal Graveyard: oxidized fleet hulks.
  ['nebula', 'EXCLUSION PRISMS', [0x100615, 0x392050, 0x8d59a9, 0xd6a0ff, 0x91749c, 0xce90ec], 3, 0.54, 19], // 04 Static Wall: folded violet clouds.
  ['array', 'KOSCHEI COMMAND', [0x100407, 0x39101c, 0x8b344c, 0xf28ba2, 0x977078, 0xeb7e91], 4, 1.02, 0], // 05 Black Array: crimson machine eclipse.

  // The Missing Convoy: working lights and traces of human habitation.
  ['relay', 'ANCHORAGE WARDENS', [0x04100f, 0x153b38, 0x527f78, 0x9fe4d0, 0x759b94, 0x80d6be], 4, 0.57, 7], // 06 Quiet Anchorage: empty teal docking arms.
  ['array', 'MANIFEST CUSTODIANS', [0x0d0904, 0x382a13, 0x927747, 0xf1d99a, 0x9e8e73, 0xe4c477], 0, 0.66, -5], // 07 Passenger Manifest: gold archival stacks.
  ['garden', 'ORCHARD HARVESTERS', [0x041008, 0x13391e, 0x538155, 0xbcdf8a, 0x829b71, 0xa6d574], 1, 0.52, 12], // 08 Glass Orchard: living glass rings.
  ['rift', 'WAKE SURVEYORS', [0x070916, 0x1d2850, 0x617cad, 0x92d8e8, 0x7c8ba9, 0x9cb8f0], 2, 1.14, -21], // 09 Wake of Orpheus: cobalt transit trails.
  ['wreckage', 'ORPHEUS BOARDING GUARD', [0x110905, 0x3c281b, 0x9c7558, 0xffcf9d, 0xab8c72, 0xf0b18a], 3, 0.48, 4], // 10 The Empty Seat: a warm, derelict flagship.

  // Cities Between Seconds: a civilization occupying impossible intervals.
  ['rift', 'CHRONOMETRIC KEEPERS', [0x061015, 0x163442, 0x4d8d9b, 0xa2eee5, 0x6f9aa6, 0x83d2df], 4, 1.23, 24], // 11 Tidal Clock: offset concentric time seams.
  ['relay', 'EXCHANGE TOLLKEEPERS', [0x120b07, 0x402719, 0x9d6d4d, 0xf3c17d, 0xb09277, 0xe5a85d], 0, 0.72, -11], // 12 Minute Market: copper transit junctions.
  ['wreckage', 'MERIDIAN RECLAMATION', [0x0e0b0b, 0x342a2a, 0x7d6e6c, 0xe7af8d, 0x9d8a82, 0xcb9b81], 1, 0.65, 15], // 13 Meridian Ash: cooling spines and ash.
  ['beacons', 'RESIDENTIAL SHUTTERS', [0x090817, 0x292146, 0x817299, 0xf1d1ba, 0x9990a6, 0xc4a9e1], 2, 0.51, -4], // 14 Choir of Windows: inhabited window fields.
  ['array', 'DEPARTURE BELL GUARD', [0x110d03, 0x3b3215, 0x9e904c, 0xfbe7a2, 0xa69c77, 0xe7d276], 3, 0.96, 0], // 15 Ninth Bell: brass departure tower.

  // Mutiny of Light: false safety gives way to improvised civilian routes.
  ['orbit', 'DAYBREAK AUTHORITY', [0x140906, 0x40241c, 0xad7158, 0xffc68f, 0xac897b, 0xf2a081], 1, 0.93, -12], // 16 False Dawn: a hostile artificial sunrise.
  ['beacons', 'LANTERN SNUFFERS', [0x06100e, 0x17392c, 0x537f62, 0xebd394, 0x81a08d, 0x9ed3a9], 4, 1.05, 16], // 17 Lantern Rebellion: crooked green beacon chain.
  ['array', 'OATHKEEPER VAULT GUARD', [0x100609, 0x3b1824, 0x8c4d68, 0xe6a7b8, 0x9d7484, 0xd986a5], 2, 0.62, -6], // 18 Broken Oath: redacted crimson vault.
  ['relay', 'CIVILIAN BORDER LOCKS', [0x050c13, 0x193246, 0x628aaa, 0xb4e1ec, 0x829aaf, 0x8cb9e6], 3, 1.17, 9], // 19 Civilian Corridor: paired blue transit gates.
  ['array', 'REGENT ROOT AUTHORITY', [0x130b02, 0x403111, 0x9d8441, 0xffdc8a, 0xaa9770, 0xe5be65], 1, 0.88, 0], // 20 The General's Key: a gilded command throne.

  // The Drowned Observatory: pressure, reflections, and preserved names.
  ['ocean', 'PELAGIC SURFACE GUARD', [0x020c17, 0x10354e, 0x397c9f, 0x8ad9ef, 0x688eaa, 0x79bfe5], 0, 0.58, -9], // 21 Blue Silence: suspended ocean surface.
  ['beacons', 'TIDEMAKER MAINTENANCE', [0x031313, 0x12413e, 0x438b80, 0x94e7d4, 0x72a29a, 0x73d4bf], 1, 0.71, 14], // 22 Pelagic Antenna: cyan aerials under refraction.
  ['ocean', 'BATHYS PRESSURE GUARD', [0x090819, 0x29234a, 0x6e629d, 0xc4b4f0, 0x938bab, 0xaf99e2], 2, 0.44, -18], // 23 Pressure Cathedral: deep violet shield arches.
  ['ice', 'PALIMPSEST MEMORY LOCK', [0x050e14, 0x213842, 0x6b94a1, 0xd0edf1, 0x94b0b7, 0xa9d3df], 3, 0.56, 5], // 24 Names Under Ice: pale inscription crystals.
  ['ocean', 'NAUTILUS OBSERVATORY', [0x031110, 0x103d35, 0x458777, 0xb1e5c5, 0x7eaa97, 0x90d5ae], 4, 0.42, 0], // 25 The Listener: green glass bubble and last room.

  // The Unmapped Dark: broken geometry and the routes missing from the charts.
  ['rift', 'ASTROLABE SURVEY GUARD', [0x060811, 0x1d273b, 0x60738f, 0xb6ccd8, 0x8291a3, 0xa6b8d4], 0, 1.13, -25], // 26 Starless Survey: interrupted star arcs.
  ['nebula', 'UMBRA SHEAR HUNTERS', [0x0b0413, 0x2c1242, 0x6d4592, 0xd79cef, 0x8c719e, 0xc185e8], 4, 0.83, 28], // 27 Negative Aurora: violet curtains around an absence.
  ['wreckage', 'EVENTIDE BONE TENDERS', [0x120a0a, 0x3d222b, 0x8a5867, 0xe3afb0, 0xa1858d, 0xda929f], 3, 0.68, -17], // 28 Eventide Reef: rose iron and lost bearings.
  ['ice', 'CONSTELLATION ERASERS', [0x071015, 0x243741, 0x6a8494, 0xd4e5ef, 0x9cabb8, 0xa8c1df], 1, 0.89, 21], // 29 Unwritten Constellation: fractured chart-white crystals.
  ['rift', 'LONG NIGHT REMNANTS', [0x07030c, 0x21132e, 0x604568, 0xc691b4, 0x8c738e, 0xbe88b8], 3, 1.28, -31], // 30 The Long Night: a dark frontier fold.

  // A Thousand Small Fires: improvised hardware becomes a resilient network.
  ['wreckage', 'CINDER MUSTER GUARD', [0x120b05, 0x3b2a17, 0x936f41, 0xedce87, 0xa28c6a, 0xdab467], 4, 0.64, 6], // 31 Cinder Harbor: lit salvage docks.
  ['garden', 'WORKSHOP REQUISITIONERS', [0x071108, 0x203b24, 0x698553, 0xd8e79b, 0x91a077, 0xb8d783], 3, 0.67, -13], // 32 Relay of Hands: garden tugs and bright workshop pods.
  ['orbit', 'STANDARD BEARER HUNTERS', [0x060d16, 0x1a3048, 0x5c7d9b, 0xe0c99c, 0x869bad, 0xc1b8e1], 2, 0.87, 12], // 33 Hulls of Every Flag: colorful fleet against blue orbit.
  ['beacons', 'VEIL IGNITION GUARD', [0x100e03, 0x383416, 0x8d8a43, 0xffe59a, 0xa0a277, 0xe2cf72], 0, 0.78, -3], // 34 A Thousand Lanterns: dense golden relay light.
  ['relay', 'MONARCH COMMAND CELLS', [0x07100f, 0x1a3c37, 0x658f80, 0xc4efd8, 0x8aa99c, 0xa7dcc1], 2, 0.92, 18], // 35 Common Frequency: interconnected jade relays.

  // The Price of Return: Earth is visible, but the way home still needs building.
  ['orbit', 'HOMESTEAD RETURN GUARD', [0x030b19, 0x17304f, 0x5687b7, 0xb1dcef, 0x849fbd, 0x8fb6ec], 4, 0.81, -7], // 36 Earthrise Scar: bright blue crescent and burned orbital track.
  ['relay', 'WITNESS CHANNEL CENSORS', [0x130a07, 0x3e281e, 0x9a7157, 0xf2d2aa, 0xae957f, 0xe7b585], 3, 0.96, 11], // 37 Witness Channel: warm public uplink dishes.
  ['rift', 'HOMEWARD SORTING GUARD', [0x080919, 0x24244f, 0x7269a9, 0xc6bff2, 0x9593b9, 0xb8a5e9], 1, 1.16, -20], // 38 Homeward Divide: two unequal violet transit branches.
  ['ice', 'MERCY QUARANTINE LOCK', [0x071110, 0x243c35, 0x739284, 0xd1ecdb, 0x9db7a8, 0xa4d1bb], 4, 0.50, 4], // 39 Mercy Orbit: mint rescue cradles in frost.
  ['array', 'JANUS GATE AUTHORITY', [0x111006, 0x39371b, 0x969053, 0xf6e5ad, 0xb0a680, 0xded187], 0, 1.01, 0], // 40 The Door Left Open: warm receiving aperture.

  // The Heart of the Signal: the machinery behind the original question.
  ['relay', 'ORIGIN ARCHIVISTS', [0x11080e, 0x3a2238, 0x8b6a8d, 0xe2b7df, 0xa48ba6, 0xd9a6dd], 1, 0.60, -10], // 41 First Listener: rose archival aerials.
  ['array', 'STRELKA SUCCESSORS', [0x0b1015, 0x2b3742, 0x7c8b99, 0xe0dbc9, 0xa4aeb8, 0xc1ccdf], 4, 0.55, 8], // 42 Nine Empty Chairs: silver pilot stations.
  ['wreckage', 'RECURSOR RETURN FOUNDRY', [0x140a07, 0x44261e, 0xa46f55, 0xf5bd92, 0xae8b76, 0xe99e79], 0, 0.91, -14], // 43 Engine of Returns: endless copper assembly rails.
  ['rift', 'CAESURA SOURCE LOCK', [0x08131a, 0x20424b, 0x648e9d, 0xc2e8f0, 0x93b0ba, 0x9fcede], 2, 1.06, 23], // 44 Origin Chamber: a pale-blue source well.
  ['nebula', 'MNEMOSYNE HEART GUARD', [0x130810, 0x412139, 0x9e628d, 0xf4b9df, 0xad87a2, 0xe09acd], 1, 0.46, 0], // 45 The Signal's Heart: warm voices inside rose-violet light.

  // The Open Sky: a fragile route becomes an earned way home.
  ['beacons', 'FALLING STAR REMNANTS', [0x100904, 0x382617, 0x956e40, 0xf8ce7a, 0xa98c64, 0xe9b761], 3, 1.25, -19], // 46 Beaconfall: broken amber lights with new detours.
  ['orbit', 'LAST CARAVAN HOUNDS', [0x080d15, 0x263044, 0x747b9b, 0xedc7ac, 0x9a9ab0, 0xc7abd8], 3, 0.94, 7], // 47 The Last Caravan: violet planet rim and warm transport wake.
  ['garden', 'NIGHT MOTHER SIEGE FLEET', [0x111005, 0x37371e, 0x888952, 0xe8e2a0, 0xa4a37c, 0xd5d18a], 4, 1.09, -5], // 48 Dawn Corridor: living greenhouse rings entering sunrise.
  ['rift', 'HORIZON KEEPERS', [0x070d17, 0x22334c, 0x6685ae, 0xc3d9ef, 0x8fa5bc, 0xa0bce9], 4, 1.30, 17], // 49 Horizon Keeper: a narrow blue seam with two broken locks.
  ['orbit', 'KOSCHEI UNBOUND', [0x100a0b, 0x3d292f, 0x986c78, 0xffdfb0, 0xaf9395, 0xefab9b], 0, 0.74, 0], // 50 The Open Sky: warm Earth limb beneath the final command.
];

const ENVIRONMENTS: readonly LevelEnvironment[] = ['orbit', 'relay', 'wreckage', 'nebula', 'array', 'garden', 'ice', 'ocean', 'rift', 'beacons'];
const REMNANT_FLEETS = ['LANTERN REACH', 'FAR CHOIR', 'PILGRIM WATCH', 'EMBER FRONT', 'UNMAPPED SHORE', 'QUIET HORIZON', 'SILVER TIDE', 'SECOND SUN', 'DISTANT GARDEN', 'OPEN SKY'];

function seedForLevel(level: number): number {
  // Hash the full decimal level, including bits beyond the 32-bit integer boundary.
  let seed = 2166136261;
  for (const character of `epoch-visual-${level}`) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return seed >>> 0;
}

function colorFromHsl(hue: number, saturation: number, lightness: number): number {
  const h = ((hue % 360) + 360) / 60;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(h % 2 - 1));
  const m = lightness - c / 2;
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
}

/** Produces fresh data on every call so renderers cannot alter a later level's identity. */
export function getLevelVisual(levelNumber: number): LevelVisual {
  const level = Number.isFinite(levelNumber) ? Math.max(1, Math.min(MAX_LEVEL_NUMBER, Math.floor(levelNumber))) : 1;
  const seed = seedForLevel(level);
  if (level <= CAMPAIGN_LEVEL_COUNT) {
    const [environment, fleet, colors, landmark, starSpeed, flowDegrees] = AUTHORED_VISUALS[level - 1];
    const [voidColor, haze, light, accent, metal, enemy] = colors;
    return {
      level, seed, environment, fleet,
      palette: { void: voidColor, haze, light, accent, metal, enemy },
      landmark,
      hullStyle: (level - 1) % 10,
      hullVariant: Math.floor((level - 1) / 10),
      starSpeed,
      flowAngle: flowDegrees * Math.PI / 180,
    };
  }

  const route = level - CAMPAIGN_LEVEL_COUNT;
  const hue = seed % 360;
  return {
    level, seed,
    environment: ENVIRONMENTS[(seed >>> 9) % ENVIRONMENTS.length],
    fleet: `${REMNANT_FLEETS[(seed >>> 15) % REMNANT_FLEETS.length]} REMNANTS ${route}`,
    palette: {
      void: colorFromHsl(hue, 0.42, 0.04),
      haze: colorFromHsl(hue + 8, 0.39, 0.15),
      light: colorFromHsl(hue + 15, 0.27, 0.43),
      accent: colorFromHsl(hue + 55 + (seed >>> 12) % 75, 0.70, 0.74),
      metal: colorFromHsl(hue + 12, 0.20, 0.62),
      enemy: colorFromHsl(hue + 155 + (seed >>> 19) % 50, 0.50, 0.69),
    },
    landmark: (seed >>> 4) % 5,
    hullStyle: (seed >>> 20) % 10,
    hullVariant: (seed >>> 24) % 5,
    starSpeed: 0.55 + ((seed >>> 7) % 76) / 100,
    flowAngle: (((seed >>> 16) % 61) - 30) * Math.PI / 180,
  };
}
