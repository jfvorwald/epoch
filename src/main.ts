import Phaser from 'phaser';
import { CombatScene } from './game/CombatScene';
import { AudioSystem } from './game/audio';
import { setupBetaFeedback } from './beta';
import { MAX_PROJECTILES, MAX_WEAPON_POWER } from './game/weapons';
import { defaultSave, loadSave, persistSave } from './game/save';
import { LEVELS, getLevel } from './data/levels';
import { CHAPTERS } from './data/story';
import { CAMPAIGN_LEVEL_COUNT, GAME_CONFIG } from './data/config';
import { TRANSMISSIONS } from './data/transmissions';
import { SHIPS, SHIP_PARTS_REQUIRED, defaultLoadout, getShipStats, isShipUnlocked } from './data/ships';
import type { Checkpoint, HudState, Outcome, Preferences, ShipId, ShipLoadout, Transmission, WeaponKind } from './game/types';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
// Keep one production-mode artifact for staging review and production promotion.
const staging = window.location.hostname === 'epoch-staging.jaqstudios.com';
const buildLabel = `v${import.meta.env.VITE_APP_VERSION} · ${import.meta.env.VITE_BUILD_ID}`;
const playtest = import.meta.env.DEV && new URLSearchParams(window.location.search).get('playtest') === '1';
const save = playtest ? defaultSave() : loadSave();
if (playtest) save.hangar.parts = SHIP_PARTS_REQUIRED;
let playtestLevel = 1;
let hasStoredPreferences = false;
if (!playtest) try { hasStoredPreferences = !!localStorage.getItem('epoch.browser.save.v1'); } catch { /* session only */ }
if (!hasStoredPreferences && matchMedia('(prefers-reduced-motion: reduce)').matches) save.preferences.reducedMotion = true;
const audio = new AudioSystem(save.preferences);
let ready = false;
let screen = 'menu';
let lastHud: HudState | undefined;
let hudLevel = getLevel(1);
let pending: Outcome | undefined;
let noticeTimer = 0;
let settingsReturn = 'menu';
let archiveReturn = 'menu';
let mapReturn: () => void = () => showMenu();
let installReturn = 'menu';
let storageAvailable = true;
let transmissionNext: (() => void) | undefined;
let lastAnnouncement = '';
let hangarShip: ShipId = save.hangar.selectedShip;
let activeRun: { shipId: ShipId; loadout: ShipLoadout } | undefined;
let levelPartsBefore = save.hangar.parts;
const weaponNames: Record<WeaponKind, string> = { pulse: 'Pulse cannon', lance: 'Piercing lance', scatter: 'Scatter cannon' };
const pad = (n: number, width = 2) => n.toString().padStart(width, '0');
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

app.innerHTML = `
  <header class="masthead"><a class="studio" href="#" aria-label="EPOCH main menu"><img src="/art/emblem.svg" alt=""/>JAQ <span>STUDIOS</span></a><div class="masthead-center">ORBITAL DEFENSE PROGRAM <span> / </span> EST. 2049</div><div class="live-label"><i></i> STRELKA SYSTEM ONLINE</div></header>
  <main class="flight-deck">
    <aside class="sidebar left-side"><div class="eyebrow">KOSMOFLOT FLIGHT ARCHIVE</div><h2>Beyond<br>the static<br><em>wall.</em></h2><p>The old world went silent.<br>Something is still transmitting.</p><div class="rail-divider"></div><div class="micro-label">ACTIVE AIRFRAME</div><div class="airframe-name">STRELKA—9 <span>09</span></div><div class="spec-row"><span>PILOT</span><b>VOSS</b></div><div class="spec-row"><span>CLASS</span><b>INTERCEPTOR</b></div><div class="spec-row"><span>STATUS</span><b class="cyan">FLIGHT READY</b></div><div class="side-wave"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="micro-label faint">141.80 MHZ / SIGNAL ACQUIRED</div></aside>
    <section class="console" aria-label="EPOCH game">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <div id="game-stage">${staging ? `<div class="staging-badge" aria-label="Staging build ${escape(buildLabel)}">STAGING · ${escape(buildLabel)}</div>` : ''}${playtest ? '<div class="playtest-badge">LOCAL PLAYTEST · SESSION ONLY</div>' : ''}<div id="phaser" aria-label="Combat playfield. Drag to move; weapons fire automatically." role="application" tabindex="0"></div><div id="menu-backdrop"><div class="orbit-line"></div><img class="hero-ship" src="/art/strelka.svg" alt="Strelka-9 angular armored spacecraft with cyan engines"/><div class="ship-callout"><span>СТРЕЛКА—9</span><i></i><small>FLIGHT UNIT 09</small></div></div><div id="hud" hidden></div><button id="pause-control" class="pause-button" data-action="pause" aria-label="Pause game" hidden>Ⅱ</button><div id="overlay"></div><div id="notice" role="status" aria-live="polite"></div><div id="damage-flash"></div></div>
    </section>
    <aside class="sidebar right-side"><div class="eyebrow">EPOCH 001</div><h3>THE FIRST<br>TRANSMISSION</h3><div class="sector-list">${LEVELS.slice(0, 5).map(level => `<div class="sector-map" data-sector="${level.id}"><span>${pad(level.id)}</span><div>${escape(level.name)}<small>${level.boss ? 'HOSTILE COMMAND ARRAY' : 'UNCHARTED AIRSPACE'}</small></div><i></i></div>`).join('')}</div><div class="signal-branch-preview" aria-hidden="true"><span></span><i></i><i></i><i></i><b>45 MORE LEVELS · THEN ∞</b></div><button class="signal-map-link" data-action="signal-map">VIEW SIGNAL MAP <span>↗</span></button><div class="rail-divider"></div><div class="micro-label">FLIGHT CONTROLS</div><p class="control-note"><span class="keycap">↔</span> Drag anywhere to maneuver<br><span class="keycap">WASD</span> or use arrow keys<br><span class="keycap">ESC</span> Pause flight</p><div class="autofire"><i></i> WEAPONS FIRE AUTOMATICALLY</div><button class="install-link" data-action="install">↗ &nbsp; Add to iPhone Home Screen</button></aside>
  </main>
  <footer class="footer"><span>© 2049 JAQ STUDIOS</span><span>NO UPLINK. NO COMMAND AUTHORITY. <b>JUST THE SIGNAL.</b></span><span>50 LEVELS / AN ENDLESS HORIZON</span></footer>`;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const hud = document.querySelector<HTMLDivElement>('#hud')!;
const pauseControl = document.querySelector<HTMLButtonElement>('#pause-control')!;
const stage = document.querySelector<HTMLDivElement>('#game-stage')!;
const noticeEl = document.querySelector<HTMLDivElement>('#notice')!;

function saveProgress() {
  if (playtest) return true;
  storageAvailable = persistSave(save);
  if (!storageAvailable) notice('Storage unavailable · progress kept this session');
  return storageAvailable;
}
function notice(message: string) {
  noticeEl.textContent = message;
  noticeEl.classList.add('visible');
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => noticeEl.classList.remove('visible'), 2900);
}
function applyPreferences() {
  document.documentElement.classList.toggle('reduced-motion', save.preferences.reducedMotion);
  audio.preferences(save.preferences);
  scene.setPreferences(save.preferences);
}
function setScreen(value: string, html: string, focus = true) {
  screen = value;
  pauseControl.hidden = value !== 'playing';
  overlay.innerHTML = html;
  overlay.className = value === 'playing' ? 'empty' : value === 'menu' ? 'menu-overlay' : 'modal-overlay';
  stage.classList.toggle('in-menu', value === 'menu');
  stage.classList.toggle('in-hangar', value === 'hangar');
  if (value !== 'playing') noticeEl.classList.remove('visible');
  if (focus) window.requestAnimationFrame(() => overlay.querySelector<HTMLElement>('button:not(:disabled), input')?.focus({ preventScroll: true }));
}
function partsInventory(extraClass = '') {
  const parts = save.hangar.parts;
  const complete = parts >= SHIP_PARTS_REQUIRED;
  return `<div class="parts-inventory ${complete ? 'complete' : ''} ${extraClass}" aria-label="Ship parts: ${parts} of ${SHIP_PARTS_REQUIRED}. ${complete ? 'Manta unlocked.' : 'Collect parts to unlock Manta.'}"><div class="parts-inventory-count"><span>SHIP PARTS</span><strong>${parts}<small> / ${SHIP_PARTS_REQUIRED}</small></strong></div><div class="parts-inventory-project"><b>${complete ? 'MANTA UNLOCKED' : 'MANTA ASSEMBLY'}</b><div class="parts-inventory-meter" aria-hidden="true">${Array.from({ length: SHIP_PARTS_REQUIRED }, (_, i) => `<i class="${i < parts ? 'collected' : ''}"></i>`).join('')}</div></div></div>`;
}
function panel(kicker: string, title: string, body: string, extraClass = '') {
  return `<div class="panel ${extraClass}"><div class="panel-mark">＋ <span>KOSMOFLOT / FLIGHT COMPUTER</span> ＋</div><div class="eyebrow">${kicker}</div><h2>${title}</h2>${partsInventory()}${body}<div class="panel-bottom">MIRNY—7 <span>SECURE CHANNEL / 09</span></div></div>`;
}
function button(action: string, text: string, primary = false, disabled = false) { return `<button data-action="${action}" class="${primary ? 'primary-button' : 'secondary-button'}" ${disabled ? 'disabled' : ''}>${text}</button>`; }
function updateAirframe(shipId: ShipId) {
  const ship = SHIPS[shipId];
  document.querySelector('.airframe-name')!.innerHTML = `${escape(ship.name.toUpperCase())} <span>${shipId === 'strelka' ? '09' : '12'}</span>`;
  const specs = document.querySelectorAll('.left-side .spec-row b');
  if (specs[1]) specs[1].textContent = ship.className;
  document.querySelector('.live-label')!.innerHTML = `<i></i> ${escape(ship.name.toUpperCase())} SYSTEM ONLINE`;
  const hero = document.querySelector<HTMLImageElement>('.hero-ship')!;
  hero.src = ship.art;
  hero.alt = shipId === 'strelka' ? 'Strelka-9 narrow armored interceptor with cyan engines' : 'Manta-12 broad winged corvette with amber engines';
  hero.classList.toggle('manta', shipId === 'manta');
  document.querySelector('.ship-callout span')!.textContent = ship.name.toUpperCase();
  document.querySelector('.ship-callout small')!.textContent = ship.className;
}
function newFlightCheckpoint(): Checkpoint {
  const shipId = save.hangar.selectedShip;
  const loadout = { ...save.hangar.loadouts[shipId] };
  return { level: playtest ? playtestLevel : 1, score: 0, hp: getShipStats(shipId, loadout).maxHp, shipId, loadout };
}
function playtestControls() {
  return playtest ? `<label class="playtest-controls"><span>TEST START</span><select name="playtest-level" aria-label="Playtest starting level">${[...LEVELS, getLevel(51), getLevel(100)].map(level => `<option value="${level.id}" ${level.id === playtestLevel ? 'selected' : ''}>LEVEL ${pad(level.id)} · ${escape(level.name)}</option>`).join('')}</select></label>` : '';
}
function showMenu() {
  scene.showMenu(); hud.hidden = true;
  lastHud = undefined;
  updateAirframe(save.hangar.selectedShip);
  const checkpoint = save.checkpoint;
  const selectedShip = SHIPS[save.hangar.selectedShip];
  const selectedLoadout = save.hangar.loadouts[save.hangar.selectedShip];
  setScreen('menu', `<div class="menu-topline"><span>MAIN MENU</span>${partsInventory('menu-parts')}</div><div class="title-block"><div class="eyebrow">JAQ STUDIOS PRESENTS</div><h1>EPOCH</h1><div class="title-rule"><i></i><span>THE SIGNAL IS CALLING</span><i></i></div></div><div class="menu-actions">${playtestControls()}<div class="menu-ship-card"><button data-action="hangar" class="edit-ship-button"><span class="menu-airframe"><strong>${escape(selectedShip.name)}</strong><small>${selectedLoadout.handling} / ${selectedLoadout.reactor}</small></span><span class="menu-edit-label">EDIT SHIP <i aria-hidden="true">↗</i></span></button></div>${button('launch', `<span>LAUNCH</span><span class="button-detail">${playtest ? `TEST LEVEL ${pad(playtestLevel)}` : 'NEW FLIGHT'} <b>↗</b></span>`, true, !ready)}${button('continue', `<span>CONTINUE</span><span class="button-detail">${checkpoint ? `LEVEL ${pad(checkpoint.level)} <b>→</b>` : 'NO SAVED FLIGHT'}</span>`, false, !ready || !checkpoint)}<nav class="menu-secondary" aria-label="Flight navigation">${button('signal-map', 'SIGNAL MAP')}${button('archive', 'ARCHIVE')}${button('settings', 'SETTINGS')}</nav><div class="menu-records"><div><span>BEST</span><strong>${pad(save.bestScore, 6)}</strong></div><span class="record-divider"></span><div><span>LEVEL</span><strong>${pad(save.furthestLevel)} <small>${save.furthestLevel > CAMPAIGN_LEVEL_COUNT ? " / ∞" : ` / ${CAMPAIGN_LEVEL_COUNT}`}</small></strong></div></div><div class="menu-hint">DRAG TO MOVE <span>·</span> AUTO-FIRE</div><button data-action="install" class="mobile-install">ADD TO HOME SCREEN ↗</button></div>`, false);
  updateLevelMap(0);
}
function startFlight(checkpoint: Checkpoint, fresh = false) {
  audio.unlock();
  if (fresh) { save.checkpoint = null; saveProgress(); }
  pending = undefined; lastAnnouncement = ''; hud.hidden = false;
  levelPartsBefore = save.hangar.parts;
  activeRun = { shipId: checkpoint.shipId ?? 'strelka', loadout: { ...(checkpoint.loadout ?? defaultLoadout()) } };
  updateAirframe(activeRun.shipId);
  setScreen('playing', '', false);
  scene.setShipParts(save.hangar.parts);
  scene.startRun({ ...checkpoint, shipId: activeRun.shipId, loadout: { ...activeRun.loadout } });
  document.querySelector<HTMLElement>('#phaser')!.focus({ preventScroll: true });
  updateLevelMap(checkpoint.level);
}
function pauseFlight(backgrounded = false) {
  if (screen !== 'playing' || lastHud?.hp === 0) return;
  scene.pauseCombat();
  audio.suspend();
  setScreen('paused', panel('FLIGHT SUSPENDED', 'Hold position.', `<p>${backgrounded ? 'Your flight was paused while you were away.' : 'Engines at idle. Your position is secure.'}</p><div class="pause-stats"><span>LEVEL ${pad(lastHud?.level ?? 1)} · WAVE ${pad(lastHud?.wave ?? 1)} / ${pad(lastHud?.totalWaves ?? 8)}</span><span>${pad(lastHud?.score ?? 0, 6)} PTS</span></div><div class="paused-weapon">${lastHud ? `${weaponNames[lastHud.weapon]} · POWER ${lastHud.weaponPower} / ${MAX_WEAPON_POWER}<br>${lastHud.projectiles} SHOTS · BLAST ×${lastHud.blastMultiplier.toFixed(2)}${lastHud.weaponPower >= MAX_WEAPON_POWER ? ' · MAX POWER' : ''}` : ''}</div>${button('resume', 'RESUME FLIGHT <span>→</span>', true)}${button('settings', 'SETTINGS')}${button('menu', 'RETURN TO MENU')}<p class="fine-print">Continue returns to the last secured level. Current level progress is not saved.</p>`));
}
function onHud(state: HudState) {
  if (lastHud && state.hp < lastHud.hp && !save.preferences.reducedMotion) { stage.classList.remove('hit'); void stage.offsetWidth; stage.classList.add('hit'); }
  lastHud = state;
  if (hudLevel.id !== state.level) hudLevel = getLevel(state.level);
  pauseControl.hidden = screen !== 'playing' || state.hp === 0;
  if (state.hp === 0) noticeEl.classList.remove('visible');
  const ship = SHIPS[state.shipId];
  const superchargeSeconds = Math.max(0, state.buffs.supercharge ?? 0);
  hud.innerHTML = `<div class="hud-top"><div class="health-block"><div class="micro-label">${escape(ship.name.toUpperCase())} <span>HULL</span></div><div class="health-bars" aria-label="Health ${state.hp} of ${state.maxHp}">${Array.from({ length: state.maxHp }, (_, i) => `<i class="${i < state.hp ? 'full' : ''}"></i>`).join('')}<small>${state.hp}/${state.maxHp}</small></div></div><div class="hud-score"><span>SCORE</span><b>${pad(state.score, 6)}</b></div></div><div class="hud-sector"><span>LEVEL ${pad(state.level)} <b>${escape(hudLevel.name)}</b></span><span class="wave-counter ${state.waveKind}">WAVE ${pad(state.wave)}/${pad(state.totalWaves)}${state.waveKind === 'debris' ? ' · ASTEROIDS' : state.waveKind === 'guardian' ? ' · GUARDIAN' : ''}</span></div><div class="sector-progress"><i style="width:${Math.min(100, state.progress * 100)}%"></i></div><div class="hud-parts" aria-label="Ship parts ${state.shipParts} of ${SHIP_PARTS_REQUIRED}"><span>◇ SHIP PARTS <b>${state.shipParts} / ${SHIP_PARTS_REQUIRED}</b></span><small>${state.shipParts >= SHIP_PARTS_REQUIRED ? 'MANTA UNLOCKED' : 'MANTA ASSEMBLY'}</small></div>${state.bossHp !== undefined ? `<div class="boss-hud"><span>⚠ ${escape(state.bossName ?? 'COMMAND ARRAY')}</span><div><i style="width:${100 * state.bossHp / (state.bossMaxHp || 1)}%"></i></div></div>` : ''}<div class="flight-telemetry"><div class="weapon-readout"><i></i><b>${weaponNames[state.weapon]}</b><span>${state.projectiles} SHOTS</span></div><div class="weapon-power-readout ${state.weaponPower > 0 ? 'upgraded' : ''} ${state.weaponPower >= MAX_WEAPON_POWER ? 'maxed' : ''}" aria-label="Weapon power ${state.weaponPower} of ${MAX_WEAPON_POWER} earned this level. ${state.projectiles} shots. Blast damage multiplier ${state.blastMultiplier.toFixed(2)}."><div><span>WEAPON POWER</span><b>${state.weaponPower}<small> / ${MAX_WEAPON_POWER}</small></b><em>${state.weaponPower >= MAX_WEAPON_POWER ? 'MAX' : superchargeSeconds > 0 ? 'EARNED' : 'THIS LEVEL'}</em></div><div class="weapon-power-meter" aria-hidden="true">${Array.from({ length: MAX_WEAPON_POWER }, (_, i) => `<i class="${i < state.weaponPower ? 'collected' : ''} ${i >= MAX_PROJECTILES - 1 ? 'blast' : ''}"></i>`).join('')}</div>${superchargeSeconds > 0 ? `<div class="supercharge-readout" aria-label="Supercharge active: weapon power 12 of 12, ${Math.ceil(superchargeSeconds)} seconds remaining"><b>SUPERCHARGE 12/12</b><small>${Math.ceil(superchargeSeconds)}s</small></div>` : ''}<div class="blast-readout"><span>BLAST ×${state.blastMultiplier.toFixed(2)}</span><small>${superchargeSeconds > 0 ? 'TEMPORARY MAX' : state.weaponPower >= MAX_WEAPON_POWER ? 'MAX POWER' : state.weaponPower >= MAX_PROJECTILES - 1 ? 'NEXT: +25% BLAST' : 'NEXT: +1 SHOT'}</small></div></div><div class="buffs">${Object.entries(state.buffs).filter(([name, time]) => name !== 'supercharge' && time! > 0).map(([name, time]) => `<div class="buff ${name}" aria-label="${name === 'damage' ? 'Overcharge' : name} boost, ${Math.ceil(time!)} seconds remaining"><b>${name === 'rapid' ? 'RAPID' : name === 'spread' ? 'SPREAD' : 'POWER'}</b><small>${Math.ceil(time!)}s</small></div>`).join('')}</div></div>`;
  const announcement = state.hp === 1 ? `Hull critical. ${state.hp} health remaining.` : '';
  if (announcement && announcement !== lastAnnouncement) { lastAnnouncement = announcement; notice(announcement); }
}
function updateLevelMap(level: number) { document.querySelectorAll<HTMLElement>('.sector-map').forEach(el => { const nodeLevel = Number(el.dataset.sector); el.classList.toggle('active', nodeLevel === (level || save.checkpoint?.level || save.furthestLevel)); el.classList.toggle('charted', nodeLevel < save.furthestLevel); }); }
function onOutcome(outcome: Outcome) {
  pending = outcome;
  const salvage = save.hangar.parts > levelPartsBefore ? `<div class="salvage-result" role="status"><b>${save.hangar.parts === SHIP_PARTS_REQUIRED ? 'MANTA-12 UNLOCKED' : 'MANTA PART RECOVERED'}</b><span>${save.hangar.parts === SHIP_PARTS_REQUIRED ? 'Your new airframe is ready in the Ship Hangar.' : `${save.hangar.parts} / ${SHIP_PARTS_REQUIRED} parts assembled · retained after this flight.`}</span></div>` : '';
  save.bestScore = Math.max(save.bestScore, outcome.score);
  save.furthestLevel = Math.max(save.furthestLevel, outcome.level);
  if (outcome.type === 'defeat') {
    saveProgress();
    setScreen('defeat', panel('TELEMETRY LOST / VOSS', 'Signal lost.', `${salvage}<p>The ${escape(SHIPS[activeRun?.shipId ?? 'strelka'].name)} has gone dark.<br>The Signal is still out there.</p><div class="result-score"><span>FINAL SCORE</span><strong>${pad(outcome.score, 6)}</strong></div><div class="result-grid"><div>LEVEL REACHED<b>${pad(outcome.level)}${outcome.level > CAMPAIGN_LEVEL_COUNT ? " / ∞" : ` / ${CAMPAIGN_LEVEL_COUNT}`}</b></div><div>HOSTILES CLEARED<b>${pad(outcome.kills)}</b></div></div>${button('retry', 'RETRY FLIGHT <span>↗</span>', true)}${save.checkpoint ? button('continue', `CONTINUE AT LEVEL ${pad(save.checkpoint.level)}`) : ''}${button('menu', 'RETURN TO MENU')}`, 'defeat-panel'));
    return;
  }
  const level = getLevel(outcome.level);
  const transmission = TRANSMISSIONS.find(t => t.id === level.transmissionId);
  if (transmission && !save.unlockedTransmissions.includes(transmission.id)) save.unlockedTransmissions.push(transmission.id);
  save.checkpoint = { level: outcome.level + 1, score: outcome.score, hp: Math.min(outcome.maxHp, outcome.hp + 1), shipId: activeRun?.shipId ?? 'strelka', loadout: { ...(activeRun?.loadout ?? defaultLoadout()) } };
  save.furthestLevel = Math.max(save.furthestLevel, save.checkpoint?.level ?? outcome.level);
  saveProgress();
  const chapterEnd = outcome.level <= CAMPAIGN_LEVEL_COUNT && outcome.level % GAME_CONFIG.campaign.levelsPerChapter === 0;
  const chapter = CHAPTERS.find(item => item.endLevel === outcome.level);
  const nextChapter = CHAPTERS.find(item => item.startLevel === outcome.level + 1);
  setScreen('complete', panel(`LEVEL ${pad(outcome.level)} / ${escape(level.name)}`, chapterEnd ? 'A path opens.' : 'Airspace secured.', `<div class="completion-symbol">⌁</div>${salvage}<p>${outcome.level === CAMPAIGN_LEVEL_COUNT ? 'The search has brought you to the source.<br>One final transmission is waiting.' : chapterEnd ? `Chapter ${pad(chapter!.id)} complete.<br>${escape(nextChapter?.name ?? 'The horizon opens')}: a new branch of the Signal is within reach.` : 'Level guardians defeated.<br>Hull serviced. Another fragment of the Signal recovered.'}</p><div class="result-score"><span>FLIGHT SCORE</span><strong>${pad(outcome.score, 6)}</strong></div><div class="flight-result-name">${escape(SHIPS[activeRun?.shipId ?? 'strelka'].name.toUpperCase())} · ${save.hangar.parts}/${SHIP_PARTS_REQUIRED} MANTA PARTS</div><div class="checkpoint-label">${storageAvailable && !playtest ? '✓ CHECKPOINT SAVED' : 'SESSION CHECKPOINT ONLY'} · LEVEL ${pad(outcome.level + 1)}${outcome.level >= CAMPAIGN_LEVEL_COUNT ? ' / ENDLESS' : ''}</div>${storageAvailable ? '' : '<p class="fine-print">Device storage is unavailable. Progress will be lost when this page closes.</p>'}<p class="sector-reset-note">Next level: weapon power and temporary boosts reset. Your ship and hangar tuning stay with this flight.</p>${!transmission ? nextLevelBrief(outcome.level + 1) : ''}${button('advance', transmission ? 'DECODE TRANSMISSION <span>≋</span>' : 'NEXT LEVEL <span>→</span>', true)}${button('signal-map', 'VIEW SIGNAL MAP <span>⌁</span>')}${button('menu', 'RETURN TO MENU')}`));
  updateLevelMap(outcome.level + 1);
}
function nextLevelBrief(levelId: number) {
  const level = getLevel(levelId);
  const chapter = CHAPTERS.find(item => levelId >= item.startLevel && levelId <= item.endLevel);
  return `<div class="next-level-brief"><span>${chapter ? `CHAPTER ${pad(chapter.id)} / ${escape(chapter.name)}` : 'BEYOND THE SIGNAL / ENDLESS FLIGHT'}</span><h3>LEVEL ${pad(levelId)} · ${escape(level.name)}</h3><p>${escape(level.briefing)}</p></div>`;
}
function nextLevel() {
  if (pending?.level === CAMPAIGN_LEVEL_COUNT) { showVictory(); return; }
  if (save.checkpoint) startFlight(save.checkpoint);
}
function advance() {
  if (!pending) return;
  const transmission = TRANSMISSIONS.find(t => t.id === getLevel(pending!.level).transmissionId);
  if (transmission) showTransmission(transmission, nextLevel); else nextLevel();
}
function showVictory() {
  setScreen('victory', panel('THE SIGNAL / STORY COMPLETE', 'You made contact.', `<div class="victory-emblem"><img src="/art/emblem.svg" alt="Kosmoflot insignia"/></div><p>Fifty levels. 18,407 people home.<br>You followed the Signal to its source—and brought the convoy through.</p><p>Kalinina stands beneath an open sky. The free beacons are listening. Beyond the charts, another settlement calls for help. Stronger fleets guard each new route; the horizon has no final number.</p><div class="result-score"><span>FLIGHT SCORE</span><strong>${pad(pending?.score ?? save.checkpoint?.score ?? 0, 6)}</strong></div><div class="checkpoint-label">50 / 50 LEVELS CHARTED · LEVEL 51 SECURED</div>${button('continue-beyond', 'CONTINUE BEYOND THE SIGNAL <span>∞</span>', true)}${button('archive', 'READ TRANSMISSIONS')}${button('signal-map', 'VIEW SIGNAL MAP')}${button('menu', 'RETURN TO MENU')}`, 'victory-panel'));
}

function showTransmission(transmission: Transmission, next: () => void) {
  transmissionNext = next;
  setScreen('transmission', panel('INTERCEPTED TRANSMISSION', escape(transmission.title), `<div class="transmission-meta"><span>${escape(transmission.sender)}</span><small>${escape(transmission.frequency)}</small></div><div class="transmission-wave" aria-hidden="true">▁▂▁▅▃▇▂▃▁▆▂▁▅▇▃▁▂▅▃▁▆▂▁</div><div class="transmission-text">${escape(transmission.text).split('\n\n').map(p => `<p>${p.replaceAll('\n', '<br>')}</p>`).join('')}</div>${next === nextLevel && pending && pending.level < CAMPAIGN_LEVEL_COUNT ? nextLevelBrief(pending.level + 1) : ''}${button('transmission-next', next === nextLevel ? pending?.level === CAMPAIGN_LEVEL_COUNT ? 'ANSWER THE SIGNAL <span>→</span>' : `LAUNCH LEVEL ${pad((pending?.level ?? 0) + 1)} <span>→</span>` : 'CLOSE CHANNEL <span>→</span>', true)}`, 'transmission-panel'));
}
function showArchive() {
  const recovered = TRANSMISSIONS.filter(t => t.afterLevel > 0 && save.unlockedTransmissions.includes(t.id)).length;
  const orders = TRANSMISSIONS.find(t => t.id === 'launch-orders');
  setScreen('archive', panel('INTERCEPT ARCHIVE', 'Transmissions.', `<p>${recovered} of ${CAMPAIGN_LEVEL_COUNT} field transmissions recovered. Follow the Signal from the first broken relay to whatever waits beyond the silence.</p><div class="archive-list">${orders ? `<button class="archive-item launch-orders" data-transmission="${orders.id}"><span>00</span><div><b>${escape(orders.title)}</b><small>${escape(orders.sender)} / BEFORE LAUNCH</small></div><i>↗</i></button>` : ''}${CHAPTERS.map(chapter => {
    const messages = TRANSMISSIONS.filter(t => t.afterLevel >= chapter.startLevel && t.afterLevel <= chapter.endLevel);
    const count = messages.filter(t => save.unlockedTransmissions.includes(t.id)).length;
    const available = chapter.startLevel <= save.furthestLevel;
    return `<details class="archive-chapter" ${chapter.id === Math.min(CHAPTERS.length, Math.ceil(Math.max(1, save.furthestLevel - 1) / GAME_CONFIG.campaign.levelsPerChapter)) ? 'open' : ''}><summary><span>CHAPTER ${pad(chapter.id)}<b>${available ? escape(chapter.name) : 'ENCRYPTED BRANCH'}</b></span><small>${count} / ${messages.length} <i>＋</i></small></summary>${messages.map(t => {
      const unlocked = save.unlockedTransmissions.includes(t.id);
      return `<button class="archive-item" data-transmission="${t.id}" ${unlocked ? '' : 'disabled'}><span>${pad(t.afterLevel)}</span><div><b>${unlocked ? escape(t.title) : 'ENCRYPTED SIGNAL'}</b><small>${unlocked ? escape(t.sender) : `RECOVER AFTER LEVEL ${pad(t.afterLevel)}`}</small></div><i>${unlocked ? '↗' : '⊘'}</i></button>`;
    }).join('')}</details>`;
  }).join('')}</div>${button('archive-back', 'RETURN <span>←</span>')}`, 'archive-panel'));
}
function openSignalMap() {
  if (screen === 'signal-map' || screen === 'map-level') { showSignalMap(); return; }
  if (screen === 'playing') pauseFlight();
  const returnScreen = screen;
  const returnHtml = overlay.innerHTML;
  mapReturn = () => {
    setScreen(returnScreen, returnHtml);
    overlay.querySelector<HTMLElement>('[data-action="signal-map"]')?.focus({ preventScroll: true });
  };
  showSignalMap();
}
function showSignalMap() {
  const currentLevel = save.checkpoint?.level ?? lastHud?.level ?? save.furthestLevel;
  const charted = Math.min(CAMPAIGN_LEVEL_COUNT, Math.max(0, save.furthestLevel - 1));
  setScreen('signal-map', panel('KOSMOFLOT / SIGNAL CARTOGRAPHY', 'Follow the Signal.', `<div class="map-intro"><p>One broken transmission. Fifty waypoints into the dark. Follow Voss beyond the silent fleet to discover who is calling—and why it knows your name.</p><div class="map-progress"><b>${charted} / ${CAMPAIGN_LEVEL_COUNT}</b><span>LEVELS CHARTED<br>10 CHAPTERS · THEN ENDLESS</span><i>⌁</i></div></div><div class="map-legend"><span><i class="charted"></i>CHARTED</span><span><i class="current"></i>AVAILABLE</span><span><i></i>UNKNOWN</span></div><p class="map-instruction">Select an available level for its mission briefing. New story branches decode as you progress.</p><div class="signal-tree" aria-label="Campaign map: ten chapters, five levels each">${CHAPTERS.map(chapter => {
    const available = chapter.startLevel <= save.furthestLevel;
    const complete = chapter.endLevel < save.furthestLevel;
    const active = currentLevel >= chapter.startLevel && currentLevel <= chapter.endLevel;
    return `<section id="map-chapter-${chapter.id}" class="signal-chapter ${available ? 'available' : 'locked'} ${complete ? 'charted' : ''} ${active ? 'current' : ''}" aria-label="Chapter ${chapter.id}, levels ${chapter.startLevel} to ${chapter.endLevel}, ${complete ? 'charted' : available ? 'available' : 'unknown'}"><div class="chapter-head"><span class="chapter-number">${complete ? '✓' : pad(chapter.id)}</span><div><span>LEVELS ${pad(chapter.startLevel)}—${pad(chapter.endLevel)}${chapter.id === 1 ? ' / THE FIRST BRANCH' : ''}</span><h3>${available ? escape(chapter.name) : 'UNRESOLVED SIGNAL'}</h3></div><i>${active ? '◉' : available ? '⌁' : '⊘'}</i></div>${available ? `<p class="chapter-summary">${escape(chapter.summary)}</p>` : ''}<div class="chapter-nodes">${LEVELS.filter(level => level.id >= chapter.startLevel && level.id <= chapter.endLevel).map(level => {
      const unlocked = level.id <= save.furthestLevel;
      const cleared = level.id < save.furthestLevel;
      return `<button class="signal-node ${cleared ? 'charted' : ''} ${level.id === currentLevel ? 'current' : ''}" data-map-level="${level.id}" ${unlocked ? '' : 'disabled'} aria-label="Level ${level.id}${unlocked ? `, ${escape(level.name)}` : ''}, ${cleared ? 'charted, view mission' : unlocked ? 'available, view mission' : 'unknown'}" ${level.id === currentLevel ? 'aria-current="step"' : ''}><span>${pad(level.id)}</span><small>${cleared ? '✓' : unlocked ? '↗' : '·'}</small></button>`;
    }).join('')}</div>${chapter.id === 1 ? `<ol class="opening-route" aria-label="The first five levels">${LEVELS.slice(0, 5).map(level => `<li><span>${pad(level.id)}</span>${escape(level.name)}</li>`).join('')}</ol>` : ''}</section>`;
  }).join('')}<section class="signal-endless ${save.furthestLevel > CAMPAIGN_LEVEL_COUNT ? 'available' : ''}"><b>∞</b><div><span>LEVEL 51 & BEYOND</span><h3>The horizon keeps calling.</h3><p>${save.furthestLevel > CAMPAIGN_LEVEL_COUNT ? `Endless flight unlocked. Level ${pad(currentLevel)} is your next waypoint.` : 'Complete the 50-level story to follow new echoes into an infinitely scaling journey.'}</p></div></section></div>${save.checkpoint ? button('map-continue', `CONTINUE · LEVEL ${pad(save.checkpoint.level)} <span>→</span>`, true) : ''}${button('map-back', 'RETURN <span>←</span>')}`, 'signal-map-panel'));
  overlay.insertAdjacentHTML('afterbegin', '<button class="signal-map-dismiss" data-action="map-back" aria-label="Close signal map">×</button>');
  if (currentLevel > 5) requestAnimationFrame(() => overlay.querySelector(`#map-chapter-${Math.min(CHAPTERS.length, Math.ceil(currentLevel / GAME_CONFIG.campaign.levelsPerChapter))}`)?.scrollIntoView({ block: 'center' }));
}
function showMapLevel(levelId: number) {
  if (levelId > save.furthestLevel || levelId > CAMPAIGN_LEVEL_COUNT) return;
  const level = getLevel(levelId);
  const chapter = CHAPTERS.find(item => levelId >= item.startLevel && levelId <= item.endLevel)!;
  const transmission = TRANSMISSIONS.find(t => t.id === level.transmissionId && save.unlockedTransmissions.includes(t.id));
  setScreen('map-level', panel(`CHAPTER ${pad(chapter.id)} / ${escape(chapter.name)}`, escape(level.name), `<div class="mission-location">LEVEL ${pad(levelId)} / ${escape(level.subtitle)}</div><p class="mission-briefing">${escape(level.briefing)}</p><div class="mission-rules"><span>${GAME_CONFIG.waves.minimumTotal}–${GAME_CONFIG.waves.maximumTotal} WAVES</span><span>0–2 RANDOM ASTEROID WAVES</span></div><p class="fine-print">Clear every hostile to reach the next wave. Asteroids cross from different angles; dodge them or shoot a path through.</p>${transmission ? `<button class="secondary-button" data-map-transmission="${escape(transmission.id)}">READ RECOVERED TRANSMISSION <span>≋</span></button>` : '<div class="checkpoint-label">A NEW TRANSMISSION WAITS BEYOND THIS LEVEL</div>'}${save.checkpoint?.level === levelId ? button('map-continue', `CONTINUE LEVEL ${pad(levelId)} <span>→</span>`, true) : levelId === 1 && !save.checkpoint ? button('launch', 'LAUNCH LEVEL 01 <span>↗</span>', true, !ready) : ''}${button('map-overview', 'RETURN TO SIGNAL MAP <span>←</span>')}`, 'mission-panel'));
}

function showHangar(focus = true) {
  const ship = SHIPS[hangarShip];
  const unlocked = isShipUnlocked(hangarShip, save.hangar.parts);
  const loadout = save.hangar.loadouts[hangarShip];
  const stats = getShipStats(hangarShip, loadout);
  const handling: [ShipLoadout['handling'], string, string][] = [
    ['balanced', 'Balanced', 'Standard speed · 1.3s protection'], ['agile', 'Agile', '+20% speed · 1.0s protection'], ['armored', 'Armored', '−15% speed · 1.8s protection'],
  ];
  const reactors: [ShipLoadout['reactor'], string, string][] = [
    ['balanced', 'Balanced', 'Standard fire & power'], ['rapid', 'Rapid', '+33% fire rate · −20% power'], ['heavy', 'Heavy', '+45% power · −23% fire rate'],
  ];
  const tuning = (key: keyof ShipLoadout, options: [string, string, string][]) => `<fieldset class="tuning-group" ${unlocked ? '' : 'disabled'}><legend>${key === 'handling' ? '01 / HANDLING' : '02 / REACTOR'}</legend><div class="tuning-options">${options.map(([value, label, description]) => `<label class="tuning-option"><input type="radio" name="${key}" value="${value}" id="tuning-${key}-${value}" ${loadout[key] === value ? 'checked' : ''}/><span><b>${label}</b><small>${description}</small></span></label>`).join('')}</div></fieldset>`;
  setScreen('hangar', panel('KOSMOFLOT / PERSONAL HANGAR', 'Edit your ship.', `
    <div class="hangar-heading"><p>Choose your ship, handling, and reactor.</p><button data-action="hangar-back" class="hangar-close" aria-label="Close ship hangar">×</button></div>
    ${playtestControls()}<div class="ship-roster" aria-label="Choose a ship">${(Object.keys(SHIPS) as ShipId[]).map(id => {
      const item = SHIPS[id], available = isShipUnlocked(id, save.hangar.parts);
      return `<button class="ship-card ${hangarShip === id ? 'inspected' : ''} ${available ? '' : 'locked'} ${id}" data-ship="${id}" aria-pressed="${hangarShip === id}" aria-label="${escape(item.name)}, ${available ? save.hangar.selectedShip === id ? 'active ship' : 'select ship' : `locked, ${save.hangar.parts} of ${SHIP_PARTS_REQUIRED} parts`} "><span class="ship-card-status">${available ? save.hangar.selectedShip === id ? '● ACTIVE' : 'SELECT AIRFRAME' : '◇ SALVAGE PROJECT'}</span><img src="${item.art}" alt="${id === 'strelka' ? 'Narrow cyan interceptor' : 'Broad amber corvette'}"/><b>${escape(item.name)}</b><small>${available ? item.className : `${save.hangar.parts} / ${SHIP_PARTS_REQUIRED} PARTS`}</small></button>`;
    }).join('')}</div>
    <div class="hangar-description"><span>${escape(ship.className)}</span><p>${escape(ship.description)}</p><div class="native-weapon"><i></i> STARTING WEAPON <b>${weaponNames[ship.weapon]}</b></div></div>
    <div class="ship-stats" aria-label="${escape(ship.name)} performance"><div><span>HULL</span><b>${stats.maxHp}</b></div><div><span>MOBILITY</span><b>${Math.round(stats.speed / SHIPS.strelka.speed * 100)}<small>%</small></b></div><div><span>FIRE RATE</span><b>${(1 / stats.fireInterval).toFixed(1)}<small>/s</small></b></div><div><span>HIT POWER</span><b>${stats.damage.toFixed(2)}</b></div></div>
    ${unlocked ? '' : `<div class="salvage-project"><div><b>MANTA ASSEMBLY</b><span>${save.hangar.parts} / ${SHIP_PARTS_REQUIRED}</span></div><div class="salvage-meter" role="progressbar" aria-label="Manta parts collected" aria-valuenow="${save.hangar.parts}" aria-valuemin="0" aria-valuemax="${SHIP_PARTS_REQUIRED}">${Array.from({ length: SHIP_PARTS_REQUIRED }, (_, i) => `<i class="${i < save.hangar.parts ? 'collected' : ''}"></i>`).join('')}</div><p>Rare parts drop from level guardians. Collect ${SHIP_PARTS_REQUIRED} across repeated flights to unlock this airframe. Recovered parts stay with you, even after defeat.</p></div>`}
    ${tuning('handling', handling)}${tuning('reactor', reactors)}
    <div class="hangar-save-note" role="status">${unlocked ? `${escape(ship.name)} selected · tuning saved ${storageAvailable && !playtest ? 'on this device' : 'for this session'}.` : 'Recover the remaining parts to select and tune Manta.'}</div>
    <details class="field-guide"><summary>FIELD GUIDE / WEAPONS & SALVAGE <span>＋</span></summary><p><b>Weapon power</b> stacks up to 12 pickups per level. The first seven add shots, from one to eight per volley. Pickups 8–12 increase blast damage by 25% each, reaching ×2.25 at maximum power. Permanent arrays start in wave 3, with 5–7 available across each level. Your cockpit always shows the earned count, shots, and blast strength.</p><p><b>Supercharge</b> is a rare gold pickup that grants maximum 12/12 weapon power for six seconds. The timer refreshes if you collect another; durations do not stack. Your earned upgrades remain, including any collected while supercharged.</p><p><b>Weapon crates</b> switch between pulse, piercing lance, and scatter. Power carries across weapon changes. Pulse is strong against weaving units; lance against armored shooters and debris; scatter against straight-flying units. Matching the weakness deals 60% more damage.</p><p><b>Levels & waves</b> Each level has 8–10 waves. Zero, one, or two asteroid waves appear at random in each level. Wreckage enters from different angles: dodge the crossing paths or destroy it. Hostiles that pass offscreen circle back in attack patterns; clear every enemy to advance.</p><p><b>Hull</b> takes three hits before your ship explodes. Handling changes speed and the brief protection window after a hit; every setup has three hull points.</p><p><b>Boosts</b> temporarily increase fire rate or attack power. Hull pickups repair damage. Supplies are scarce: choose your moment to collect them.</p><p><b>Each new level</b> starts with your airframe’s original weapon and zero weapon power or temporary boosts. Hangar tuning lasts the whole flight.</p><p>Mobility is relative to a standard Strelka. Fire rate is volleys per second before weapon modifiers; hit power is per projectile before weapon modifiers.</p></details>
    <p class="hangar-checkpoint-note">Changes apply to a new flight. Continue keeps the ship and tuning stored at your checkpoint.</p>
    ${button('hangar-back', 'RETURN TO LAUNCH <span>→</span>', true)}
  `, 'hangar-panel'), focus);
}
function collectShipPart() {
  if (save.hangar.parts >= SHIP_PARTS_REQUIRED) return;
  save.hangar.parts = Math.min(SHIP_PARTS_REQUIRED, save.hangar.parts + 1);
  saveProgress();
  scene.setShipParts(save.hangar.parts);
  notice(save.hangar.parts === SHIP_PARTS_REQUIRED ? 'Manta unlocked · visit the ship hangar' : `Manta part recovered · ${save.hangar.parts}/${SHIP_PARTS_REQUIRED}`);
}
function showSettings() {
  const settings: [keyof Preferences, string, string][] = [['music', 'Music', 'Orbital synthesizer soundtrack'], ['sfx', 'Sound effects', 'Weapons, impacts & instrumentation'], ['reducedMotion', 'Reduced motion', 'Disable drift, shake & screen flashes'], ['trainingWheels', 'Training Wheels', 'Show enemy routes, shot paths & safe lanes']];
  setScreen('settings', panel('FLIGHT CONFIGURATION', 'Settings.', `<p>Calibrate your cockpit.</p><div class="settings-list">${settings.map(([key, label, detail]) => `<label class="setting-row"><span><b>${label}</b><small>${detail}</small></span><input type="checkbox" role="switch" name="${key}" ${save.preferences[key] ? 'checked' : ''}/><i aria-hidden="true"></i></label>`).join('')}</div><div class="fine-print">${playtest ? 'Playtest preferences last for this session.' : 'Preferences are saved on this device.'}</div>${button('settings-back', 'SAVE & RETURN <span>←</span>', true)}`));
}
function showInstall() {
  setScreen('install', panel('TAKE EPOCH WITH YOU', 'Cleared for iPhone.', `<p>Open this game in <b>Safari</b>, tap <b>Share</b>, then <b>Add to Home Screen</b>. Enable “Open as Web App” if offered.</p><p>Launch EPOCH from its icon for a full-screen cockpit. The production build is available offline after its first complete load over HTTPS.</p><div class="install-controls"><b>ONE THUMB. ALL SYSTEMS.</b><p>Touch anywhere and drag. The ship follows your movement without jumping to your finger. Weapons fire automatically. Lift to hold position.</p></div>${button('install-back', 'UNDERSTOOD <span>→</span>', true)}`));
}

const scene = new CombatScene({ onReady: () => { ready = true; if (screen === 'menu') showMenu(); }, onHud, onOutcome, onPause: () => pauseFlight(), onSound: sound => audio.play(sound), onNotice: notice, onShipPart: collectShipPart }, save.preferences);
const game = new Phaser.Game({ type: Phaser.AUTO, parent: 'phaser', width: 480, height: 800, backgroundColor: '#100f1e', antialias: true, powerPreference: 'high-performance', banner: false, audio: { noAudio: true }, fps: { target: 60, forceSetTimeOut: false }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 2, touch: { capture: true } }, scene: [scene] });
applyPreferences(); showMenu();
const betaFeedback = setupBetaFeedback({
  build: buildLabel,
  getContext: () => ({ level: lastHud?.level ?? null, wave: lastHud?.wave || null, ship: lastHud?.shipId ?? save.hangar.selectedShip }),
  onOpen: () => pauseFlight(),
});

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!target || target.disabled) return;
  audio.unlock(); audio.play('click');
  const action = target.dataset.action;
  if (action === 'launch' || action === 'retry') startFlight(newFlightCheckpoint(), true);
  else if (['continue', 'continue-beyond', 'map-continue'].includes(action ?? '') && save.checkpoint) startFlight(save.checkpoint);
  else if (action === 'pause') pauseFlight();
  else if (action === 'resume') { setScreen('playing', '', false); scene.resumeCombat(); document.querySelector<HTMLElement>('#phaser')!.focus(); }
  else if (action === 'menu') showMenu();
  else if (action === 'hangar') { hangarShip = save.hangar.selectedShip; showHangar(); }
  else if (action === 'hangar-back') showMenu();
  else if (action === 'settings') { settingsReturn = screen; showSettings(); }
  else if (action === 'settings-back') { saveProgress(); if (settingsReturn === 'paused') { screen = 'playing'; pauseFlight(); } else showMenu(); }
  else if (action === 'signal-map') openSignalMap();
  else if (action === 'map-back') mapReturn();
  else if (action === 'map-overview') showSignalMap();
  else if (action === 'archive') { archiveReturn = screen; showArchive(); }
  else if (action === 'archive-back') { if (archiveReturn === 'victory') showVictory(); else showMenu(); }
  else if (action === 'advance') advance();
  else if (action === 'transmission-next') transmissionNext?.();
  else if (action === 'install') { if (screen === 'playing') pauseFlight(); installReturn = screen; showInstall(); }
  else if (action === 'install-back') { if (installReturn === 'paused') { screen = 'playing'; pauseFlight(); } else showMenu(); }
});
overlay.addEventListener('click', event => {
  const mapNode = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-map-level]');
  if (mapNode && !mapNode.disabled) { audio.unlock(); audio.play('click'); showMapLevel(Number(mapNode.dataset.mapLevel)); return; }
  const mapTransmission = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-map-transmission]');
  if (mapTransmission) {
    const t = TRANSMISSIONS.find(item => item.id === mapTransmission.dataset.mapTransmission && save.unlockedTransmissions.includes(item.id));
    if (t) { audio.unlock(); audio.play('click'); showTransmission(t, () => showMapLevel(t.afterLevel)); }
    return;
  }
  const shipTarget = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-ship]');
  if (shipTarget) {
    const shipId = shipTarget.dataset.ship as ShipId;
    hangarShip = shipId;
    audio.unlock(); audio.play('click');
    if (isShipUnlocked(shipId, save.hangar.parts)) { save.hangar.selectedShip = shipId; saveProgress(); updateAirframe(shipId); }
    showHangar(false);
    overlay.querySelector<HTMLElement>(`[data-ship="${shipId}"]`)?.focus({ preventScroll: true });
    return;
  }
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-transmission]');
  if (!target || target.disabled) return;
  const t = TRANSMISSIONS.find(t => t.id === target.dataset.transmission);
  if (t) { audio.unlock(); audio.play('click'); showTransmission(t, showArchive); }
});
// Phaser captures arrows and Space globally. Keep native menu controls operable
// without canceling their browser defaults; Tab and Escape still reach the page.
for (const eventName of ['keydown', 'keyup']) overlay.addEventListener(eventName, event => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes((event as KeyboardEvent).key)) event.stopPropagation();
});
overlay.addEventListener('change', event => {
  const target = event.target as HTMLInputElement;
  if (playtest && target.name === 'playtest-level') {
    playtestLevel = Math.min(100, Math.max(1, Number(target.value) || 1));
    if (screen === 'menu') { showMenu(); overlay.querySelector<HTMLElement>('[name="playtest-level"]')?.focus({ preventScroll: true }); }
    return;
  }
  if (screen === 'hangar' && (target.name === 'handling' || target.name === 'reactor') && isShipUnlocked(hangarShip, save.hangar.parts)) {
    if (target.name === 'handling' && ['balanced', 'agile', 'armored'].includes(target.value)) save.hangar.loadouts[hangarShip].handling = target.value as ShipLoadout['handling'];
    if (target.name === 'reactor' && ['balanced', 'rapid', 'heavy'].includes(target.value)) save.hangar.loadouts[hangarShip].reactor = target.value as ShipLoadout['reactor'];
    saveProgress();
    const scrollTop = overlay.querySelector('.panel')!.scrollTop;
    const focusedId = target.id;
    showHangar(false);
    overlay.querySelector('.panel')!.scrollTop = scrollTop;
    document.getElementById(focusedId)?.focus({ preventScroll: true });
    return;
  }
  if (['music', 'sfx', 'reducedMotion', 'trainingWheels'].includes(target.name)) { save.preferences[target.name as keyof Preferences] = target.checked; applyPreferences(); saveProgress(); }
});
document.querySelector('.studio')!.addEventListener('click', event => { event.preventDefault(); if (screen === 'playing') pauseFlight(); else if (screen !== 'paused') showMenu(); });
document.addEventListener('keydown', event => {
  if (betaFeedback?.isOpen()) return;
  if (!event.repeat && (event.key === 'Escape' || event.key.toLowerCase() === 'p')) {
    if (screen === 'playing') { event.preventDefault(); pauseFlight(); }
    else if (screen === 'paused') { event.preventDefault(); audio.unlock(); setScreen('playing', '', false); scene.resumeCombat(); }
    else if (event.key === 'Escape' && screen === 'signal-map') { event.preventDefault(); mapReturn(); }
    else if (event.key === 'Escape' && screen === 'map-level') { event.preventDefault(); showSignalMap(); }
    else if (event.key === 'Escape' && screen === 'hangar') { event.preventDefault(); showMenu(); overlay.querySelector<HTMLElement>('[data-action="hangar"]')?.focus({ preventScroll: true }); }
  }
  // Trap focus inside overlays while retaining native keyboard activation and switches.
  if (event.key === 'Tab' && screen !== 'playing') {
    const controls = [...overlay.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary'), ...document.querySelectorAll<HTMLElement>('.beta-trigger')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
function backgroundPause() { if (screen === 'playing') pauseFlight(true); audio.suspend(); }
document.addEventListener('visibilitychange', () => { if (document.hidden) backgroundPause(); });
window.addEventListener('pagehide', backgroundPause);
window.addEventListener('blur', backgroundPause);
window.addEventListener('pointercancel', () => { if (screen === 'playing') pauseFlight(true); });
document.addEventListener('touchmove', event => { if ((event.target as HTMLElement).closest('#phaser')) event.preventDefault(); }, { passive: false });
function resizeViewport() { if (screen === 'playing') pauseFlight(true); document.documentElement.style.setProperty('--viewport-h', `${window.visualViewport?.height ?? window.innerHeight}px`); window.requestAnimationFrame(() => game.scale.refresh()); }
window.visualViewport?.addEventListener('resize', resizeViewport);
window.addEventListener('resize', resizeViewport);
resizeViewport();
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) notice('Game updated · refresh when ready');
    hadController = true;
  });
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
      // Explicitly check even when a long-lived installed game already has a worker.
      void registration.update().catch(() => {});
    }).catch(() => notice('Offline cache unavailable · online play is ready'));
  });
}
if (import.meta.env.DEV) {
  Object.assign(window, { __EPOCH__: { snapshot: () => ({ screen, playtest, save: structuredClone(save), hud: lastHud, combat: scene.getDebugState() }), debug: (action: string, payload?: Record<string, unknown>) => scene.debug(action, payload), scene, game } });
}
