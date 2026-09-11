import Phaser from 'phaser';
import { CombatScene } from './game/CombatScene';
import { AudioSystem } from './game/audio';
import { loadSave, persistSave } from './game/save';
import { LEVELS } from './data/levels';
import { TRANSMISSIONS } from './data/transmissions';
import type { Checkpoint, HudState, Outcome, Preferences, Transmission } from './game/types';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const save = loadSave();
let hasStoredPreferences = false;
try { hasStoredPreferences = !!localStorage.getItem('epoch.browser.save.v1'); } catch { /* session only */ }
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
const pad = (n: number, width = 2) => n.toString().padStart(width, '0');
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

app.innerHTML = `
  <header class="masthead"><a class="studio" href="#" aria-label="EPOCH main menu"><img src="/art/emblem.svg" alt=""/>JAQ <span>STUDIOS</span></a><div class="masthead-center">ORBITAL DEFENSE PROGRAM <span> / </span> EST. 2049</div><div class="live-label"><i></i> STRELKA SYSTEM ONLINE</div></header>
  <main class="flight-deck">
    <aside class="sidebar left-side"><div class="eyebrow">KOSMOFLOT FLIGHT ARCHIVE</div><h2>Beyond<br>the static<br><em>wall.</em></h2><p>The old world went silent.<br>Something is still transmitting.</p><div class="rail-divider"></div><div class="micro-label">ACTIVE AIRFRAME</div><div class="airframe-name">STRELKA—9 <span>09</span></div><div class="spec-row"><span>PILOT</span><b>VOSS</b></div><div class="spec-row"><span>CLASS</span><b>INTERCEPTOR</b></div><div class="spec-row"><span>STATUS</span><b class="cyan">FLIGHT READY</b></div><div class="side-wave"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="micro-label faint">141.80 MHZ / SIGNAL ACQUIRED</div></aside>
    <section class="console" aria-label="EPOCH game">
      <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
      <div id="game-stage"><div id="phaser" aria-label="Combat playfield. Drag to move; weapons fire automatically." role="application" tabindex="0"></div><div id="menu-backdrop"><div class="orbit-line"></div><img class="hero-ship" src="/art/strelka.svg" alt="Strelka-9 angular armored spacecraft with cyan engines"/><div class="ship-callout"><span>СТРЕЛКА—9</span><i></i><small>FLIGHT UNIT 09</small></div></div><div id="hud" hidden></div><button id="pause-control" class="pause-button" data-action="pause" aria-label="Pause game" hidden>Ⅱ</button><div id="overlay"></div><div id="notice" role="status" aria-live="polite"></div><div id="damage-flash"></div></div>
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
  if (value !== 'playing') noticeEl.classList.remove('visible');
  if (focus) window.requestAnimationFrame(() => overlay.querySelector<HTMLElement>('button:not(:disabled), input')?.focus({ preventScroll: true }));
}
function panel(kicker: string, title: string, body: string, extraClass = '') {
  return `<div class="panel ${extraClass}"><div class="panel-mark">＋ <span>STRELKA / FLIGHT COMPUTER</span> ＋</div><div class="eyebrow">${kicker}</div><h2>${title}</h2>${body}<div class="panel-bottom">MIRNY—7 <span>SECURE CHANNEL / 09</span></div></div>`;
}
function button(action: string, text: string, primary = false, disabled = false) { return `<button data-action="${action}" class="${primary ? 'primary-button' : 'secondary-button'}" ${disabled ? 'disabled' : ''}>${text}</button>`; }
function showMenu() {
  scene.showMenu(); hud.hidden = true;
  lastHud = undefined;
  const checkpoint = save.checkpoint;
  setScreen('menu', `<div class="menu-topline"><span><i class="signal-dot"></i> INCOMING SIGNAL</span><span>001 / 005</span></div><div class="title-block"><div class="eyebrow">JAQ STUDIOS PRESENTS</div><h1>EPOCH</h1><div class="title-rule"><i></i><span>THE SIGNAL IS CALLING</span><i></i></div></div><div class="menu-actions"><div class="mission-mini"><span>VOSS / STRELKA—9</span><span>ALL SYSTEMS NOMINAL</span></div>${button('launch', `<span>LAUNCH</span><span class="button-detail">NEW FLIGHT <b>↗</b></span>`, true, !ready)}${button('continue', `<span>CONTINUE</span><span class="button-detail">${checkpoint ? `SECTOR ${pad(checkpoint.level)} →` : 'NO FLIGHT RECORDED'}</span>`, false, !ready || !checkpoint)}<div class="menu-secondary">${button('archive', '≋ &nbsp; TRANSMISSIONS')} ${button('settings', '⊙ &nbsp; SETTINGS')}</div><div class="menu-records"><div><span>BEST SCORE</span><strong>${pad(save.bestScore, 6)}</strong></div><span class="record-divider"></span><div><span>FURTHEST SECTOR</span><strong>${pad(save.furthestSector)} <small>/ 05</small></strong></div></div><div class="menu-hint">DRAG TO MOVE <span>·</span> AUTO-FIRE ENGAGED</div><button data-action="install" class="mobile-install">ADD TO HOME SCREEN ↗</button></div>`, false);
  updateSectorMap(0);
}
function startFlight(checkpoint: Checkpoint, fresh = false) {
  audio.unlock();
  if (fresh) { save.checkpoint = null; saveProgress(); }
  pending = undefined; lastAnnouncement = ''; hud.hidden = false;
  setScreen('playing', '', false);
  scene.startRun({ ...checkpoint });
  document.querySelector<HTMLElement>('#phaser')!.focus({ preventScroll: true });
  updateSectorMap(checkpoint.level);
}
function pauseFlight(backgrounded = false) {
  if (screen !== 'playing') return;
  scene.pauseCombat();
  audio.suspend();
  setScreen('paused', panel('FLIGHT SUSPENDED', 'Hold position.', `<p>${backgrounded ? 'Your flight was paused while you were away.' : 'Engines at idle. Your position is secure.'}</p><div class="pause-stats"><span>SECTOR ${pad(lastHud?.level ?? 1)}</span><span>${pad(lastHud?.score ?? 0, 6)} PTS</span></div>${button('resume', 'RESUME FLIGHT <span>→</span>', true)}${button('settings', 'SETTINGS')}${button('menu', 'RETURN TO MENU')}<p class="fine-print">Continue returns to the last secured sector. Current sector progress is not saved.</p>`));
}
function onHud(state: HudState) {
  if (lastHud && state.hp < lastHud.hp && !save.preferences.reducedMotion) { stage.classList.remove('hit'); void stage.offsetWidth; stage.classList.add('hit'); }
  lastHud = state;
  hud.innerHTML = `<div class="hud-top"><div class="health-block"><div class="micro-label">STRELKA—9 <span>HULL</span></div><div class="health-bars" aria-label="Health ${state.hp} of ${state.maxHp}">${Array.from({ length: state.maxHp }, (_, i) => `<i class="${i < state.hp ? 'full' : ''}"></i>`).join('')}<small>${state.hp}/${state.maxHp}</small></div></div><div class="hud-score"><span>SCORE</span><b>${pad(state.score, 6)}</b></div></div><div class="hud-sector"><span>SECTOR ${pad(state.level)} <b>${escape(LEVELS[state.level - 1].name)}</b></span><span>${pad(state.wave)}/${pad(state.totalWaves)}</span></div><div class="sector-progress"><i style="width:${Math.min(100, state.progress * 100)}%"></i></div>${state.bossHp !== undefined ? `<div class="boss-hud"><span>⚠ ${escape(state.bossName ?? 'COMMAND ARRAY')}</span><div><i style="width:${100 * state.bossHp / (state.bossMaxHp || 1)}%"></i></div></div>` : ''}<div class="buffs">${Object.entries(state.buffs).filter(([, time]) => time! > 0).map(([name, time]) => `<div class="buff ${name}"><b>${name === 'rapid' ? 'R' : name === 'spread' ? 'S' : 'D'}</b><span>${name === 'damage' ? 'OVERCHARGE' : name.toUpperCase()}<i style="width:${time! / 8 * 100}%"></i></span><small>${Math.ceil(time!)}s</small></div>`).join('')}</div><div class="bottom-instruments"><span><i></i> AUTO-FIRE</span><span>VOSS // FLIGHT ${pad(state.level)}</span></div>`;
  const announcement = state.hp <= 2 ? `Hull critical. ${state.hp} health remaining.` : '';
  if (announcement && announcement !== lastAnnouncement) { lastAnnouncement = announcement; notice(announcement); }
}
function updateSectorMap(level: number) { document.querySelectorAll<HTMLElement>('.sector-map').forEach(el => { const sector = Number(el.dataset.sector); el.classList.toggle('active', sector === level); el.classList.toggle('charted', sector < save.furthestSector); }); }
function onOutcome(outcome: Outcome) {
  pending = outcome;
  save.bestScore = Math.max(save.bestScore, outcome.score);
  save.furthestSector = Math.max(save.furthestSector, outcome.level);
  if (outcome.type === 'defeat') {
    saveProgress();
    setScreen('defeat', panel('TELEMETRY LOST / VOSS', 'Signal lost.', `<p>The Strelka-9 has gone dark.<br>The Signal is still out there.</p><div class="result-score"><span>FINAL SCORE</span><strong>${pad(outcome.score, 6)}</strong></div><div class="result-grid"><div>SECTOR REACHED<b>${pad(outcome.level)} / 05</b></div><div>HOSTILES CLEARED<b>${pad(outcome.kills)}</b></div></div>${button('retry', 'RETRY FLIGHT <span>↗</span>', true)}${save.checkpoint ? button('continue', `CONTINUE AT SECTOR ${pad(save.checkpoint.level)}`) : ''}${button('menu', 'RETURN TO MENU')}`, 'defeat-panel'));
    return;
  }
  const level = LEVELS[outcome.level - 1];
  const transmission = TRANSMISSIONS.find(t => t.id === level.transmissionId);
  if (transmission && !save.unlockedTransmissions.includes(transmission.id)) save.unlockedTransmissions.push(transmission.id);
  save.checkpoint = outcome.level < LEVELS.length ? { level: outcome.level + 1, score: outcome.score, hp: Math.min(5, outcome.hp + 1) } : null;
  save.furthestSector = Math.max(save.furthestSector, save.checkpoint?.level ?? outcome.level);
  saveProgress();
  setScreen('complete', panel(`SECTOR ${pad(outcome.level)} / ${escape(level.name)}`, 'Airspace secured.', `<div class="completion-symbol">⌁</div><p>${outcome.level === 5 ? 'The command array is silent.<br>A new transmission breaks through.' : 'Hostile formation dispersed.<br>Hull serviced. Flight data recorded.'}</p><div class="result-score"><span>FLIGHT SCORE</span><strong>${pad(outcome.score, 6)}</strong></div><div class="checkpoint-label">${outcome.level === 5 ? 'ALL FIVE SECTORS CLEARED' : `${storageAvailable ? '✓ CHECKPOINT SAVED' : 'SESSION CHECKPOINT ONLY'} · SECTOR ${pad(outcome.level + 1)}`}</div>${storageAvailable ? '' : '<p class="fine-print">Device storage is unavailable. Progress will be lost when this page closes.</p>'}${button('advance', transmission ? 'DECODE TRANSMISSION <span>≋</span>' : 'NEXT SECTOR <span>→</span>', true)}${button('menu', 'RETURN TO MENU')}`));
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
function showSettings() {
  const settings: [keyof Preferences, string, string][] = [['music', 'Music', 'Orbital synthesizer soundtrack'], ['sfx', 'Sound effects', 'Weapons, impacts & instrumentation'], ['reducedMotion', 'Reduced motion', 'Disable drift, shake & screen flashes']];
  setScreen('settings', panel('FLIGHT CONFIGURATION', 'Settings.', `<p>Calibrate your cockpit.</p><div class="settings-list">${settings.map(([key, label, detail]) => `<label class="setting-row"><span><b>${label}</b><small>${detail}</small></span><input type="checkbox" role="switch" name="${key}" ${save.preferences[key] ? 'checked' : ''}/><i aria-hidden="true"></i></label>`).join('')}</div><div class="fine-print">Preferences are saved on this device.</div>${button('settings-back', 'SAVE & RETURN <span>←</span>', true)}`));
}
function showInstall() {
  setScreen('install', panel('TAKE EPOCH WITH YOU', 'Cleared for iPhone.', `<p>Open this game in <b>Safari</b>, tap <b>Share</b>, then <b>Add to Home Screen</b>. Enable “Open as Web App” if offered.</p><p>Launch EPOCH from its icon for a full-screen cockpit. The production build is available offline after its first complete load over HTTPS.</p><div class="install-controls"><b>ONE THUMB. ALL SYSTEMS.</b><p>Touch anywhere and drag. The ship follows your movement without jumping to your finger. Weapons fire automatically. Lift to hold position.</p></div>${button('install-back', 'UNDERSTOOD <span>→</span>', true)}`));
}

const scene = new CombatScene({ onReady: () => { ready = true; if (screen === 'menu') showMenu(); }, onHud, onOutcome, onPause: () => pauseFlight(), onSound: sound => audio.play(sound), onNotice: notice }, save.preferences);
const game = new Phaser.Game({ type: Phaser.AUTO, parent: 'phaser', width: 480, height: 800, backgroundColor: '#100f1e', antialias: true, powerPreference: 'high-performance', banner: false, audio: { noAudio: true }, fps: { target: 60, forceSetTimeOut: false }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { activePointers: 2, touch: { capture: true } }, scene: [scene] });
applyPreferences(); showMenu();

document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!target || target.disabled) return;
  audio.unlock(); audio.play('click');
  const action = target.dataset.action;
  if (action === 'launch' || action === 'retry') startFlight({ level: 1, score: 0, hp: 5 }, true);
  else if (action === 'continue' && save.checkpoint) startFlight(save.checkpoint);
  else if (action === 'pause') pauseFlight();
  else if (action === 'resume') { setScreen('playing', '', false); scene.resumeCombat(); document.querySelector<HTMLElement>('#phaser')!.focus(); }
  else if (action === 'menu') showMenu();
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
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-transmission]');
  if (!target || target.disabled) return;
  const t = TRANSMISSIONS.find(t => t.id === target.dataset.transmission);
  if (t) { audio.unlock(); audio.play('click'); showTransmission(t, showArchive); }
});
overlay.addEventListener('change', event => {
  const target = event.target as HTMLInputElement;
  if (['music', 'sfx', 'reducedMotion'].includes(target.name)) { save.preferences[target.name as keyof Preferences] = target.checked; applyPreferences(); saveProgress(); }
});
document.querySelector('.studio')!.addEventListener('click', event => { event.preventDefault(); if (screen === 'playing') pauseFlight(); else if (screen !== 'paused') showMenu(); });
document.addEventListener('keydown', event => {
  if (!event.repeat && (event.key === 'Escape' || event.key.toLowerCase() === 'p')) {
    if (screen === 'playing') { event.preventDefault(); pauseFlight(); }
    else if (screen === 'paused') { event.preventDefault(); audio.unlock(); setScreen('playing', '', false); scene.resumeCombat(); }
  }
  // Trap focus inside overlays while retaining native keyboard activation and switches.
  if (event.key === 'Tab' && screen !== 'playing') {
    const controls = [...overlay.querySelectorAll<HTMLElement>('button:not(:disabled), input')];
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
  Object.assign(window, { __EPOCH__: { snapshot: () => ({ screen, save: structuredClone(save), hud: lastHud, combat: scene.getDebugState() }), debug: (action: string, payload?: Record<string, unknown>) => scene.debug(action, payload), scene, game } });
}
