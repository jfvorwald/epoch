import { test, expect, type Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).__EPOCH__.snapshot());
const debug = (page: Page, action: string, payload?: Record<string, unknown>) => page.evaluate(({ action, payload }) => (window as any).__EPOCH__.debug(action, payload), { action, payload });
const action = (page: Page, name: string) => page.locator(`[data-action="${name}"]`).click();
async function pickup(page: Page, kind: string) {
  await debug(page, 'pickup', { kind });
  await expect.poll(async () => (await snapshot(page)).combat.pickups.some((p: any) => p.kind === kind)).toBe(false);
}
async function launch(page: Page) {
  await page.goto('/');
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await action(page, 'launch');
}

test('hangar previews the locked ship and saves working handling and reactor controls', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await action(page, 'hangar');
  await page.locator('[data-ship="manta"]').click();
  expect((await snapshot(page)).save.hangar.selectedShip).toBe('strelka');
  await expect(page.getByRole('progressbar', { name: 'Manta parts collected' })).toHaveAttribute('aria-valuenow', '0');
  await page.screenshot({ path: `test-results/locked-hangar-${info.project.name}.png` });
  await page.locator('[data-ship="strelka"]').click();
  await page.locator('input[name="handling"][value="agile"]').check();
  await page.locator('input[name="reactor"][value="heavy"]').check();
  expect((await snapshot(page)).save.hangar.loadouts.strelka).toEqual({ handling: 'agile', reactor: 'heavy' });
  await page.screenshot({ path: `test-results/hangar-${info.project.name}.png` });
  expect(await page.locator('.hangar-panel').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await action(page, 'launch');
  const combat = (await snapshot(page)).combat;
  expect(combat.maxHp).toBe(3);
  expect(combat.hp).toBe(3);
  await page.reload();
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await action(page, 'hangar');
  await expect(page.locator('input[name="handling"][value="agile"]')).toBeChecked();
  await expect(page.locator('input[name="reactor"][value="heavy"]')).toBeChecked();
});

test('multishot adds one projectile per collection and survives buffs, weapon swaps and pause', async ({ page }) => {
  await launch(page);
  const base = (await snapshot(page)).combat.projectiles;
  await pickup(page, 'multishot');
  expect((await snapshot(page)).combat.projectiles).toBe(base + 1);
  await pickup(page, 'multishot');
  expect((await snapshot(page)).combat.projectiles).toBe(base + 2);
  await pickup(page, 'rapid');
  await debug(page, 'expireBuffs');
  expect((await snapshot(page)).combat.multishot).toBe(2);
  await pickup(page, 'weapon-lance');
  expect((await snapshot(page)).combat.weapon).toBe('lance');
  expect((await snapshot(page)).combat.multishot).toBe(2);
  await page.locator('#pause-control').click();
  const paused = (await snapshot(page)).combat;
  await page.waitForTimeout(180);
  expect((await snapshot(page)).combat.elapsed).toBe(paused.elapsed);
  await action(page, 'resume');
  await debug(page, 'advance', { seconds: 9 });
  expect((await snapshot(page)).combat.multishot).toBe(2);
  await debug(page, 'complete');
  await action(page, 'advance');
  await action(page, 'transmission-next');
  const fresh = (await snapshot(page)).combat;
  expect(fresh.level).toBe(2);
  expect(fresh.multishot).toBe(0);
  expect(fresh.projectiles).toBe(base);
  expect(fresh.weapon).toBe('pulse');
});

test('pickup notices stay below the player movement area and never intercept input', async ({ page }, info) => {
  await launch(page);
  await pickup(page, 'multishot');
  await expect(page.locator('#notice')).toHaveClass(/visible/);
  const stage = await page.locator('#game-stage').boundingBox();
  const toast = await page.locator('#notice').boundingBox();
  expect(toast!.y).toBeGreaterThan(stage!.y + stage!.height * .875);
  expect(toast!.width).toBeLessThan(stage!.width * .55);
  expect(await page.locator('#notice').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  await page.screenshot({ path: `test-results/upgraded-combat-${info.project.name}.png` });
});

test('collected ship parts survive defeat and unlock Manta exactly at twelve', async ({ page }) => {
  await launch(page);
  await page.evaluate(() => {
    const saved = (window as any).__EPOCH__.snapshot().save;
    saved.hangar.parts = 11;
    localStorage.setItem('epoch.browser.save.v1', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await action(page, 'launch');
  await pickup(page, 'ship-part');
  expect((await snapshot(page)).save.hangar.parts).toBe(12);
  await debug(page, 'defeat');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('defeat');
  await page.reload();
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  expect((await snapshot(page)).save.hangar.parts).toBe(12);
  await action(page, 'hangar');
  await expect(page.locator('#overlay')).toContainText('MANTA');
  await page.locator('[data-ship="manta"]').click();
  expect((await snapshot(page)).save.hangar.selectedShip).toBe('manta');
  await page.keyboard.press('Escape');
  await action(page, 'launch');
  expect((await snapshot(page)).combat.weapon).toBe('lance');
});

test('new airframe checkpoints keep their tuning and reset sector weapons', async ({ page }) => {
  await launch(page);
  await page.evaluate(() => {
    const saved = (window as any).__EPOCH__.snapshot().save;
    saved.hangar.parts = 12;
    saved.hangar.selectedShip = 'manta';
    saved.hangar.loadouts.manta = { handling: 'armored', reactor: 'heavy' };
    localStorage.setItem('epoch.browser.save.v1', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await action(page, 'launch');
  const launched = (await snapshot(page)).combat;
  expect(launched.shipId).toBe('manta');
  expect(launched.weapon).toBe('lance');
  expect(launched.hp).toBe(launched.maxHp);
  expect(launched.maxHp).toBe(3);
  await pickup(page, 'weapon-scatter');
  await pickup(page, 'multishot');
  await debug(page, 'complete');
  const checkpoint = (await snapshot(page)).save.checkpoint;
  expect(checkpoint.shipId).toBe('manta');
  expect(checkpoint.loadout).toEqual({ handling: 'armored', reactor: 'heavy' });
  await page.evaluate(() => {
    const saved = (window as any).__EPOCH__.snapshot().save;
    saved.hangar.selectedShip = 'strelka';
    saved.hangar.loadouts.manta = { handling: 'agile', reactor: 'rapid' };
    localStorage.setItem('epoch.browser.save.v1', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.locator('[data-action="continue"]')).toBeEnabled();
  await action(page, 'continue');
  const continued = (await snapshot(page)).combat;
  expect(continued.shipId).toBe('manta');
  expect(continued.maxHp).toBe(launched.maxHp);
  expect(continued.weapon).toBe('lance');
  expect(continued.multishot).toBe(0);
});

test('paired minibosses require both kills before the sector can finish', async ({ page }) => {
  await launch(page);
  await page.evaluate(() => {
    const saved = (window as any).__EPOCH__.snapshot().save;
    saved.hangar.parts = 11;
    localStorage.setItem('epoch.browser.save.v1', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await action(page, 'launch');
  await debug(page, 'complete');
  await action(page, 'advance');
  await action(page, 'transmission-next');
  await debug(page, 'boss');
  const bossHud = (await snapshot(page)).hud;
  expect(bossHud.wave).toBe(bossHud.totalWaves);
  expect(bossHud.totalWaves).toBeLessThanOrEqual(12);
  // Fix this encounter's fragment roll to exercise final salvage deterministically.
  await page.evaluate(() => { Math.random = () => 0.1; });
  expect((await snapshot(page)).combat.enemies.filter((e: any) => e.boss)).toHaveLength(2);
  await debug(page, 'killBoss', { index: 0 });
  expect((await snapshot(page)).combat.enemies.filter((e: any) => e.boss)).toHaveLength(1);
  expect((await snapshot(page)).screen).toBe('playing');
  expect((await snapshot(page)).save.hangar.parts).toBe(11);
  await debug(page, 'killBoss', { index: 0 });
  await expect.poll(async () => (await snapshot(page)).screen, { timeout: 12000 }).toBe('complete');
  expect((await snapshot(page)).save.hangar.parts).toBe(12);
  await expect(page.locator('.salvage-result')).toContainText('MANTA-12 UNLOCKED');
});

test('one lance damages three aligned enemies once each and stops before the fourth', async ({ page }) => {
  await launch(page);
  const damage = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    scene.debug('pickup', { kind: 'weapon-lance' });
    scene.update(0, 1000 / 60);
    for (const bullet of scene.bullets) bullet.sprite.destroy();
    scene.bullets.length = 0;
    for (let index = 0; index < 4; index++) {
      scene.debug('enemy', { hp: 100 });
      const enemy = scene.enemies.at(-1);
      enemy.x = enemy.px = enemy.tx = 240;
      enemy.y = enemy.py = enemy.ty = 570 - index * 90;
      enemy.sprite.setPosition(enemy.x, enemy.y);
    }
    scene.debug('fire');
    for (let frame = 0; frame < 40; frame++) scene.updateProjectiles(1 / 60);
    return scene.enemies.map((enemy: any) => 100 - enemy.hp);
  });
  expect(damage).toHaveLength(4);
  expect(damage[0]).toBeGreaterThan(0);
  expect(damage[1]).toBe(damage[0]);
  expect(damage[2]).toBe(damage[0]);
  expect(damage[3]).toBe(0);
});

test('hangar tuning supports native keyboard navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await action(page, 'hangar');
  await page.locator('input[name="handling"][value="balanced"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('input[name="handling"][value="agile"]')).toBeChecked();
  expect((await snapshot(page)).save.hangar.loadouts.strelka.handling).toBe('agile');
});

test('local playtest profile unlocks previews without changing the normal save', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await action(page, 'hangar');
  await page.locator('input[name="handling"][value="agile"]').check();
  const saved = await page.evaluate(() => localStorage.getItem('epoch.browser.save.v1'));
  await page.goto('/?playtest=1');
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  expect((await snapshot(page)).save.hangar.parts).toBe(12);
  await action(page, 'hangar');
  await page.locator('[data-ship="manta"]').click();
  await page.keyboard.press('Escape');
  await action(page, 'launch');
  await debug(page, 'complete');
  expect(await page.evaluate(() => localStorage.getItem('epoch.browser.save.v1'))).toBe(saved);
  await page.goto('/');
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  expect((await snapshot(page)).save.hangar.parts).toBe(0);
  expect((await snapshot(page)).save.hangar.loadouts.strelka.handling).toBe('agile');
});
