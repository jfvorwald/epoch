import { test, expect } from '@playwright/test';

async function launch(page: any) {
  await page.goto('/');
  await page.locator('[data-action="launch"]:not(:disabled)').click();
  await page.waitForFunction(() => (window as any).__EPOCH__?.snapshot().combat.mode === 'combat');
}

test('all predicted enemy routes and attacks are opt-in, including during pause', async ({ page }, info) => {
  await launch(page);
  const results = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    const results = [];
    for (const kind of ['returning', 'asteroid', 'shooter', 'warden', 'twins', 'carrier', 'lattice', 'koschei', 'live-mine']) {
      scene.clearRun();
      scene.mode = 'combat';
      scene.nextFire = Infinity;
      if (['returning', 'asteroid', 'shooter'].includes(kind)) {
        scene.spawnWave({ at: 0, kind: kind === 'asteroid' ? 'debris' : kind === 'shooter' ? 'shooter' : 'straight',
          formation: 'line', count: 1, hp: 5, speed: 160, hold: 2 }, 0);
        const enemy = scene.enemies[0];
        if (kind === 'returning') scene.returnEnemy(enemy);
        if (kind === 'shooter') {
          enemy.x = 240; enemy.y = 250; enemy.age = 5; enemy.telegraph = 6; enemy.attackAngle = Math.PI / 2;
        } else enemy.age = -0.5;
      } else if (kind === 'live-mine') {
        scene.fireProjectile(240, 300, 0, 180, true, 1, 1, 'mine', {
          x: 240, y: 300, vx: 0, vy: 180, shape: 'mine', burstAfter: 1.5, lifetime: 5,
        });
      } else {
        scene.level = { ...scene.level, boss: { name: kind, kind, hp: 1000 } };
        scene.bossSpawned = false;
        scene.spawnBoss();
        const enemy = scene.enemies[0];
        enemy.age = enemy.entry + 1; enemy.attackAt = enemy.age;
        scene.updateBoss(enemy, 0);
      }
      scene.setPreferences({ ...scene.preferences, trainingWheels: false });
      const off = scene.bossTelegraph.commandBuffer.length;
      const frozen = JSON.stringify({ enemies: scene.getDebugState().enemies, shots: scene.getDebugState().hostileShots });
      scene.pauseCombat();
      scene.setPreferences({ ...scene.preferences, trainingWheels: true });
      const on = scene.bossTelegraph.commandBuffer.length;
      scene.setPreferences({ ...scene.preferences, trainingWheels: false });
      const disabledWhilePaused = scene.bossTelegraph.commandBuffer.length;
      const after = JSON.stringify({ enemies: scene.getDebugState().enemies, shots: scene.getDebugState().hostileShots });
      results.push({ kind, off, on, disabledWhilePaused, simulationUnchanged: frozen === after });
    }
    return results;
  });
  for (const result of results) {
    // Koschei's real black holes remain visible; every predicted path is optional.
    if (result.kind === 'koschei') expect(result.off).toBeGreaterThan(0);
    else expect(result.off).toBe(0);
    expect(result.on).toBeGreaterThan(result.off);
    expect(result.disabledWhilePaused).toBe(result.off);
    expect(result.simulationUnchanged).toBe(true);
  }

  // Capture identical Lattice windups to review actual off/on rendering.
  await page.evaluate(() => {
    const { scene } = (window as any).__EPOCH__;
    scene.startRun({ level: 4, score: 0, hp: 3 });
    scene.nextFire = Infinity;
    scene.debug('boss');
    for (const enemy of scene.enemies) {
      enemy.age = enemy.entry + 1; enemy.attackAt = enemy.age; scene.updateBoss(enemy, 0);
      enemy.sprite.setPosition(enemy.x, enemy.y);
    }
    scene.pauseCombat();
    document.querySelector('#overlay')!.setAttribute('hidden', '');
  });
  for (const enabled of [false, true]) {
    await page.evaluate(enabled => {
      const { scene, game } = (window as any).__EPOCH__;
      scene.setPreferences({ ...scene.preferences, trainingWheels: enabled });
      game.step(performance.now(), 0);
    }, enabled);
    await page.locator('#game-stage').screenshot({ path: info.outputPath(`training-wheels-${enabled ? 'on' : 'off'}.png`) });
  }
});

test('removing guides preserves guardian shots, returning enemies and wave gating', async ({ page }) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop(); scene.clearRun();
    scene.setPreferences({ ...scene.preferences, trainingWheels: false });
    scene.nextFire = Infinity;
    scene.spawnWave({ at: 0, kind: 'straight', formation: 'line', count: 1, hp: 5, speed: 160, hold: 1 }, 0);
    const enemy = scene.enemies[0];
    const hp = enemy.hp;
    enemy.age = enemy.entry + enemy.hold + 1;
    enemy.dive = true; enemy.y = 900; enemy.vy = enemy.speed;
    scene.updateEnemies(1 / 60);
    scene.waveIndex = 1; scene.completedWaves = 0;
    scene.updateWaveProgression();
    const returned = { returns: enemy.returns, hp: enemy.hp, hpBefore: hp, wave: scene.waveIndex, count: scene.enemies.length };
    scene.clearRun();
    scene.level = { ...scene.level, boss: { name: 'Koschei', kind: 'koschei', hp: 1000 } };
    scene.bossSpawned = false; scene.spawnBoss();
    const boss = scene.enemies[0];
    boss.age = boss.entry + 1; boss.attackAt = boss.age;
    scene.updateBoss(boss, 0);
    const expectedShots = boss.attackPlan.shots.length;
    boss.age = boss.telegraph + 0.01;
    scene.updateBoss(boss, 0); scene.drawBossTelegraph();
    return { returned, shots: scene.getDebugState().hostileShots.length, expectedShots,
      portals: scene.guardianPortals.length, visiblePortals: scene.bossTelegraph.commandBuffer.length > 0 };
  });
  expect(result.returned).toMatchObject({ returns: 1, hp: 5, hpBefore: 5, wave: 1, count: 1 });
  expect(result.shots).toBe(result.expectedShots);
  expect(result.shots).toBeGreaterThan(0);
  expect(result.portals).toBe(2);
  expect(result.visiblePortals).toBe(true);
});

test('first-wave enemies take four or five actual unupgraded pulse hits', async ({ page }) => {
  await launch(page);
  const results = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    const results = [];
    for (const level of [1, 2, 3, 4, 5, 6, 15, 25, 50, 51, 100, 1000]) {
      scene.startRun({ level, hp: 3, score: 0, shipId: 'strelka', loadout: { handling: 'balanced', reactor: 'balanced' } });
      scene.clearRun(); scene.weapon = 'pulse'; scene.nextFire = Infinity;
      scene.spawnWave({ ...scene.level.waves[0], count: 1, powerUpDrops: 0, drop: undefined }, 0);
      const enemy = scene.enemies[0];
      enemy.x = enemy.px = 240; enemy.y = enemy.py = 300; enemy.age = enemy.entry + 1;
      let hits = 0;
      while (scene.enemies.length && hits < 10) {
        scene.fireProjectile(240, 310, 0, -680, false, scene.stats.damage);
        scene.updateProjectiles(1 / 60);
        hits++;
      }
      results.push({ level, hits, remaining: scene.enemies.length });
    }
    return results;
  });
  for (const result of results) {
    expect(result.remaining).toBe(0);
    expect(result.hits).toBeGreaterThanOrEqual(4);
    expect(result.hits).toBeLessThanOrEqual(5);
  }
});
