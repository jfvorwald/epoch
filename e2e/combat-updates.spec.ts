import { test, expect, type Page } from '@playwright/test';

async function launch(page: Page) {
  await page.goto('/');
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await page.locator('[data-action="launch"]').click();
}

// Deterministic scene stepping exercises real collision and pickup paths without
// waiting for long flights or relying on random enemy/drop timing.
test('weapon power caps at twelve, eight shots then stronger blasts, and survives swaps', async ({ page }) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const flight = (window as any).__EPOCH__;
    const { scene, game } = flight;
    game.loop.stop();
    const collect = (kind: string) => {
      scene.debug('pickup', { kind });
      scene.updatePickups(1 / 60);
    };
    const growth = [scene.getDebugState()];
    for (let i = 0; i < 15; i++) {
      collect('multishot');
      growth.push(scene.getDebugState());
    }
    collect('weapon-scatter');
    collect('spread');
    const buffed = scene.getDebugState();
    scene.debug('expireBuffs');
    const expired = scene.getDebugState();
    collect('weapon-lance');
    return { growth, buffed, expired, swapped: flight.snapshot() };
  });
  expect(result.growth.map((s: any) => s.weaponPower)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 12, 12]);
  expect(result.growth.slice(0, 8).map((s: any) => s.projectiles)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  for (const s of result.growth.slice(8)) expect(s.projectiles).toBe(8);
  expect(result.growth[7].blastMultiplier).toBe(1);
  expect(result.growth[8].blastMultiplier).toBe(1.25);
  expect(result.growth[12].blastMultiplier).toBe(2.25);
  expect(result.buffed.projectiles).toBe(8);
  expect(result.buffed.blastMultiplier).toBeGreaterThan(2.25);
  expect(result.expired.blastMultiplier).toBe(2.25);
  expect(result.swapped.combat.weapon).toBe('lance');
  expect(result.swapped.combat.weaponPower).toBe(12);
  await expect(page.locator('#hud')).toContainText(/12\s*\/\s*12/);
  await expect(page.locator('#hud')).toContainText('MAX');
});

test('Supercharge grants six seconds of max power, refreshes without stacking, and preserves earned arrays', async ({ page }, info) => {
  await launch(page);
  const initial = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    scene.nextFire = Infinity;
    scene.invulnerable = 100;
    for (const kind of ['multishot', 'multishot', 'supercharge', 'multishot', 'weapon-lance']) {
      scene.debug('pickup', { kind });
      scene.updatePickups(1 / 60);
    }
    scene.debug('fire');
    scene.nextFire = Infinity;
    return scene.getDebugState();
  });
  expect(initial.weaponPower).toBe(3);
  expect(initial.effectiveWeaponPower).toBe(12);
  expect(initial.projectiles).toBe(8);
  expect(initial.blastMultiplier).toBe(2.25);
  expect(initial.weapon).toBe('lance');
  expect(initial.friendlyShots.slice(-8).every((shot: any) => shot.weapon === 'lance')).toBe(true);
  await expect(page.locator('.weapon-power-readout')).toHaveAttribute('aria-label', /Weapon power 3 of 12 earned/);
  await expect(page.locator('.supercharge-readout')).toContainText('SUPERCHARGE 12/12');
  await expect(page.locator('.supercharge-readout')).toContainText('6s');
  await page.screenshot({ path: `test-results/supercharge-${info.project.name}.png` });

  const refreshed = await page.evaluate(() => {
    const { scene } = (window as any).__EPOCH__;
    for (let frame = 0; frame < 120; frame++) scene.update(0, 1000 / 60);
    scene.debug('pickup', { kind: 'supercharge' });
    scene.updatePickups(1 / 60);
    return scene.getDebugState();
  });
  expect(refreshed.buffs.supercharge - refreshed.elapsed).toBeCloseTo(6);
  await page.locator('#pause-control').click();
  const paused = await page.evaluate(() => {
    const { scene } = (window as any).__EPOCH__;
    const before = scene.getDebugState();
    for (let frame = 0; frame < 420; frame++) scene.update(0, 1000 / 60);
    return { before, after: scene.getDebugState() };
  });
  expect(paused.after.elapsed).toBe(paused.before.elapsed);
  expect(paused.after.buffs.supercharge).toBe(paused.before.buffs.supercharge);
  await page.locator('[data-action="resume"]').click();

  const expiry = await page.evaluate(() => {
    const { scene } = (window as any).__EPOCH__;
    for (let frame = 0; frame < 354; frame++) scene.update(0, 1000 / 60);
    const before = scene.getDebugState();
    for (let frame = 0; frame < 12; frame++) scene.update(0, 1000 / 60);
    scene.emitHud();
    return { before, after: scene.getDebugState() };
  });
  expect(expiry.before.effectiveWeaponPower).toBe(12);
  expect(expiry.after.buffs.supercharge).toBeUndefined();
  expect(expiry.after.weaponPower).toBe(3);
  expect(expiry.after.effectiveWeaponPower).toBe(3);
  expect(expiry.after.projectiles).toBe(4);
  expect(expiry.after.blastMultiplier).toBe(1);
  expect(expiry.after.weapon).toBe('lance');
  await expect(page.locator('.supercharge-readout')).toHaveCount(0);
});

test('projectiles keep their damage type after a weapon swap and hit weak targets harder', async ({ page }) => {
  await launch(page);
  const damage = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    const results: Record<string, number[]> = {};
    for (const weapon of ['pulse', 'lance', 'scatter']) {
      results[weapon] = [];
      for (const kind of ['straight', 'weaver', 'shooter', 'debris']) {
        scene.clearRun();
        scene.debug('enemy', { hp: 100, kind });
        const enemy = scene.enemies.at(-1);
        enemy.x = enemy.px = 240;
        enemy.y = enemy.py = 550;
        enemy.sprite.setPosition(240, 550);
        scene.weapon = weapon;
        scene.fireProjectile(240, 590, 0, -600, false, 10, 1);
        // A crate collected while the projectile is in flight cannot change it.
        scene.weapon = weapon === 'lance' ? 'pulse' : 'lance';
        for (let frame = 0; frame < 5; frame++) scene.updateProjectiles(1 / 60);
        results[weapon].push(100 - enemy.hp);
      }
    }
    return results;
  });
  expect(damage.pulse).toEqual([10, 16, 10, 10]);
  expect(damage.lance).toEqual([10, 10, 16, 16]);
  expect(damage.scatter).toEqual([16, 10, 10, 10]);
});

test('Edit Ship and parts inventory stay visible across menu, hangar, flight and pause', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /EDIT SHIP/ })).toBeVisible();
  await expect(page.locator('.menu-topline')).toContainText('MAIN MENU');
  await expect(page.locator('.menu-parts')).toHaveAttribute('aria-label', /Ship parts: 0 of 12/);
  await page.getByRole('button', { name: /EDIT SHIP/ }).click();
  await expect(page.locator('#overlay .parts-inventory')).toHaveAttribute('aria-label', /Ship parts: 0 of 12/);
  await page.locator('input[name="handling"][value="agile"]').check();
  await page.getByRole('button', { name: 'Close ship hangar' }).click();
  await expect(page.getByRole('button', { name: /EDIT SHIP/ })).toContainText('agile');
  await page.locator('[data-action="launch"]').click();
  await expect(page.locator('.hud-parts')).toHaveAttribute('aria-label', 'Ship parts 0 of 12');
  await page.evaluate(() => (window as any).__EPOCH__.debug('pickup', { kind: 'ship-part' }));
  await expect(page.locator('.hud-parts')).toHaveAttribute('aria-label', 'Ship parts 1 of 12');
  await page.locator('#pause-control').click();
  await expect(page.locator('#overlay .parts-inventory')).toHaveAttribute('aria-label', /Ship parts: 1 of 12/);
  await page.locator('[data-action="menu"]').click();
  await expect(page.locator('.menu-parts')).toHaveAttribute('aria-label', /Ship parts: 1 of 12/);
  await page.screenshot({ path: `test-results/updated-menu-${info.project.name}.png` });
});

test('the next wave waits for every enemy kill even after its scheduled time', async ({ page }) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    scene.nextFire = Infinity;
    scene.invulnerable = 100;
    const advance = (seconds: number) => {
      for (let t = 0; t < seconds; t += 1 / 60) scene.update(0, 1000 / 60);
    };
    advance(35);
    const waiting = scene.getDebugState();
    // Kill all but one using the actual projectile collision path.
    for (const enemy of [...scene.enemies].slice(1)) {
      enemy.x = enemy.px = 240;
      enemy.y = enemy.py = 300;
      enemy.age = Math.max(0, enemy.age);
      scene.fireProjectile(240, 330, 0, -600, false, 1000, 1);
      scene.updateProjectiles(1 / 60);
    }
    const oneLeft = scene.getDebugState();
    advance(3);
    const stillWaiting = scene.getDebugState();
    const enemy = scene.enemies[0];
    enemy.x = enemy.px = 240;
    enemy.y = enemy.py = 300;
    enemy.age = Math.max(0, enemy.age);
    scene.fireProjectile(240, 330, 0, -600, false, 1000, 1);
    scene.updateProjectiles(1 / 60);
    advance(1.2);
    return { waiting, oneLeft, stillWaiting, next: scene.getDebugState() };
  });
  expect(result.waiting.wave).toBe(1);
  expect(result.waiting.enemies).toHaveLength(8);
  expect(result.waiting.kills).toBe(0);
  expect(result.oneLeft.enemies).toHaveLength(1);
  expect(result.stillWaiting.wave).toBe(1);
  expect(result.next.wave).toBe(2);
  expect(result.next.kills).toBe(8);
  expect(result.next.enemies).toHaveLength(9);
});

test('asteroids are a separate destructible dodge wave with no hostile gunfire', async ({ page }) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const flight = (window as any).__EPOCH__;
    const { scene, game } = flight;
    game.loop.stop();
    scene.clearRun();
    scene.nextFire = Infinity;
    scene.invulnerable = 100;
    // Force just this encounter's kind; exercise the normal asteroid spawning path.
    const wave = { ...scene.level.waves[3], kind: 'debris', count: 12, hold: 0, tier: 0 };
    scene.spawnWave(wave, 3);
    const original = [...scene.enemies];
    for (let tick = 0; tick < 900; tick++) {
      scene.updateEnemies(1 / 60);
      scene.updateProjectiles(1 / 60);
    }
    const dodged = scene.getDebugState();
    // Firing at a fragment destroys it and creates the carrier's pickup normally.
    const target = scene.enemies.find((enemy: any) => enemy.drop === 'multishot');
    // Other crossing rocks must not intercept this one-target collision probe.
    for (const enemy of scene.enemies) if (enemy !== target) enemy.age = -1;
    target.x = target.px = 240;
    target.y = target.py = 300;
    target.age = 1;
    scene.fireProjectile(240, 330, 0, -600, false, 1000, 1);
    scene.updateProjectiles(1 / 60);
    return { dodged, targetDestroyed: !scene.enemies.includes(target), remaining: scene.enemies.length, sameObjects: original.filter((enemy: any) => scene.enemies.includes(enemy)).length, killed: scene.getDebugState() };
  });
  expect(result.dodged.enemies).toHaveLength(12);
  expect(result.dodged.bullets.hostile).toBe(0);
  expect(result.dodged.kills).toBe(0);
  expect(result.dodged.enemies.every((enemy: any) => enemy.kind === 'debris')).toBe(true);
  expect(result.dodged.enemies.some((enemy: any) => enemy.returns > 0)).toBe(true);
  expect(result.remaining).toBe(11);
  expect(result.targetDestroyed).toBe(true);
  expect(result.sameObjects).toBe(11);
  expect(result.killed.kills).toBe(1);
  expect(result.killed.pickups.some((pickup: any) => pickup.kind === 'multishot')).toBe(true);
});

test('return loops preserve the enemy and its damage, without screen-wide collision sweeps', async ({ page }) => {
  await launch(page);
  const states = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    const results = [];
    for (const kind of ['straight', 'weaver', 'shooter']) {
      scene.clearRun();
      scene.debug('enemy', { kind, hp: 100 });
      const enemy = scene.enemies[0];
      enemy.x = enemy.px = 240;
      enemy.y = enemy.py = 550;
      scene.fireProjectile(240, 590, 0, -600, false, 10, 1);
      for (let frame = 0; frame < 5; frame++) scene.updateProjectiles(1 / 60);
      const damagedHp = enemy.hp;
      enemy.age = enemy.entry + enemy.hold + 2;
      enemy.dive = true;
      enemy.x = enemy.px = 240;
      enemy.y = enemy.py = 899;
      enemy.vx = 0;
      enemy.vy = 200;
      scene.invulnerable = 0;
      const playerHp = scene.hp;
      scene.updateEnemies(1 / 60);
      const justReturned = scene.getDebugState();
      scene.updateProjectiles(1 / 60);
      results.push({
        kind, damagedHp, justReturned, playerHp, hpAfterReturn: scene.hp,
        sameObject: scene.enemies.includes(enemy),
      });
    }
    return results;
  });
  for (const result of states) {
    expect(result.sameObject).toBe(true);
    expect(result.damagedHp).toBeLessThan(100);
    expect(result.justReturned.enemies[0].hp).toBe(result.damagedHp);
    expect(result.justReturned.enemies[0].returns).toBe(1);
    expect(result.hpAfterReturn).toBe(result.playerHp);
  }
  expect(new Set(states.map((result: any) => result.justReturned.enemies[0].returnPattern)).size).toBe(3);
});

test('ramming damages the player but cannot count as an enemy kill', async ({ page }) => {
  await launch(page);
  const result = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    scene.clearRun();
    scene.debug('enemy', { hp: 100 });
    const enemy = scene.enemies[0];
    enemy.x = enemy.px = scene.player.x;
    enemy.y = enemy.py = scene.player.y;
    scene.invulnerable = 0;
    const hp = scene.hp;
    scene.updateProjectiles(0);
    return { hp, after: scene.getDebugState(), sameEnemy: scene.enemies[0] === enemy };
  });
  expect(result.after.hp).toBe(result.hp - 1);
  expect(result.after.kills).toBe(0);
  expect(result.after.enemies[0].hp).toBe(100);
  expect(result.sameEnemy).toBe(true);
});
