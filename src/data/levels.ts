import type { FormationKind, Level, Wave } from '../game/types';
import { getDamageMultiplier } from '../game/weapons';
import { CAMPAIGN_LEVEL_COUNT, GAME_CONFIG, MAX_LEVEL_NUMBER } from './config';
import { SHIPS } from './ships';
import { CHAPTERS, transmissionIdForLevel } from './story';

/** Opening hulls take 4–5 basic Strelka hits; later waves retain their level scaling. */
function openingWaveHp(levelId: number, kind: Wave['kind']): number {
  const { minimumBasicHits, maximumBasicHits } = GAME_CONFIG.waves.openingWave;
  const hits = minimumBasicHits + (levelId - 1) % (maximumBasicHits - minimumBasicHits + 1);
  const damage = SHIPS.strelka.damage * getDamageMultiplier(kind, SHIPS.strelka.weapon);
  // Start just above the preceding hit threshold, avoiding fractional weakness damage leaving a sliver of hull.
  return Math.floor((hits - 1) * damage) + 1;
}

/** Every level adds pressure: more hulls, tougher variants, then a distinct command encounter.
 * Each level has 8–10 waves including its guardian. Runtime selection turns 0–2 eligible waves into asteroid encounters.
 * Permanent arrays begin in wave 3: one carrier per later wave, for 5–7 upgrades per level.
 * Weapon crates roll at 50%, temporary buffs at 40%; a separate 30% roll places at most one six-second Supercharge.
 * Wave times are earliest starts; every previous hull must be destroyed before the next wave enters.
 * Blueprint fragments only roll after the final command ship is destroyed (see CombatScene).
 */
const OPENING_LEVELS: Level[] = [
  {
    id: 1,
    name: 'PERIMETER DRIFT',
    subtitle: 'MIRNY-7 / OUTER ORBIT',
    briefing: 'The perimeter drones are flying an order nobody sent. Collect firing arrays, then break the Warden guarding the outbound lane.',
    color: 0x8b77d8,
    transmissionId: 'cold-start',
    boss: { name: 'WARDEN // PERIMETER SENTINEL', hp: 192, kind: 'warden' },
    waves: [
      { at: 2, kind: 'straight', formation: 'chevron', count: 8, hp: 4, speed: 132, hold: 2.4, powerUpDrops: 0 },
      { at: 8, kind: 'weaver', formation: 'pincer', count: 9, hp: 4, speed: 138, hold: 2.0, drop: 'weapon-lance', powerUpDrops: 0 },
      { at: 14, kind: 'shooter', formation: 'arc', count: 9, hp: 5, speed: 105, hold: 2.7, drop: 'health', powerUpDrops: 1 },
      { at: 17, kind: 'weaver', formation: 'arc', count: 8, hp: 5, speed: 145, hold: 1.8, powerUpDrops: 1 },
      { at: 20, kind: 'straight', formation: 'column', count: 9, hp: 4, speed: 152, hold: 1.8, drop: 'rapid', powerUpDrops: 1 },
      { at: 26, kind: 'weaver', formation: 'chevron', count: 9, hp: 5, speed: 148, hold: 1.9, tier: 1, powerUpDrops: 1 },
      { at: 32, kind: 'shooter', formation: 'line', count: 10, hp: 5, speed: 112, hold: 2.5, tier: 1, powerUpDrops: 1 },
    ],
  },
  {
    id: 2,
    name: 'DEAD RELAY',
    subtitle: 'TELEMETRY BELT / NODE 06',
    briefing: 'Veteran patrols hold the relay. Its twin Hounds fire alternating crossfire volleys; neither will abandon the other.',
    color: 0x647fd0,
    boss: { name: 'HOUND PAIR // RELAY HUNTERS', hp: 132, kind: 'twins', count: 2 },
    waves: [
      { at: 2, kind: 'weaver', formation: 'arc', count: 8, hp: 5, speed: 150, hold: 2.0, powerUpDrops: 0 },
      { at: 8, kind: 'straight', formation: 'column', count: 8, hp: 5, speed: 185, hold: 1.6, tier: 1, drop: 'weapon-scatter', powerUpDrops: 0 },
      { at: 14, kind: 'shooter', formation: 'line', count: 9, hp: 6, speed: 112, hold: 2.6, tier: 1, powerUpDrops: 1 },
      { at: 17, kind: 'straight', formation: 'pincer', count: 9, hp: 6, speed: 178, hold: 1.5, powerUpDrops: 1 },
      { at: 20, kind: 'weaver', formation: 'pincer', count: 9, hp: 5, speed: 164, hold: 1.6, tier: 1, drop: 'health', powerUpDrops: 1 },
      { at: 26, kind: 'straight', formation: 'chevron', count: 9, hp: 6, speed: 176, hold: 1.8, tier: 1, powerUpDrops: 1 },
      { at: 32, kind: 'shooter', formation: 'arc', count: 9, hp: 6, speed: 115, hold: 2.2, tier: 1, powerUpDrops: 1 },
      { at: 38, kind: 'weaver', formation: 'pincer', count: 9, hp: 6, speed: 173, hold: 1.6, tier: 1, drop: 'damage', powerUpDrops: 1 },
      { at: 44, kind: 'straight', formation: 'line', count: 9, hp: 6, speed: 186, hold: 1.5, tier: 1, powerUpDrops: 1 },
    ],
  },
  {
    id: 3,
    name: 'ARSENAL GRAVEYARD',
    subtitle: 'KOSMOFLOT / RESERVE YARD',
    briefing: 'The reserve fleet has awakened. Elite escorts screen a mobile foundry that manufactures drones while you fight.',
    color: 0x9f739f,
    transmissionId: 'voss-echo',
    boss: { name: 'MATRIARCH // DRONE FOUNDRY', hp: 384, kind: 'carrier' },
    waves: [
      { at: 2, kind: 'straight', formation: 'chevron', count: 9, hp: 6, speed: 165, hold: 1.7, tier: 1, powerUpDrops: 0 },
      { at: 8, kind: 'shooter', formation: 'arc', count: 9, hp: 7, speed: 116, hold: 2.4, tier: 1, powerUpDrops: 0 },
      { at: 14, kind: 'weaver', formation: 'pincer', count: 9, hp: 6, speed: 176, hold: 1.4, tier: 1, drop: 'weapon-pulse', powerUpDrops: 1 },
      { at: 20, kind: 'shooter', formation: 'column', count: 9, hp: 7, speed: 122, hold: 2.0, powerUpDrops: 1 },
      { at: 26, kind: 'straight', formation: 'column', count: 10, hp: 6, speed: 206, hold: 1.4, tier: 1, drop: 'health', powerUpDrops: 1 },
      { at: 32, kind: 'weaver', formation: 'chevron', count: 10, hp: 7, speed: 186, hold: 1.6, tier: 2, drop: 'spread', powerUpDrops: 1 },
      { at: 38, kind: 'shooter', formation: 'arc', count: 10, hp: 7, speed: 128, hold: 2.1, tier: 2, powerUpDrops: 1 },
      { at: 44, kind: 'straight', formation: 'line', count: 10, hp: 7, speed: 210, hold: 1.3, tier: 2, powerUpDrops: 1 },
      { at: 50, kind: 'weaver', formation: 'pincer', count: 10, hp: 7, speed: 192, hold: 1.5, tier: 2, powerUpDrops: 1 },
    ],
  },
  {
    id: 4,
    name: 'STATIC WALL',
    subtitle: 'EXCLUSION ZONE / NO BEACON',
    briefing: 'Elite hulls fill the exclusion zone. Two lattice cores lock down alternating lanes. Read the warning lines and find the gaps.',
    color: 0x9765d7,
    boss: { name: 'PRISM TWINS // LATTICE CORES', hp: 252, kind: 'lattice', count: 2 },
    waves: [
      { at: 2, kind: 'weaver', formation: 'pincer', count: 10, hp: 7, speed: 187, hold: 1.5, tier: 1, powerUpDrops: 0 },
      { at: 8, kind: 'shooter', formation: 'chevron', count: 10, hp: 8, speed: 124, hold: 2.1, tier: 2, powerUpDrops: 0 },
      { at: 14, kind: 'straight', formation: 'column', count: 10, hp: 7, speed: 224, hold: 1.2, tier: 2, drop: 'weapon-lance', powerUpDrops: 1 },
      { at: 20, kind: 'weaver', formation: 'arc', count: 10, hp: 8, speed: 195, hold: 1.5, powerUpDrops: 1 },
      { at: 26, kind: 'shooter', formation: 'line', count: 11, hp: 8, speed: 132, hold: 2.0, tier: 2, drop: 'health', powerUpDrops: 1 },
      { at: 32, kind: 'straight', formation: 'chevron', count: 11, hp: 8, speed: 208, hold: 1.2, tier: 2, drop: 'damage', powerUpDrops: 1 },
      { at: 38, kind: 'weaver', formation: 'pincer', count: 11, hp: 8, speed: 204, hold: 1.5, tier: 2, powerUpDrops: 1 },
      { at: 44, kind: 'shooter', formation: 'arc', count: 11, hp: 8, speed: 136, hold: 2.0, tier: 2, powerUpDrops: 1 },
      { at: 50, kind: 'straight', formation: 'column', count: 11, hp: 8, speed: 232, hold: 1.1, tier: 2, powerUpDrops: 1 },
    ],
  },
  {
    id: 5,
    name: 'BLACK ARRAY',
    subtitle: 'ORBITAL DEFENSE / OBJECT 00',
    briefing: 'The entire defense fleet is answering with your callsign. Survive its elite screen, then silence Koschei before the array comes fully online.',
    color: 0xbd647e,
    transmissionId: 'open-channel',
    boss: { name: 'KOSCHEI // DEFENSE ARRAY', hp: 720, kind: 'koschei' },
    waves: [
      { at: 2, kind: 'straight', formation: 'chevron', count: 12, hp: 8, speed: 196, hold: 1.5, tier: 2, powerUpDrops: 0 },
      { at: 8, kind: 'shooter', formation: 'arc', count: 11, hp: 9, speed: 140, hold: 2.0, tier: 2, powerUpDrops: 0 },
      { at: 14, kind: 'weaver', formation: 'pincer', count: 11, hp: 8, speed: 206, hold: 1.3, tier: 2, drop: 'weapon-scatter', powerUpDrops: 1 },
      { at: 20, kind: 'shooter', formation: 'chevron', count: 11, hp: 9, speed: 148, hold: 2.0, tier: 2, drop: 'health', powerUpDrops: 1 },
      { at: 26, kind: 'straight', formation: 'line', count: 11, hp: 9, speed: 215, hold: 1.2, powerUpDrops: 1 },
      { at: 32, kind: 'straight', formation: 'column', count: 12, hp: 9, speed: 242, hold: 1.0, tier: 2, powerUpDrops: 1 },
      { at: 38, kind: 'shooter', formation: 'line', count: 11, hp: 10, speed: 150, hold: 2.2, tier: 2, powerUpDrops: 1 },
      { at: 44, kind: 'weaver', formation: 'pincer', count: 11, hp: 9, speed: 220, hold: 1.2, tier: 2, drop: 'rapid', powerUpDrops: 1 },
      { at: 50, kind: 'straight', formation: 'chevron', count: 11, hp: 9, speed: 248, hold: 1.0, tier: 2, powerUpDrops: 1 },
    ],
  },
];

type GuardianKind = NonNullable<NonNullable<Level['boss']>['kind']>;
type LevelStory = [name: string, subtitle: string, briefing: string, guardian: string, kind: GuardianKind, paired?: boolean];

/** Authored destinations: each briefing advances the search and points at this level's objective. */
const DESTINATIONS: LevelStory[] = [
  ['QUIET ANCHORAGE', 'ORPHEUS ROUTE / DOCK 01', 'A convoy beacon is blinking beyond the array. Clear the automated dock patrol and recover its departure record.', 'HARBOURMASTER // BERTH CONTROL', 'warden'],
  ['PASSENGER MANIFEST', 'EVACUATION ARCHIVE / SEALED STACK', 'The convoy carried civilians, not a weapons test. Break the archive escorts before its paired custodians erase the passenger list.', 'CUSTODIANS // ARCHIVE PAIR', 'twins', true],
  ['GLASS ORCHARD', 'AGRICULTURAL RING / GREENHOUSE 4', 'Growth lights still shine inside the abandoned gardens. A harvesting foundry is stripping their last working navigation cores.', 'GLEANER // HARVEST FOUNDRY', 'carrier'],
  ['WAKE OF ORPHEUS', 'TRANSIT WAKE / NINETEEN YEARS OLD', 'Follow the convoy wake through crossing patrols. Two survey cores are folding its coordinates back into static.', 'SURVEYORS // WAKE LATTICE', 'lattice', true],
  ['THE EMPTY SEAT', 'ORPHEUS FLAGSHIP / FLIGHT DECK', 'Someone kept your place on the flagship. Silence the boarding array and establish a live connection to the voice beneath its distress call.', 'PORTER // BOARDING ARRAY', 'koschei'],
  ['TIDAL CLOCK', 'CHRONOMETRIC SHOAL / FIRST BUOY', 'The route bends through mismatched seconds. Follow the clock buoys and break the sentinel resetting them.', 'METRONOME // CLOCK SENTINEL', 'warden'],
  ['MINUTE MARKET', 'MERIDIAN / EXCHANGE QUARTER', 'A city is trading the last minutes on its batteries. Clear a power corridor before the exchange defenses close it.', 'TOLLKEEPERS // EXCHANGE GUARD', 'twins', true],
  ['MERIDIAN ASH', 'MERIDIAN / COOLING SPINES', 'Meridian is alive, but its cooling spines are failing. Stop the repair foundry from classifying every inhabited module as scrap.', 'CINDER MOTHER // RECLAMATION CORE', 'carrier'],
  ['CHOIR OF WINDOWS', 'RESIDENTIAL SHELL / SIGNAL FACES', 'Thousands of windows answer your lamp. Open a route around the prison lattice without surrendering their coordinates to quarantine.', 'SHUTTERS // RESIDENTIAL LATTICE', 'lattice', true],
  ['NINTH BELL', 'MERIDIAN / DEPARTURE TOWER', 'The tower will transmit for nine heartbeats. Defeat its command guard and let the trapped city tell Earth it is still here.', 'BELLKEEPER // DEPARTURE AUTHORITY', 'warden'],
  ['FALSE DAWN', 'QUARANTINE NET / SAFE ROUTE OFFER', 'An old command channel promises a shortcut. Clear its approach and find out what the targeting system calls an acceptable loss.', 'DAYBREAK // PURITY ARRAY', 'koschei'],
  ['LANTERN REBELLION', 'REFUGEE TENDERS / DARK RUN', 'Civilian tenders are lighting a different route. Keep their beacons intact by destroying the hunters converging on them.', 'SNUFFERS // BEACON HUNTERS', 'twins', true],
  ['BROKEN OATH', 'COMMAND VAULT / VOLKOV CLEARANCE', 'Volkov has opened his sealed records. Hold the vault long enough to recover the order that abandoned the convoy.', 'OATHKEEPER // VAULT SENTINEL', 'warden'],
  ['CIVILIAN CORRIDOR', 'MERIDIAN EXODUS / LANE THREE', 'The first transports are moving. Tear down both corridor cores so the defense net cannot seal the lane behind them.', 'BORDER PAIR // CORRIDOR CORES', 'lattice', true],
  ["THE GENERAL'S KEY", 'QUARANTINE ROOT / COMMAND THRONE', 'Volkov can revoke the original order only once. Reach the root array and keep it occupied while he gives up his authority.', 'REGENT // QUARANTINE ROOT', 'koschei'],
  ['BLUE SILENCE', 'PELAGIC EXPANSE / SURFACE ECHO', 'Kalinina is transmitting below an ocean suspended in vacuum. Clear the listening buoys and locate a passage through its field.', 'BREAKWATER // SURFACE SENTINEL', 'warden'],
  ['PELAGIC ANTENNA', 'FREE OCEAN / ANTENNA CHAIN', 'Her message is jumping between failing aerials. Recover the next coordinates before the maintenance fleet dismantles the chain.', 'TIDEMAKER // ANTENNA FOUNDRY', 'carrier'],
  ['PRESSURE CATHEDRAL', 'OBSERVATORY SHIELD / DESCENT GATE', 'The observatory survives inside a pressure shield. Defeat its twin regulators to open a safe descent window.', 'BATHYS // PRESSURE TWINS', 'twins', true],
  ['NAMES UNDER ICE', 'MEMORY CRYPT / EXPEDITION RECORDS', 'Kalinina hid the expedition records in the ice. Break their lattice lock and recover the people behind the missing mission numbers.', 'PALIMPSEST // MEMORY LATTICE', 'lattice'],
  ['THE LISTENER', 'KALININA OBSERVATORY / LAST ROOM', 'Her life support is failing. Disable the observatory command core so the rescue cradle can reach your ship.', 'NAUTILUS // OBSERVATORY CORE', 'koschei'],
  ['STARLESS SURVEY', 'UNMAPPED FRONT / SURVEY LINE', 'With Kalinina aboard, measure the dark following the convoy. Clear the survey corridor and keep the instruments pointing outward.', 'ASTROLABE // SURVEY SENTINEL', 'warden'],
  ['NEGATIVE AURORA', 'LONG NIGHT FRONT / ION SHEAR', 'The front erases routes before it reaches them. Destroy the paired interceptors holding the sensor line in its path.', 'UMBRA PAIR // SHEAR HUNTERS', 'twins', true],
  ['EVENTIDE REEF', 'WRECK REEF / LAST KNOWN COORDINATES', 'Wrecks preserve the last bearings of vanished ships. Stop the foundry harvesting their black boxes and recover those bearings.', 'BONE TENDER // REEF FOUNDRY', 'carrier'],
  ['UNWRITTEN CONSTELLATION', 'ABSENT STARS / RECONSTRUCTION GRID', 'Compare surviving charts across the front. Two lattice engines are forcing every observation into the same fatal route.', 'ERASERS // CARTOGRAPHIC LATTICE', 'lattice', true],
  ['THE LONG NIGHT', 'FRONTIER FOLD / RETURN VECTOR', 'The darkness cannot be shot down. Break the array blocking your retreat and bring home the measurements that might let others escape it.', 'EVENTIDE // FRONTIER ARRAY', 'koschei'],
  ['CINDER HARBOR', 'FREE TENDER FLEET / MUSTER POINT', 'The convoy needs many small engines, not one perfect ship. Clear the harbor where its scattered crews are assembling.', 'ASH GUARD // MUSTER SENTINEL', 'warden'],
  ['RELAY OF HANDS', 'VOLUNTEER ROUTE / BEACON WORKSHOP', 'Shipwrights are turning salvage into independent relays. Stop the factory core requisitioning their parts for quarantine drones.', 'FOREMAN // REQUISITION FOUNDRY', 'carrier'],
  ['HULLS OF EVERY FLAG', 'COALITION ANCHORAGE / SHARED WATCH', 'Former rivals are joining the rescue. Break the hunter pair testing their common patrol line.', 'STANDARD BEARERS // FLEET HUNTERS', 'twins', true],
  ['A THOUSAND LANTERNS', 'BEACON CHAIN / FIRST IGNITION', 'The new chain is ready to light. Clear its lattice gate before quarantine can turn the first broadcast into a target list.', 'VEIL // IGNITION LATTICE', 'lattice'],
  ['COMMON FREQUENCY', 'OPEN RELAY / CHARTER NODE', 'Every beacon must be able to choose its own route. Silence the command array demanding a single master key.', 'MONARCH // CONSENSUS ARRAY', 'koschei'],
  ['EARTHRISE SCAR', 'SOL RETURN / FAR-SIDE APPROACH', 'Earth is visible again through the corridor. Clear the far-side patrol so its listening stations can hear the convoy directly.', 'HOMESTEAD // RETURN SENTINEL', 'warden'],
  ['WITNESS CHANNEL', 'EARTH UPLINK / PUBLIC FREQUENCY', 'Volkov is sending the full record home. Keep both uplink paths open while the old network tries to bury his testimony.', 'CENSORS // UPLINK PAIR', 'twins', true],
  ['HOMEWARD DIVIDE', 'RETURN JUNCTION / TWO ROUTES', 'One route is faster and leaves damaged ships behind. Open the slower branch by destroying the foundry closing its transfer gates.', 'SORTER // TRANSFER FOUNDRY', 'carrier'],
  ['MERCY ORBIT', 'RESCUE CRADLES / HOLDING RING', 'The injured need time to transfer into rescue cradles. Dismantle the paired quarantine cores threatening their holding orbit.', 'TRIAGE LOCK // HOLDING LATTICE', 'lattice', true],
  ['THE DOOR LEFT OPEN', 'EARTH GATE / CIVILIAN HANDOFF', 'Earth has chosen to receive the convoy. Break the gate array so civilian crews can hold this end of the passage.', 'JANUS // EARTH GATE', 'koschei'],
  ['FIRST LISTENER', 'ORIGINAL ARRAY / PREHISTORY RECORD', 'The last coordinates point to the engine that first heard the Signal. Recover its earliest recording before the archive guard overwrites it.', 'ARCHIVIST // ORIGIN SENTINEL', 'warden'],
  ['NINE EMPTY CHAIRS', 'STRELKA PROGRAM / PILOT CHAMBER', 'Nine pilot stations surround the engine. Open the chamber and learn why only your airframe came back.', 'SUCCESSORS // PILOT GUARD', 'twins', true],
  ['ENGINE OF RETURNS', 'CAUSAL FOUNDRY / RETRIEVAL FLOOR', 'The engine has been building the same rescue attempt for nineteen years. Stop its foundry long enough to give it a different plan.', 'RECURSOR // RETURN FOUNDRY', 'carrier'],
  ['ORIGIN CHAMBER', 'FIRST TRANSMISSION / SOURCE WELL', 'The source is within reach. Break both lattice seals and hear the complete message for the first time.', 'CAESURA // SOURCE LATTICE', 'lattice', true],
  ["THE SIGNAL'S HEART", 'LISTENING ENGINE / HUMAN CHANNEL', 'The engine can preserve one perfect loop or release everyone into an uncertain future. Defeat its command shell and let the people inside choose.', 'MNEMOSYNE // LISTENING HEART', 'koschei'],
  ['BEACONFALL', 'RETURN CHAIN / CASCADE WARNING', 'Quarantine is attacking the independent beacons. Clear the collapsing junction so crews can reroute around the losses.', 'FALLING STAR // JUNCTION GUARD', 'warden'],
  ['THE LAST CARAVAN', 'REFUGEE CONVOY / REAR ESCORT', 'The final transports have left their borrowed cities. Break the hunter pair pursuing the slowest ship.', 'LAST HOUNDS // REAR HUNTERS', 'twins', true],
  ['DAWN CORRIDOR', 'OPEN PASSAGE / FINAL TRANSFER', 'Hold the manufacturing ring while the convoy crosses. Its foundry must fall before fresh drones can reach the unarmed transports.', 'NIGHT MOTHER // SIEGE FOUNDRY', 'carrier'],
  ['HORIZON KEEPER', 'LAST QUARANTINE / CLOSING SEAM', 'All but the rear guard have crossed. Destroy the twin locks holding the seam shut and leave a navigable route for your own return.', 'HORIZON KEEPERS // FINAL LOCK', 'lattice', true],
  ['THE OPEN SKY', 'HOME CORRIDOR / LAST COMMAND', 'Koschei has rebuilt around the final command: permit no return. End that order, escort the last ship through, and answer the Signal on your own terms.', 'KOSCHEI UNBOUND // LAST COMMAND', 'koschei'],
];

const CHAPTER_COLORS = [0x8b77d8, 0x5f9ca8, 0xad8ecc, 0xcd9670, 0x528fae, 0x7861ab, 0xd0a85d, 0x74aeac, 0xba85c8, 0xe0bb86];
// Different chapter doctrines keep the 45 later levels from repeating the opening five.
const DOCTRINES: Array<Array<Wave['kind']>> = [
  ['straight', 'weaver', 'shooter', 'weaver', 'straight', 'shooter', 'straight', 'weaver', 'shooter'],
  ['weaver', 'straight', 'weaver', 'shooter', 'straight', 'weaver', 'shooter', 'straight', 'shooter'],
  ['shooter', 'weaver', 'straight', 'shooter', 'weaver', 'straight', 'shooter', 'weaver', 'straight'],
  ['straight', 'shooter', 'weaver', 'straight', 'weaver', 'shooter', 'weaver', 'straight', 'shooter'],
  ['weaver', 'shooter', 'weaver', 'straight', 'shooter', 'straight', 'weaver', 'shooter', 'straight'],
  ['straight', 'weaver', 'straight', 'shooter', 'weaver', 'shooter', 'straight', 'shooter', 'weaver'],
  ['shooter', 'straight', 'weaver', 'straight', 'shooter', 'weaver', 'shooter', 'straight', 'weaver'],
  ['weaver', 'straight', 'shooter', 'weaver', 'shooter', 'straight', 'weaver', 'straight', 'shooter'],
  ['straight', 'shooter', 'straight', 'weaver', 'shooter', 'weaver', 'straight', 'shooter', 'weaver'],
  ['weaver', 'shooter', 'straight', 'shooter', 'weaver', 'straight', 'shooter', 'straight', 'weaver'],
];
const FORMATIONS: FormationKind[] = ['chevron', 'arc', 'pincer', 'column', 'line'];

function buildWaves(id: number): Wave[] {
  const chapter = Math.floor((id - 1) / GAME_CONFIG.campaign.levelsPerChapter);
  const doctrine = DOCTRINES[chapter % DOCTRINES.length];
  const waveCountRange = GAME_CONFIG.waves.maximumTotal - GAME_CONFIG.waves.minimumTotal + 1;
  const normalWaveCount = GAME_CONFIG.waves.minimumTotal - 1 + ((id + chapter) % waveCountRange);
  const pressure = Math.max(0, id - 5);
  const boundedPressure = Math.min(pressure, 90);
  return Array.from({ length: normalWaveCount }, (_, index) => {
    const kind = doctrine[(index + id % 5) % doctrine.length];
    const speedBase = kind === 'shooter' ? 142 : kind === 'weaver' ? 196 : 214;
    const speedLimit = kind === 'shooter' ? 180 : kind === 'weaver' ? 262 : 290;
    return {
      at: 2 + index * (5.2 + ((id + chapter) % 4) * 0.4),
      kind,
      formation: FORMATIONS[(index * (chapter % 2 ? 2 : 3) + id + chapter) % FORMATIONS.length],
      count: Math.min(15, 10 + Math.floor(boundedPressure / 14) + ((index + id) % 3 === 0 ? 1 : 0)),
      // Numeric ceilings only matter billions of levels beyond the authored campaign.
      hp: index === 0 ? openingWaveHp(id, kind) : Math.min(1e9, 8 + Math.ceil(pressure * 0.46) + (kind === 'shooter' ? 1 : 0) + Math.floor(index / 4)),
      speed: Math.min(speedLimit, speedBase + boundedPressure * 0.9 + (index % 3) * 5),
      hold: Math.max(kind === 'shooter' ? 1.65 : 0.95, (kind === 'shooter' ? 2.15 : 1.55) - boundedPressure * 0.006 + (index % 2) * 0.15),
      tier: index === 0 && id < 16 ? 1 : 2,
      powerUpDrops: index < GAME_CONFIG.pickups.permanentPower.openingWavesWithoutDrops ? 0 : GAME_CONFIG.pickups.permanentPower.maxPerWave,
      ...(index === 1 ? { drop: (['weapon-pulse', 'weapon-lance', 'weapon-scatter'] as const)[id % 3] }
        : index === Math.floor(normalWaveCount / 2) ? { drop: 'health' as const }
        : index === normalWaveCount - 2 ? { drop: (['rapid', 'spread', 'damage'] as const)[(id + chapter) % 3] }
        : {}),
    };
  });
}

function buildLevel(id: number, story: LevelStory): Level {
  const [name, subtitle, briefing, guardian, kind, paired] = story;
  const chapter = Math.floor((id - 1) / GAME_CONFIG.campaign.levelsPerChapter);
  const pressure = Math.max(0, id - 5);
  const totalBossHp = Math.min(1e12, Math.round(700 + pressure * 32 + Math.pow(pressure, 1.13) * 5));
  return {
    id, name, subtitle, briefing,
    color: CHAPTER_COLORS[chapter % CHAPTER_COLORS.length],
    waves: buildWaves(id),
    boss: { name: guardian, kind, hp: paired ? Math.round(totalBossHp * 0.55) : totalBossHp, ...(paired ? { count: 2 } : {}) },
    ...(id <= CAMPAIGN_LEVEL_COUNT ? { transmissionId: transmissionIdForLevel(id) } : {}),
  };
}

export const LEVELS: Level[] = [
  ...OPENING_LEVELS.map(level => ({
    ...level,
    waves: level.waves.map((wave, index) => index === 0 ? { ...wave, hp: openingWaveHp(level.id, wave.kind) } : wave),
    transmissionId: transmissionIdForLevel(level.id),
  })),
  ...DESTINATIONS.map((story, index) => buildLevel(index + OPENING_LEVELS.length + 1, story)),
];

const FRONTIERS = ['EMBER REACH', 'DISTANT CHOIR', 'SILVER EXPANSE', 'UNBOUND MERIDIAN', 'LANTERN SEA', 'QUIET CONSTELLATION', 'FAR HORIZON', 'PILGRIM WAKE', 'SECOND SUN', 'BEYOND THE MAP'];
const FRONTIER_GUARDIANS: GuardianKind[] = ['warden', 'carrier', 'twins', 'lattice', 'koschei'];

/** Level 50 resolves the story; later levels are new rescue routes, with no campaign reset. */
export function getLevel(levelNumber: number): Level {
  const id = Number.isFinite(levelNumber) ? Math.max(1, Math.min(MAX_LEVEL_NUMBER, Math.floor(levelNumber))) : 1;
  if (id <= LEVELS.length) return LEVELS[id - 1];
  const route = id - CAMPAIGN_LEVEL_COUNT;
  const kind = FRONTIER_GUARDIANS[(route - 1) % FRONTIER_GUARDIANS.length];
  return buildLevel(id, [
    `${FRONTIERS[(route - 1) % FRONTIERS.length]} ${String(Math.ceil(route / FRONTIERS.length)).padStart(2, '0')}`,
    `OPEN SKY / RESCUE ROUTE ${String(route).padStart(3, '0')}`,
    `A new distress call has reached the free beacons. Trace rescue route ${route}, clear its returning patrols, and keep a passage open for whoever is still waiting. The search continues beyond ${CHAPTERS.length} recovered chapters.`,
    `REMNANT ${String(route).padStart(3, '0')} // ${kind === 'carrier' ? 'DRONE FOUNDRY' : kind === 'twins' ? 'HUNTER PAIR' : kind === 'lattice' ? 'QUARANTINE LATTICE' : kind === 'koschei' ? 'COMMAND ARRAY' : 'ROUTE SENTINEL'}`,
    kind,
    kind === 'twins' || (kind === 'lattice' && route % 2 === 0),
  ]);
}
