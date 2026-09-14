/** Local development visual review with Training Wheels enabled. Start Vite first; no player saves are written. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.EPOCH_BASE_URL ?? 'http://127.0.0.1:5173/';
const output = process.env.EPOCH_GUARDIAN_OUTPUT ?? '/tmp/epoch-guardian-review';
const url = new URL(baseURL);
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'Guardian review only runs against local development');
url.searchParams.set('playtest', '1');
const browser = await chromium.launch({ channel: 'chrome' });
try {
  await mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url.href);
  await page.locator('[data-action="launch"]:not(:disabled)').waitFor();
  await page.locator('[data-action="launch"]').click();
  const initialStorage = await page.evaluate(() => JSON.stringify(localStorage));
  const scenarios = [
    ...[1, 3].flatMap(phase => ['warden', 'twins', 'carrier', 'lattice', 'koschei'].map((kind, index) => ({ kind, phase, level: index + 1, reducedMotion: false }))),
    { kind: 'koschei', phase: 3, level: 5, reducedMotion: true },
    { kind: 'carrier', phase: 3, level: 3, reducedMotion: true },
  ].map(scenario => ({ ...scenario, trainingWheels: true }));
  const records = [], images = [];
  const capture = async (scenario, stage) => {
    const name = `${scenario.kind}-phase-${scenario.phase}${scenario.reducedMotion ? '-reduced' : ''}-${stage}`;
    await page.evaluate(() => {
      const { scene, game } = window.__EPOCH__;
      scene.drawBossTelegraph();
      scene.emitHud();
      scene.pauseCombat();
      game.step(performance.now(), 0);
    });
    const buffer = await page.locator('#game-stage').screenshot({ path: `${output}/${name}.png` });
    const state = await page.evaluate(() => window.__EPOCH__.snapshot().combat);
    assert.equal(state.trainingWheels, true, `${name}: Training Wheels enabled for guide inspection`);
    images.push({ ...scenario, stage, name, src: `data:image/png;base64,${buffer.toString('base64')}` });
    records.push({ ...scenario, stage, file: `${output}/${name}.png`,
      bosses: state.enemies.filter(enemy => enemy.boss).map(enemy => ({ kind: enemy.bossKind, phase: enemy.phase, attack: enemy.attack, cycle: enemy.attackCycle })),
      shots: state.hostileShots.length, shapes: [...new Set(state.hostileShots.map(shot => shot.shape))], portals: state.guardianPortals.length });
    assert.ok(state.enemies.filter(enemy => enemy.boss).every(enemy => enemy.phase === scenario.phase), `${name}: intended guardian phase`);
    return state;
  };
  const advance = seconds => page.evaluate(seconds => {
    const { scene } = window.__EPOCH__;
    scene.resumeCombat();
    for (let tick = 0; tick < Math.ceil(seconds * 60); tick++) scene.update(0, 1000 / 60);
  }, seconds);
  for (const scenario of scenarios) {
    const warning = await page.evaluate(scenario => {
      const { scene, game } = window.__EPOCH__;
      game.loop.stop();
      scene.startRun({ level: scenario.level, hp: 3, score: 0 });
      scene.setPreferences({ ...scene.preferences, reducedMotion: scenario.reducedMotion, trainingWheels: true });
      scene.debug('holdFire');
      scene.debug('invulnerable', { seconds: 999 });
      scene.debug('boss');
      for (const enemy of scene.enemies) if (enemy.boss) enemy.hp = enemy.maxHp * (scenario.phase === 3 ? 0.2 : 1);
      let tick = 0;
      while (tick++ < 600 && !scene.enemies.filter(enemy => enemy.boss).every(enemy => enemy.attackPlan)) scene.update(0, 1000 / 60);
      const bosses = scene.enemies.filter(enemy => enemy.boss);
      if (!bosses.every(enemy => enemy.attackPlan)) throw new Error('Guardian warning failed to start');
      return { kinds: bosses.map(enemy => enemy.bossKind), wait: Math.max(...bosses.map(enemy => enemy.telegraph - enemy.age)),
        warnings: bosses.map(enemy => enemy.attackPlan.warningSeconds), shots: bosses.flatMap(enemy => enemy.attackPlan.shots).length,
        portals: bosses.flatMap(enemy => enemy.attackPlan.portals ?? []).length,
        safeLanes: bosses.map(enemy => enemy.attackPlan.safeLane).filter(Boolean) };
    }, scenario);
    assert.ok(warning.kinds.every(kind => kind === scenario.kind));
    assert.ok(warning.warnings.every(seconds => seconds >= 1));
    if (scenario.kind === 'koschei') assert.equal(warning.portals, 2);
    if (scenario.kind === 'lattice') assert.ok(warning.safeLanes.every(lane => lane.width >= 110));
    await capture(scenario, 'warning');
    await advance(warning.wait + 0.025 + (scenario.kind === 'carrier' ? 0.75 : 1.25));
    const live = await capture(scenario, 'live');
    assert.ok(live.hostileShots.length > 0, `${scenario.kind}: live volley visible`);
    if (scenario.kind === 'koschei') assert.equal(live.guardianPortals.length, 2);
    if (scenario.kind === 'carrier') {
      assert.ok(live.hostileShots.some(shot => shot.shape === 'mine'));
      await advance(1.2);
      const burst = await capture(scenario, 'burst');
      assert.ok(burst.hostileShots.some(shot => shot.shape === 'shard'));
      assert.ok(!burst.hostileShots.some(shot => shot.shape === 'mine'));
    }
  }
  assert.deepEqual(errors, [], 'No browser errors');
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), initialStorage, 'Review does not write saves');
  const sheet = await browser.newPage({ viewport: { width: 1250, height: 970 }, deviceScaleFactor: 1 });
  for (const phase of [1, 3]) {
    const selected = images.filter(image => image.phase === phase && !image.reducedMotion && image.stage !== 'burst');
    const byStage = ['warning', 'live'].flatMap(stage => selected.filter(image => image.stage === stage));
    await sheet.setContent(`<style>body{margin:0;padding:20px;background:#090b12;color:#dce1eb;font:14px system-ui}h1{margin:0 0 6px;font-size:22px}p{margin:0 0 18px;color:#a3afc4}.grid{display:grid;grid-template-columns:repeat(5,240px);gap:10px 2px}.card b{display:block;height:26px;font-size:12px;font-weight:500}.card img{display:block;width:240px;height:400px}</style><h1>EPOCH / GUARDIAN PHASE ${phase} / TRAINING WHEELS ON</h1><p>Top: committed warning paths · Bottom: live hazards · Actual game captures; invulnerability and held fire for inspection.</p><div class="grid">${byStage.map(image => `<div class="card"><b>${image.kind.toUpperCase()} · ${image.stage}</b><img src="${image.src}" /></div>`).join('')}</div>`);
    await sheet.screenshot({ path: `${output}/guardians-phase-${phase}.png`, fullPage: true });
  }
  const report = { localURL: url.href, scenarios: scenarios.length, screenshots: images.length, trainingWheels: true, errors,
    savesUnchanged: true, fixture: 'Training Wheels enabled, held player fire and invulnerability; guardian entry, warnings, trajectories, reinforcements and bursts use integrated gameplay code.',
    limitation: 'Visual and deterministic scenario review; not a human balance assessment or physical iPhone test.', records };
  await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, records: undefined }));
} finally { await browser.close(); }
