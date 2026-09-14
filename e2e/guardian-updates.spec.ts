import { test, expect } from '@playwright/test';

async function launch(page: any) {
  await page.goto('/');
  await page.locator('[data-action="launch"]').click();
  await page.waitForFunction(() => (window as any).__EPOCH__?.snapshot().combat.mode === 'combat');
}

test('a fired enemy shot survives the last kill and still damages the player', async ({ page }) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    scene.clearRun();
    scene.nextFire = Infinity;
    scene.invulnerable = 0;
    scene.debug('enemy', { kind: 'shooter', hp: 1 });
    const enemy = scene.enemies[0];
    enemy.x = enemy.px = enemy.tx = 240;
    enemy.y = enemy.py = enemy.ty = 350;
    enemy.shotAt = enemy.age;
    scene.updateEnemies(1 / 60);
    const shot = scene.bullets.find((item: any) => item.hostile);
    const origin = { x: shot.x, y: shot.y };
    scene.fireProjectile(enemy.x, enemy.y + 25, 0, -600, false, 100);
    scene.updateProjectiles(1 / 60);
    scene.waveIndex = 1;
    scene.completedWaves = 0;
    scene.updateWaveProgression();
    const survived = scene.bullets.includes(shot) && shot.sprite.active;
    const hp = scene.hp;
    for (let frame = 0; frame < 180; frame++) scene.updateProjectiles(1 / 60);
    return { survived, origin, moved: shot.y > origin.y, hpBefore: hp, hpAfter: scene.hp, aliveEnemies: scene.enemies.length, shape: shot.shape };
  });
  expect(result.aliveEnemies).toBe(0);
  expect(result.survived).toBe(true);
  expect(result.moved).toBe(true);
  expect(result.hpAfter).toBe(result.hpBefore - 1);
  expect(result.shape).toBe('diamond');
});

test('guardian death preserves mines and bullets and completion waits for their danger to pass', async ({ page }) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    scene.clearRun();
    scene.nextFire = Infinity;
    scene.debug('boss');
    scene.invulnerable = 0;
    scene.fireProjectile(240, 622, 0, 150, true, 1);
    scene.fireProjectile(80, 320, 0, 35, true, 1, 1, 'mine', {
      x: 80, y: 320, vx: 0, vy: 35, shape: 'mine', burstAfter: 1.4, lifetime: 5,
    });
    scene.debug('destroyBoss');
    const hpBefore = scene.hp;
    scene.update(0, 1000 / 60);
    const afterDeath = scene.getDebugState();
    for (let frame = 0; frame < 100; frame++) scene.update(0, 1000 / 60);
    const afterBurst = scene.getDebugState();
    scene.invulnerable = 100;
    for (let frame = 0; frame < 720 && scene.mode === 'combat'; frame++) scene.update(0, 1000 / 60);
    return { hpBefore, afterDeath, afterBurst, final: scene.getDebugState() };
  });
  expect(result.afterDeath.mode).toBe('combat');
  expect(result.afterDeath.bullets.hostile).toBeGreaterThan(0);
  expect(result.afterBurst.hp).toBe(result.hpBefore - 1);
  expect(result.afterBurst.mode).toBe('combat');
  expect(result.afterBurst.hostileShots.some((shot: any) => shot.shape === 'shard')).toBe(true);
  expect(result.final.mode).toBe('ended');
  expect(result.final.bullets.hostile).toBe(0);
});

test('player airframes and weapons fire distinct persistent silhouettes', async ({ page }) => {
  await launch(page);
  const shots = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop(); scene.clearRun();
    const result = [];
    for (const ship of ['strelka', 'manta']) {
      scene.shipId = ship;
      for (const weapon of ['pulse', 'lance', 'scatter']) {
        scene.weapon = weapon;
        scene.fireProjectile(200, 500, 0, -600, false, 1);
        const shot = scene.bullets.at(-1);
        result.push({ ship, weapon, shape: shot.shape, texture: shot.sprite.texture.key });
      }
    }
    scene.weapon = 'pulse'; scene.shipId = 'strelka';
    scene.updateProjectiles(1 / 60);
    return { fired: result, after: scene.getDebugState().friendlyShots };
  });
  expect(new Set(shots.fired.map((shot: any) => shot.texture)).size).toBe(6);
  expect(shots.after.map((shot: any) => shot.shape)).toEqual(shots.fired.map((shot: any) => shot.shape));
});

test('every guardian uses a frozen warning plan and its own mechanic', async ({ page }) => {
  await launch(page);
  const plans = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    const results = [];
    for (const kind of ['warden', 'twins', 'carrier', 'lattice', 'koschei']) {
      scene.clearRun();
      scene.bossSpawned = false;
      scene.bossDefeated = false;
      scene.level = { ...scene.level, boss: { name: kind, kind, hp: 1000 } };
      scene.spawnBoss();
      const enemy = scene.enemies[0];
      enemy.age = enemy.entry + 1;
      enemy.attackAt = enemy.age;
      scene.updateBoss(enemy, 0);
      const first = JSON.stringify(enemy.attackPlan);
      const plan = enemy.attackPlan;
      scene.player.setPosition(55, 720);
      enemy.age += plan.warningSeconds / 2;
      scene.updateBoss(enemy, 0);
      const frozen = first === JSON.stringify(enemy.attackPlan);
      const shotsBefore = scene.bullets.length;
      enemy.age = enemy.telegraph + 0.01;
      scene.updateBoss(enemy, 0);
      results.push({ kind, frozen, warning: plan.warningSeconds, name: plan.name, shotsBefore,
        shots: scene.getDebugState().hostileShots, portals: plan.portals?.length ?? 0,
        safeLane: plan.safeLane, mines: plan.shots.filter((shot: any) => shot.burstAfter).length,
        turns: plan.shots.filter((shot: any) => shot.turnRate).length });
    }
    return results;
  });
  expect(new Set(plans.map((plan: any) => plan.name)).size).toBe(5);
  for (const plan of plans) {
    expect(plan.frozen).toBe(true);
    expect(plan.warning).toBeGreaterThanOrEqual(1);
    expect(plan.shotsBefore).toBe(0);
    expect(plan.shots.length).toBeGreaterThan(0);
  }
  expect(plans.find((plan: any) => plan.kind === 'twins')?.turns).toBeGreaterThan(0);
  expect(plans.find((plan: any) => plan.kind === 'carrier')?.mines).toBeGreaterThan(0);
  expect(plans.find((plan: any) => plan.kind === 'lattice')?.safeLane?.width).toBeGreaterThanOrEqual(60);
  expect(plans.find((plan: any) => plan.kind === 'koschei')?.portals).toBeGreaterThan(0);
});

test('Supercharge gives six seconds of max firepower without replacing earned upgrades', async ({ page }) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop(); scene.clearRun();
    scene.nextFire = Infinity;
    scene.invulnerable = 100;
    for (let count = 0; count < 3; count++) scene.applyPickup('multishot');
    scene.applyPickup('supercharge');
    const boosted = scene.getDebugState();
    scene.debug('fire');
    const damage = scene.bullets[0].damage;
    scene.applyPickup('multishot');
    scene.pauseCombat();
    for (let frame = 0; frame < 120; frame++) scene.update(0, 1000 / 60);
    const paused = scene.getDebugState();
    scene.resumeCombat();
    scene.elapsed += 5.9; scene.updatePlayer(0);
    const almost = scene.getDebugState();
    scene.elapsed += 0.2; scene.updatePlayer(0);
    const expired = scene.getDebugState();
    scene.emitHud();
    return { boosted, paused, almost, expired, damage, retainedShotDamage: scene.bullets[0].damage };
  });
  expect(result.boosted.multishot).toBe(3);
  expect(result.boosted.projectiles).toBe(8);
  expect(result.boosted.effectiveWeaponPower).toBe(12);
  expect(result.boosted.blastMultiplier).toBe(2.25);
  expect(result.paused.elapsed).toBe(result.boosted.elapsed);
  expect(result.almost.projectiles).toBe(8);
  expect(result.expired.multishot).toBe(4);
  expect(result.expired.projectiles).toBe(5);
  expect(result.expired.effectiveWeaponPower).toBe(4);
  expect(result.expired.blastMultiplier).toBe(1);
  expect(result.retainedShotDamage).toBe(result.damage);
  await expect(page.locator('.weapon-power-readout')).toContainText(/4\s*\/\s*12/);
  await expect(page.locator('.supercharge-readout')).toHaveCount(0);
});

test('Supercharge refreshes rather than stacking and clears at the next level', async ({ page }) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    scene.applyPickup('supercharge');
    scene.elapsed += 2;
    scene.applyPickup('supercharge');
    const remaining = scene.buffs.supercharge - scene.elapsed;
    const before = scene.getDebugState();
    scene.startRun({ level: 2, score: 0, hp: 3 });
    return { remaining, before, after: scene.getDebugState() };
  });
  expect(result.remaining).toBeCloseTo(6, 10);
  expect(result.before.effectiveWeaponPower).toBe(12);
  expect(result.after.effectiveWeaponPower).toBe(0);
  expect(result.after.buffs.supercharge).toBeUndefined();
});

test('other shots keep moving through player destruction while the impact shot is consumed', async ({ page }) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop(); scene.clearRun();
    scene.nextFire = Infinity;
    scene.hp = 1; scene.invulnerable = 0;
    scene.fireProjectile(55, 400, 0, -60, false, 1);
    const friendly = scene.bullets[0];
    scene.fireProjectile(240, 625, 0, 500, true, 1);
    const impact = scene.bullets.at(-1);
    scene.updateProjectiles(0.05);
    const dying = scene.mode;
    const impactRemoved = !scene.bullets.includes(impact);
    const before = friendly.y;
    scene.update(0, 50);
    const moving = friendly.y < before && friendly.sprite.active;
    for (let frame = 0; frame < 600; frame++) scene.update(0, 1000 / 60);
    return { dying, impactRemoved, moving, mode: scene.mode, shots: scene.bullets.length };
  });
  expect(result.dying).toBe('dying');
  expect(result.impactRemoved).toBe(true);
  expect(result.moving).toBe(true);
  expect(result.mode).toBe('ended');
  expect(result.shots).toBe(0);
});
