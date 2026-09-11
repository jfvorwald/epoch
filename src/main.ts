import Phaser from 'phaser';
import { CombatScene } from './game/CombatScene';
import { AudioSystem } from './game/audio';
import { defaultSave, loadSave, persistSave } from './game/save';
import { LEVELS } from './data/levels';
import { TRANSMISSIONS } from './data/transmissions';
import { SHIPS, SHIP_PARTS_REQUIRED, defaultLoadout, getShipStats, isShipUnlocked } from './data/ships';
import type { Checkpoint, HudState, Outcome, Preferences, ShipId, ShipLoadout, Transmission, WeaponKind } from './game/types';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const playtest = import.meta.env.DEV && new URLSearchParams(window.location.search).get('playtest') === '1';
const save = playtest ? defaultSave() : loadSave();
if (playtest) save.hangar.parts = SHIP_PARTS_REQUIRED;
let playtestSector = 1;
let hasStoredPreferences = false;
if (!playtest) try { hasStoredPreferences = !!localStorage.getItem('epoch.browser.save.v1'); } catch { /* session only */ }
if (!hasStoredPreferences && matchMedia('(prefers-reduced-motion: reduce)').matches) save.preferences.reducedMotion = true;
const audio = new AudioSystem(save.preferences);
let ready = false;
let screen = 'menu';
let lastHud: HudState | undefined;
let pending: Outcome | undefined;
let noticeTimer = 0;
let settingsReturn = 'menu';
let archiveReturn = 'menu';
let installReturn = 'menu';
let storageAvailable = true;
let transmissionNext: (() => void) | undefined;
let lastAnnouncement = '';
let hangarShip: ShipId = save.hangar.selectedShip;
let activeRun: { shipId: ShipId; loadout: ShipLoadout } | undefined;
let sectorPartsBefore = save.hangar.parts;
const weaponNames: Record<WeaponKind, string> = { pulse: 'Pulse cannon', lance: 'Piercing lance', scatter: 'Scatter cannon' };
const pad = (n: number, width = 2) => n.toString().padStart(width, '0');
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

app.innerHTML = `
  <header class="masthead"><a class="studio" href="#" aria-label="EPOCH main menu"><img src="/art/emblem.svg" alt=""/>JAQ <span>STUDIOS</span></a><div class="masthead-center">ORBITAL DEFENSE PROGRAM <span> / </span> EST. 2049</div><div class="live-label"><i></i> STRELKA SYSTEM ONLINE</div></header>
  <main class="flight-deck">
    <aside class="sidebar left-side"><div class="eyebrow">KOSMOFLOT FLIGHT ARCHIVE</div><h2>Beyond<br>the static<br><em>wall.</em></h2><p>The old world went silent.<br>Something is still transmitting.</p><div class="rail-divider"></div><div class="micro-label">ACTIVE AIRFRAME</div><div class="airframe-name">STRELKA—9 <span>09</span></div><div class="spec-row"><span>PILOT</span><b>VOSS</b></div><div class="spec-row"><span>CLASS</span><b>INTERCEPTOR</b></div><div class="spec-row"><span>STATUS</span><b class="cyan">FLIGHT READY</b></div><div class="side-wave"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="micro-label faint">141.80 MHZ / SIGNAL ACQUIRED</div></aside>
    <section class="console" aria-label="EPOCH game">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <div id="game-stage">${playtest ? '<div class="playtest-badge">LOCAL PLAYTEST · SESSION ONLY</div>' : ''}<div id="phaser" aria-label="Combat playfield. Drag to move; weapons fire automatically." role="application" tabindex="0"></div><div id="menu-backdrop"><div class="orbit-line"></div><img class="hero-ship" src="/art/strelka.svg" alt="Strelka-9 angular armored spacecraft with cyan engines"/><div class="ship-callout"><span>СТРЕЛКА—9</span><i></i><small>FLIGHT UNIT 09</small></div></div><div id="hud" hidden></div><button id="pause-control" class="pause-button" data-action="pause" aria-label="Pause game" hidden>Ⅱ</button><div id="overlay"></div><div id="notice" role="status" aria-live="polite"></div><div id="damage-flash"></div></div>
    </section>
    <aside class="sidebar right-side"><div class="eyebrow">EPOCH 001</div><h3>THE FIRST<br>TRANSMISSION</h3><div class="sector-list">${LEVELS.map(level => `<div class="sector-map" data-sector="${level.id}"><span>${pad(level.id)}</span><div>${escape(level.name)}<small>${level.boss ? 'HOSTILE COMMAND ARRAY' : 'UNCHARTED AIRSPACE'}</small></div><i></i></div>`).join('')}</div><div class="rail-divider"></div><div class="micro-label">FLIGHT CONTROLS</div><p class="control-note"><span class="keycap">↔</span> Drag anywhere to maneuver<br><span class="keycap">WASD</span> or use arrow keys<br><span class="keycap">ESC</span> Pause flight</p><div class="autofire"><i></i> WEAPONS FIRE AUTOMATICALLY</div><button class="install-link" data-action="install">↗ &nbsp; Add to iPhone Home Screen</button></aside>
  </main>
  <footer class="footer"><span>© 2049 JAQ STUDIOS</span><span>NO UPLINK. NO COMMAND AUTHORITY. <b>JUST THE SIGNAL.</b></span><span>BUILD 01 / FIVE SECTORS</span></footer>`;
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
function panel(kicker: string, title: string, body: string, extraClass = '') {
  return `<div class="panel ${extraClass}"><div class="panel-mark">＋ <span>KOSMOFLOT / FLIGHT COMPUTER</span> ＋</div><div class="eyebrow">${kicker}</div><h2>${title}</h2>${body}<div class="panel-bottom">MIRNY—7 <span>SECURE CHANNEL / 09</span></div></div>`;
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
  return { level: playtest ? playtestSector : 1, score: 0, hp: getShipStats(shipId, loadout).maxHp, shipId, loadout };
}
function playtestControls() {
  return playtest ? `<label class="playtest-controls"><span>TEST START</span><select name="playtest-sector" aria-label="Playtest starting sector">${LEVELS.map(level => `<option value="${level.id}" ${level.id === playtestSector ? 'selected' : ''}>SECTOR ${pad(level.id)} · ${escape(level.name)}</option>`).join('')}</select></label>` : '';
}
function showMenu() {
  scene.showMenu(); hud.hidden = true;
  lastHud = undefined;
  updateAirframe(save.hangar.selectedShip);
  const checkpoint = save.checkpoint;
  setScreen('menu', `<div class="menu-topline"><span><i class="signal-dot"></i> INCOMING SIGNAL</span><span>001 / 005</span></div><div class="title-block"><div class="eyebrow">JAQ STUDIOS PRESENTS</div><h1>EPOCH</h1><div class="title-rule"><i></i><span>THE SIGNAL IS CALLING</span><i></i></div></div><div class="menu-actions">${playtestControls()}<div class="mission-mini"><span>VOSS / ${escape(SHIPS[save.hangar.selectedShip].name.toUpperCase())}</span><span>FLIGHT READY</span></div>${button('launch', `<span>LAUNCH</span><span class="button-detail">${playtest ? `TEST SECTOR ${pad(playtestSector)}` : 'NEW FLIGHT'} <b>↗</b></span>`, true, !ready)}${button('continue', `<span>CONTINUE</span><span class="button-detail">${checkpoint ? `S${pad(checkpoint.level)} · ${escape(SHIPS[checkpoint.shipId ?? 'strelka'].name.toUpperCase())} →` : 'NO FLIGHT RECORDED'}</span>`, false, !ready || !checkpoint)}<div class="menu-secondary">${button('hangar', '◇ &nbsp; SHIP HANGAR')} ${button('archive', '≋ &nbsp; ARCHIVE')} ${button('settings', '⊙ &nbsp; SETTINGS')}</div><div class="menu-records"><div><span>BEST SCORE</span><strong>${pad(save.bestScore, 6)}</strong></div><span class="record-divider"></span><div><span>FURTHEST SECTOR</span><strong>${pad(save.furthestSector)} <small>/ 05</small></strong></div></div><div class="menu-hint">DRAG TO MOVE <span>·</span> AUTO-FIRE ENGAGED</div><button data-action="install" class="mobile-install">ADD TO HOME SCREEN ↗</button></div>`, false);
  updateSectorMap(0);
}
function startFlight(checkpoint: Checkpoint, fresh = false) {
  audio.unlock();
  if (fresh) { save.checkpoint = null; saveProgress(); }
  pending = undefined; lastAnnouncement = ''; hud.hidden = false;
  sectorPartsBefore = save.hangar.parts;
  activeRun = { shipId: checkpoint.shipId ?? 'strelka', loadout: { ...(checkpoint.loadout ?? defaultLoadout()) } };
  updateAirframe(activeRun.shipId);
  setScreen('playing', '', false);
  scene.setShipParts(save.hangar.parts);
  scene.startRun({ ...checkpoint, shipId: activeRun.shipId, loadout: { ...activeRun.loadout } });
  document.querySelector<HTMLElement>('#phaser')!.focus({ preventScroll: true });
  updateSectorMap(checkpoint.level);
}
function pauseFlight(backgrounded = false) {
  if (screen !== 'playing' || lastHud?.hp === 0) return;
  scene.pauseCombat();
  audio.suspend();
  setScreen('paused', panel('FLIGHT SUSPENDED', 'Hold position.', `<p>${backgrounded ? 'Your flight was paused while you were away.' : 'Engines at idle. Your position is secure.'}</p><div class="pause-stats"><span>SECTOR ${pad(lastHud?.level ?? 1)}</span><span>${pad(lastHud?.score ?? 0, 6)} PTS</span></div>${button('resume', 'RESUME FLIGHT <span>→</span>', true)}${button('settings', 'SETTINGS')}${button('menu', 'RETURN TO MENU')}<p class="fine-print">Continue returns to the last secured sector. Current sector progress is not saved.</p>`));
}
function onHud(state: HudState) {
  if (lastHud && state.hp < lastHud.hp && !save.preferences.reducedMotion) { stage.classList.remove('hit'); void stage.offsetWidth; stage.classList.add('hit'); }
  lastHud = state;
  pauseControl.hidden = screen !== 'playing' || state.hp === 0;
  if (state.hp === 0) noticeEl.classList.remove('visible');
  const ship = SHIPS[state.shipId];
  hud.innerHTML = `<div class="hud-top"><div class="health-block"><div class="micro-label">${escape(ship.name.toUpperCase())} <span>HULL</span></div><div class="health-bars" aria-label="Health ${state.hp} of ${state.maxHp}">${Array.from({ length: state.maxHp }, (_, i) => `<i class="${i < state.hp ? 'full' : ''}"></i>`).join('')}<small>${state.hp}/${state.maxHp}</small></div></div><div class="hud-score"><span>SCORE</span><b>${pad(state.score, 6)}</b></div></div><div class="hud-sector"><span>SECTOR ${pad(state.level)} <b>${escape(LEVELS[state.level - 1].name)}</b></span><span>${pad(state.wave)}/${pad(state.totalWaves)}</span></div><div class="sector-progress"><i style="width:${Math.min(100, state.progress * 100)}%"></i></div>${state.bossHp !== undefined ? `<div class="boss-hud"><span>⚠ ${escape(state.bossName ?? 'COMMAND ARRAY')}</span><div><i style="width:${100 * state.bossHp / (state.bossMaxHp || 1)}%"></i></div></div>` : ''}<div class="flight-telemetry"><div class="weapon-readout"><i></i><b>${weaponNames[state.weapon]}</b><span>${state.projectiles}×</span></div><div class="multishot-readout ${state.multishot ? 'upgraded' : ''}">MULTISHOT <b>+${state.multishot}</b><span>THIS SECTOR</span></div><div class="buffs">${Object.entries(state.buffs).filter(([, time]) => time! > 0).map(([name, time]) => `<div class="buff ${name}" aria-label="${name === 'damage' ? 'Overcharge' : name} boost, ${Math.ceil(time!)} seconds remaining"><b>${name === 'rapid' ? 'RAPID' : name === 'spread' ? 'SPREAD' : 'POWER'}</b><small>${Math.ceil(time!)}s</small></div>`).join('')}</div></div>`;
  const announcement = state.hp === 1 ? `Hull critical. ${state.hp} health remaining.` : '';
  if (announcement && announcement !== lastAnnouncement) { lastAnnouncement = announcement; notice(announcement); }
}
function updateSectorMap(level: number) { document.querySelectorAll<HTMLElement>('.sector-map').forEach(el => { const sector = Number(el.dataset.sector); el.classList.toggle('active', sector === level); el.classList.toggle('charted', sector < save.furthestSector); }); }
function onOutcome(outcome: Outcome) {
  pending = outcome;
  const salvage = save.hangar.parts > sectorPartsBefore ? `<div class="salvage-result" role="status"><b>${save.hangar.parts === SHIP_PARTS_REQUIRED ? 'MANTA-12 UNLOCKED' : 'MANTA PART RECOVERED'}</b><span>${save.hangar.parts === SHIP_PARTS_REQUIRED ? 'Your new airframe is ready in the Ship Hangar.' : `${save.hangar.parts} / ${SHIP_PARTS_REQUIRED} parts assembled · retained after this flight.`}</span></div>` : '';
  save.bestScore = Math.max(save.bestScore, outcome.score);
  save.furthestSector = Math.max(save.furthestSector, outcome.level);
  if (outcome.type === 'defeat') {
    saveProgress();
    setScreen('defeat', panel('TELEMETRY LOST / VOSS', 'Signal lost.', `<p>The ${escape(SHIPS[activeRun?.shipId ?? 'strelka'].name)} has gone dark.<br>The Signal is still out there.</p><div class="result-score"><span>FINAL SCORE</span><strong>${pad(outcome.score, 6)}</strong></div><div class="result-grid"><div>SECTOR REACHED<b>${pad(outcome.level)} / 05</b></div><div>HOSTILES CLEARED<b>${pad(outcome.kills)}</b></div></div>${button('retry', 'RETRY FLIGHT <span>↗</span>', true)}${save.checkpoint ? button('continue', `CONTINUE AT SECTOR ${pad(save.checkpoint.level)}`) : ''}${button('menu', 'RETURN TO MENU')}`, 'defeat-panel'));
    return;
  }
  const level = LEVELS[outcome.level - 1];
  const transmission = TRANSMISSIONS.find(t => t.id === level.transmissionId);
  if (transmission && !save.unlockedTransmissions.includes(transmission.id)) save.unlockedTransmissions.push(transmission.id);
  save.checkpoint = outcome.level < LEVELS.length ? { level: outcome.level + 1, score: outcome.score, hp: Math.min(outcome.maxHp, outcome.hp + 1), shipId: activeRun?.shipId ?? 'strelka', loadout: { ...(activeRun?.loadout ?? defaultLoadout()) } } : null;
  save.furthestSector = Math.max(save.furthestSector, save.checkpoint?.level ?? outcome.level);
  saveProgress();
  setScreen('complete', panel(`SECTOR ${pad(outcome.level)} / ${escape(level.name)}`, 'Airspace secured.', `<div class="completion-symbol">⌁</div>${salvage}<p>${outcome.level === 5 ? 'The command array is silent.<br>A new transmission breaks through.' : 'Sector guardians defeated.<br>Hull serviced. Flight data recorded.'}</p><div class="result-score"><span>FLIGHT SCORE</span><strong>${pad(outcome.score, 6)}</strong></div><div class="flight-result-name">${escape(SHIPS[activeRun?.shipId ?? 'strelka'].name.toUpperCase())} · ${save.hangar.parts}/${SHIP_PARTS_REQUIRED} MANTA PARTS</div><div class="checkpoint-label">${outcome.level === 5 ? 'ALL FIVE SECTORS CLEARED' : `${storageAvailable && !playtest ? '✓ CHECKPOINT SAVED' : 'SESSION CHECKPOINT ONLY'} · SECTOR ${pad(outcome.level + 1)}`}</div>${storageAvailable ? '' : '<p class="fine-print">Device storage is unavailable. Progress will be lost when this page closes.</p>'}${outcome.level < LEVELS.length ? '<p class="sector-reset-note">Next sector: multishot and pickups reset. Your ship and hangar tuning stay with this flight.</p>' : ''}${button('advance', transmission ? 'DECODE TRANSMISSION <span>≋</span>' : 'NEXT SECTOR <span>→</span>', true)}${button('menu', 'RETURN TO MENU')}`));
}
function nextSector() {
  if (pending?.level === LEVELS.length) { showVictory(); return; }
  if (save.checkpoint) startFlight(save.checkpoint);
}
function advance() {
  if (!pending) return;
  const transmission = TRANSMISSIONS.find(t => t.id === LEVELS[pending!.level - 1].transmissionId);
  if (transmission) showTransmission(transmission, nextSector); else nextSector();
}
function showVictory() {
  setScreen('victory', panel('EPOCH 001 / MISSION COMPLETE', 'You made contact.', `<div class="victory-emblem"><img src="/art/emblem.svg" alt="Kosmoflot insignia"/></div><p>Five sectors. One surviving pilot.<br>The Signal knows your name.</p><div class="result-score"><span>FLIGHT SCORE</span><strong>${pad(pending?.score ?? 0, 6)}</strong></div><div class="checkpoint-label">THE FIRST TRANSMISSION · COMPLETE</div>${button('retry', 'FLY AGAIN <span>↗</span>', true)}${button('archive', 'READ TRANSMISSIONS')}${button('menu', 'RETURN TO MENU')}`));
}
function showTransmission(transmission: Transmission, next: () => void) {
  transmissionNext = next;
  setScreen('transmission', panel('INTERCEPTED TRANSMISSION', escape(transmission.title), `<div class="transmission-meta"><span>${escape(transmission.sender)}</span><small>${escape(transmission.frequency)}</small></div><div class="transmission-wave" aria-hidden="true">▁▂▁▅▃▇▂▃▁▆▂▁▅▇▃▁▂▅▃▁▆▂▁</div><div class="transmission-text">${escape(transmission.text).split('\n\n').map(p => `<p>${p.replaceAll('\n', '<br>')}</p>`).join('')}</div>${button('transmission-next', next !== showArchive ? 'ACKNOWLEDGE <span>→</span>' : 'CLOSE CHANNEL <span>→</span>', true)}`, 'transmission-panel'));
}
function showArchive() {
  setScreen('archive', panel('INTERCEPT ARCHIVE', 'Transmissions.', `<p>Fragments recovered beyond the perimeter.</p><div class="archive-list">${TRANSMISSIONS.map((t, index) => { const unlocked = save.unlockedTransmissions.includes(t.id); return `<button class="archive-item" data-transmission="${t.id}" ${unlocked ? '' : 'disabled'}><span>${pad(index + 1)}</span><div><b>${unlocked ? escape(t.title) : 'ENCRYPTED SIGNAL'}</b><small>${unlocked ? escape(t.sender) : `RECOVER AFTER SECTOR ${pad(t.afterLevel)}`}</small></div><i>${unlocked ? '↗' : '⊘'}</i></button>`; }).join('')}</div>${button('archive-back', 'RETURN <span>←</span>')}`));
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
  setScreen('hangar', panel('KOSMOFLOT / PERSONAL HANGAR', 'Build your flight.', `
    <div class="hangar-heading"><p>Choose an airframe. Tune it to your style.</p><button data-action="hangar-back" class="hangar-close" aria-label="Close ship hangar">×</button></div>
    ${playtestControls()}<div class="ship-roster" aria-label="Choose a ship">${(Object.keys(SHIPS) as ShipId[]).map(id => {
      const item = SHIPS[id], available = isShipUnlocked(id, save.hangar.parts);
      return `<button class="ship-card ${hangarShip === id ? 'inspected' : ''} ${available ? '' : 'locked'} ${id}" data-ship="${id}" aria-pressed="${hangarShip === id}" aria-label="${escape(item.name)}, ${available ? save.hangar.selectedShip === id ? 'active ship' : 'select ship' : `locked, ${save.hangar.parts} of ${SHIP_PARTS_REQUIRED} parts`} "><span class="ship-card-status">${available ? save.hangar.selectedShip === id ? '● ACTIVE' : 'SELECT AIRFRAME' : '◇ SALVAGE PROJECT'}</span><img src="${item.art}" alt="${id === 'strelka' ? 'Narrow cyan interceptor' : 'Broad amber corvette'}"/><b>${escape(item.name)}</b><small>${available ? item.className : `${save.hangar.parts} / ${SHIP_PARTS_REQUIRED} PARTS`}</small></button>`;
    }).join('')}</div>
    <div class="hangar-description"><span>${escape(ship.className)}</span><p>${escape(ship.description)}</p><div class="native-weapon"><i></i> STARTING WEAPON <b>${weaponNames[ship.weapon]}</b></div></div>
    <div class="ship-stats" aria-label="${escape(ship.name)} performance"><div><span>HULL</span><b>${stats.maxHp}</b></div><div><span>MOBILITY</span><b>${Math.round(stats.speed / SHIPS.strelka.speed * 100)}<small>%</small></b></div><div><span>FIRE RATE</span><b>${(1 / stats.fireInterval).toFixed(1)}<small>/s</small></b></div><div><span>HIT POWER</span><b>${stats.damage.toFixed(2)}</b></div></div>
    ${unlocked ? '' : `<div class="salvage-project"><div><b>MANTA ASSEMBLY</b><span>${save.hangar.parts} / ${SHIP_PARTS_REQUIRED}</span></div><div class="salvage-meter" role="progressbar" aria-label="Manta parts collected" aria-valuenow="${save.hangar.parts}" aria-valuemin="0" aria-valuemax="${SHIP_PARTS_REQUIRED}">${Array.from({ length: SHIP_PARTS_REQUIRED }, (_, i) => `<i class="${i < save.hangar.parts ? 'collected' : ''}"></i>`).join('')}</div><p>Rare parts drop from sector guardians. Collect ${SHIP_PARTS_REQUIRED} across repeated flights to unlock this airframe. Recovered parts stay with you, even after defeat.</p></div>`}
    ${tuning('handling', handling)}${tuning('reactor', reactors)}
    <div class="hangar-save-note" role="status">${unlocked ? `${escape(ship.name)} selected · tuning saved ${storageAvailable && !playtest ? 'on this device' : 'for this session'}.` : 'Recover the remaining parts to select and tune Manta.'}</div>
    <details class="field-guide"><summary>FIELD GUIDE / WEAPONS & SALVAGE <span>＋</span></summary><p><b>Multishot</b> adds a projectile to every volley. Each pickup stacks for the rest of the sector.</p><p><b>Weapon crates</b> replace your cannon with pulse, piercing lance, or a wide scatter shot. Multishot carries across weapon changes.</p><p><b>Hull</b> takes three hits before your ship explodes. Handling changes speed and the brief protection window after a hit; every setup has three hull points.</p><p><b>Boosts</b> temporarily increase fire rate or attack power. Hull pickups repair damage. Supplies are scarce: choose your moment to collect them.</p><p><b>Each new sector</b> starts with your airframe’s original weapon and no multishot or temporary boosts. Hangar tuning lasts the whole flight.</p><p>Mobility is relative to a standard Strelka. Fire rate is volleys per second before weapon modifiers; hit power is per projectile before weapon modifiers.</p></details>
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
  const settings: [keyof Preferences, string, string][] = [['music', 'Music', 'Orbital synthesizer soundtrack'], ['sfx', 'Sound effects', 'Weapons, impacts & instrumentation'], ['reducedMotion', 'Reduced motion', 'Disable drift, shake & screen flashes']];
  setScreen('settings', panel('FLIGHT CONFIGURATION', 'Settings.', `<p>Calibrate your cockpit.</p><div class="settings-list">${settings.map(([key, label, detail]) => `<label class="setting-row"><span><b>${label}</b><small>${detail}</small></span><input type="checkbox" role="switch" name="${key}" ${save.preferences[key] ? 'checked' : ''}/><i aria-hidden="true"></i></label>`).join('')}</div><div class="fine-print">${playtest ? 'Playtest preferences last for this session.' : 'Preferences are saved on this device.'}</div>${button('settings-back', 'SAVE & RETURN <span>←</span>', true)}`));
}
function showInstall() {
  setScreen('install', panel('TAKE EPOCH WITH YOU', 'Cleared for iPhone.', `<p>Open this game in <b>Safari</b>, tap <b>Share</b>, then <b>Add to Home Screen</b>. Enable “Open as Web App” if offered.</p><p>Launch EPOCH from its icon for a full-screen cockpit. The production build is available offline after its first complete load over HTTPS.</p><div class="install-controls"><b>ONE THUMB. ALL SYSTEMS.</b><p>Touch anywhere and drag. The ship follows your movement without jumping to your finger. Weapons fire automatically. Lift to hold position.</p></div>${button('install-back', 'UNDERSTOOD <span>→</span>', true)}`));
}

const scene = new CombatScene({ onReady: () => { ready = true; if (screen === 'menu') showMenu(); }, onHud, onOutcome, onPause: () => pauseFlight(), onSound: sound => audio.play(sound), onNotice: notice, onShipPart: collectShipPart }, save.preferences);
const game = new Phaser.Game({ type: Phaser.AUTO, parent: 'phaser', width: 480, height: 800, backgroundColor: '#100f1e', antialias: true, powerPreference: 'high-performance', banner: false, audio: { noAudio: true }, fps: { target: 60, forceSetTimeOut: false }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 2, touch: { capture: true } }, scene: [scene] });
applyPreferences(); showMenu();

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!target || target.disabled) return;
  audio.unlock(); audio.play('click');
  const action = target.dataset.action;
  if (action === 'launch' || action === 'retry') startFlight(newFlightCheckpoint(), true);
  else if (action === 'continue' && save.checkpoint) startFlight(save.checkpoint);
  else if (action === 'pause') pauseFlight();
  else if (action === 'resume') { setScreen('playing', '', false); scene.resumeCombat(); document.querySelector<HTMLElement>('#phaser')!.focus(); }
  else if (action === 'menu') showMenu();
  else if (action === 'hangar') { hangarShip = save.hangar.selectedShip; showHangar(); }
  else if (action === 'hangar-back') showMenu();
  else if (action === 'settings') { settingsReturn = screen; showSettings(); }
  else if (action === 'settings-back') { saveProgress(); if (settingsReturn === 'paused') { screen = 'playing'; pauseFlight(); } else showMenu(); }
  else if (action === 'archive') { archiveReturn = screen; showArchive(); }
  else if (action === 'archive-back') { if (archiveReturn === 'victory') showVictory(); else showMenu(); }
  else if (action === 'advance') advance();
  else if (action === 'transmission-next') transmissionNext?.();
  else if (action === 'install') { if (screen === 'playing') pauseFlight(); installReturn = screen; showInstall(); }
  else if (action === 'install-back') { if (installReturn === 'paused') { screen = 'playing'; pauseFlight(); } else showMenu(); }
});
overlay.addEventListener('click', event => {
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
  if (playtest && target.name === 'playtest-sector') {
    playtestSector = Math.min(LEVELS.length, Math.max(1, Number(target.value) || 1));
    if (screen === 'menu') { showMenu(); overlay.querySelector<HTMLElement>('[name="playtest-sector"]')?.focus({ preventScroll: true }); }
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
  if (['music', 'sfx', 'reducedMotion'].includes(target.name)) { save.preferences[target.name as keyof Preferences] = target.checked; applyPreferences(); saveProgress(); }
});
document.querySelector('.studio')!.addEventListener('click', event => { event.preventDefault(); if (screen === 'playing') pauseFlight(); else if (screen !== 'paused') showMenu(); });
document.addEventListener('keydown', event => {
  if (!event.repeat && (event.key === 'Escape' || event.key.toLowerCase() === 'p')) {
    if (screen === 'playing') { event.preventDefault(); pauseFlight(); }
    else if (screen === 'paused') { event.preventDefault(); audio.unlock(); setScreen('playing', '', false); scene.resumeCombat(); }
    else if (event.key === 'Escape' && screen === 'hangar') { event.preventDefault(); showMenu(); overlay.querySelector<HTMLElement>('[data-action="hangar"]')?.focus({ preventScroll: true }); }
  }
  // Trap focus inside overlays while retaining native keyboard activation and switches.
  if (event.key === 'Tab' && screen !== 'playing') {
    const controls = [...overlay.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary')];
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
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => notice('Offline cache unavailable · online play is ready')); });
if (import.meta.env.DEV) {
  Object.assign(window, { __EPOCH__: { snapshot: () => ({ screen, playtest, save: structuredClone(save), hud: lastHud, combat: scene.getDebugState() }), debug: (action: string, payload?: Record<string, unknown>) => scene.debug(action, payload), scene, game } });
}
