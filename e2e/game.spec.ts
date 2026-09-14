import { test, expect, type Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).__EPOCH__.snapshot());
const debug = (page: Page, action: string, payload?: Record<string, unknown>) => page.evaluate(({ action, payload }) => (window as any).__EPOCH__.debug(action, payload), { action, payload });
const action = (page: Page, name: string) => page.locator(`#overlay [data-action="${name}"]`).click();
async function launch(page: Page) { await action(page, 'launch'); await expect.poll(async () => (await snapshot(page)).screen).toBe('playing'); }

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
});

test('title, branding, archive, preferences and mobile viewport', async ({ page }, info) => {
  await expect(page).toHaveTitle('EPOCH — Jaq Studios');
  await expect(page.locator('h1')).toHaveText('EPOCH');
  await expect(page.locator('[data-action="continue"]')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1)).toBeTruthy();
  await page.screenshot({ path: `test-results/menu-${info.project.name}.png` });
  await action(page, 'archive');
  await page.locator('[data-transmission="launch-orders"]').click();
  await expect(page.locator('.transmission-text')).toContainText('Voss');
  await action(page, 'transmission-next');
  await expect(page.locator('[data-transmission="cold-start"]')).toBeDisabled();
  await action(page, 'archive-back');
  await action(page, 'settings');
  await page.getByRole('switch', { name: 'Music', exact: false }).uncheck();
  await page.getByRole('switch', { name: 'Reduced motion', exact: false }).check();
  await action(page, 'settings-back');
  await page.reload();
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await action(page, 'settings');
  await expect(page.getByRole('switch', { name: 'Music', exact: false })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Reduced motion', exact: false })).toBeChecked();
  await expect(page.locator('html')).toHaveClass('reduced-motion');
});

test('relative drag has no jump, clamps safely, and keyboard moves', async ({ page }) => {
  await launch(page);
  const canvas = await page.locator('canvas').boundingBox();
  const before = (await snapshot(page)).combat.player;
  const x = canvas!.x + canvas!.width * .25, y = canvas!.y + canvas!.height * .82;
  await page.mouse.move(x, y); await page.mouse.down();
  const pressed = (await snapshot(page)).combat.player;
  expect(pressed.x).toBeCloseTo(before.x, 0); expect(pressed.y).toBeCloseTo(before.y, 0);
  await page.mouse.move(x + canvas!.width * .12, y - canvas!.height * .1, { steps: 5 });
  const moved = (await snapshot(page)).combat.player;
  // Browser pointer positions round to device pixels; allow one logical-pixel rounding step.
  expect(Math.abs(moved.x - (before.x + 57.6))).toBeLessThan(1.5);
  expect(Math.abs(moved.y - (before.y - 80))).toBeLessThan(1.5);
  await page.mouse.up();
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(180); await page.keyboard.up('ArrowLeft');
  expect((await snapshot(page)).combat.player.x).toBeLessThan(moved.x - 20);
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(700); await page.keyboard.up('ArrowDown');
  expect((await snapshot(page)).combat.player.y).toBeLessThanOrEqual(700);
});

test('real bullet collisions, i-frames and pickups', async ({ page }, info) => {
  await launch(page);
  await debug(page, 'enemy', { hp: 1 });
  await expect.poll(async () => (await snapshot(page)).combat.kills).toBeGreaterThan(0);
  await debug(page, 'damage');
  await expect.poll(async () => (await snapshot(page)).combat.hp).toBe(2);
  await debug(page, 'spawnEnemyBullet', { y: 630, vy: 600 });
  await page.waitForTimeout(170);
  expect((await snapshot(page)).combat.hp).toBe(2);
  await debug(page, 'pickup', { kind: 'health' });
  await expect.poll(async () => (await snapshot(page)).combat.hp).toBe(3);
  for (const kind of ['rapid', 'spread', 'damage']) {
    await debug(page, 'pickup', { kind });
    await expect.poll(async () => !!(await snapshot(page)).combat.buffs[kind]).toBeTruthy();
  }
  const oldExpiry = (await snapshot(page)).combat.buffs.rapid;
  await page.waitForTimeout(180); await debug(page, 'pickup', { kind: 'rapid' });
  await expect.poll(async () => (await snapshot(page)).combat.buffs.rapid).toBeGreaterThan(oldExpiry);
  await page.screenshot({ path: `test-results/combat-${info.project.name}.png` });
  await debug(page, 'expireBuffs');
  expect(Object.keys((await snapshot(page)).combat.buffs)).toHaveLength(0);
});

for (const reducedMotion of [false, true]) {
  test(`three real hits destroy the ship before Signal lost${reducedMotion ? ' with reduced motion' : ''}`, async ({ page }) => {
    if (reducedMotion) {
      await action(page, 'settings');
      await page.getByRole('switch', { name: 'Reduced motion', exact: false }).check();
      await action(page, 'settings-back');
    }
    await launch(page);
    const sequence = await page.evaluate(() => {
      const flight = (window as any).__EPOCH__;
      const { scene, game } = flight;
      game.loop.stop();
      const advance = (milliseconds: number) => {
        for (let remaining = milliseconds; remaining > 0; remaining -= 1000 / 60) {
          scene.update(0, Math.min(remaining, 1000 / 60));
        }
      };
      const capture = () => {
        const state = flight.snapshot();
        return {
          screen: state.screen,
          combat: state.combat,
          hudHp: state.hud.hp,
          playerVisible: scene.player.visible,
          explosionVisible: scene.playerExplosion.visible,
          explosionCommands: [...scene.playerExplosion.commandBuffer],
          visibleEffects: scene.effects.filter((effect: any) => effect.sprite.visible && effect.sprite.alpha > 0).length,
        };
      };
      const impacts = [];
      for (let hit = 0; hit < 3; hit++) {
        // Each debug hit creates a real hostile projectile; the normal update and
        // collision path applies damage. No health or outcome state is assigned.
        scene.debug('damage');
        advance(50);
        impacts.push(capture());
      }
      // A pickup and another projectile must not revive or further damage the wreck.
      scene.debug('pickup', { kind: 'health' });
      scene.debug('spawnEnemyBullet', { y: scene.player.y - 20, vy: 600 });
      advance(400);
      const duringExplosion = capture();
      advance(700);
      return { impacts, duringExplosion, finished: capture() };
    });
    expect(sequence.impacts.map(impact => impact.combat.hp)).toEqual([2, 1, 0]);
    for (const impact of sequence.impacts.slice(0, 2)) {
      expect(impact.combat.maxHp).toBe(3);
      expect(impact.combat.mode).toBe('combat');
      expect(impact.screen).toBe('playing');
      expect(impact.playerVisible).toBe(true);
    }
    const fatal = sequence.impacts[2];
    expect(fatal.hudHp).toBe(0);
    expect(fatal.combat.mode).toBe('dying');
    expect(fatal.screen).toBe('playing');
    expect(fatal.playerVisible).toBe(false);
    expect(fatal.visibleEffects).toBeGreaterThan(0);
    expect(fatal.explosionVisible).toBe(true);
    expect(fatal.explosionCommands.length).toBeGreaterThan(0);
    expect(sequence.duringExplosion.screen).toBe('playing');
    expect(sequence.duringExplosion.combat.mode).toBe('dying');
    expect(sequence.duringExplosion.combat.hp).toBe(0);
    expect(sequence.duringExplosion.combat.elapsed).toBe(fatal.combat.elapsed);
    expect(sequence.duringExplosion.combat.score).toBe(fatal.combat.score);
    expect(sequence.duringExplosion.combat.player).toEqual(fatal.combat.player);
    expect(sequence.duringExplosion.explosionVisible).toBe(true);
    expect(sequence.duringExplosion.explosionCommands.length).toBeGreaterThan(0);
    if (reducedMotion) expect(sequence.duringExplosion.explosionCommands).toEqual(fatal.explosionCommands);
    expect(sequence.finished.combat.mode).toBe('ended');
    expect(sequence.finished.combat.hp).toBe(0);
    expect(sequence.finished.screen).toBe('defeat');
    await expect(page.locator('.panel h2')).toHaveText('Signal lost.');
  });
}

test('pause holds simulation and buff time, long tap and Escape resume', async ({ page }) => {
  await launch(page);
  await debug(page, 'pickup', { kind: 'rapid' });
  await page.waitForTimeout(150);
  await page.locator('#pause-control').click({ delay: 250 });
  await expect.poll(async () => (await snapshot(page)).screen).toBe('paused');
  const before = (await snapshot(page)).combat;
  await page.waitForTimeout(400);
  const after = (await snapshot(page)).combat;
  expect(after.elapsed).toBe(before.elapsed); expect(after.buffs).toEqual(before.buffs); expect(after.bullets).toEqual(before.bullets);
  await action(page, 'settings');
  await action(page, 'settings-back');
  expect((await snapshot(page)).screen).toBe('paused');
  await action(page, 'resume');
  await page.keyboard.press('Escape');
  expect((await snapshot(page)).screen).toBe('paused');
  await page.keyboard.press('Escape');
  expect((await snapshot(page)).screen).toBe('playing');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect((await snapshot(page)).screen).toBe('paused');
});

test('completed boundary survives reload, defeat and retry clean up', async ({ page }) => {
  await launch(page); await debug(page, 'complete');
  await expect(page.locator('.checkpoint-label')).toContainText('CHECKPOINT SAVED');
  const completed = await snapshot(page);
  expect(completed.save.checkpoint.level).toBe(2);
  expect(completed.save.checkpoint.score).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('[data-action="continue"]')).toBeEnabled();
  await action(page, 'continue');
  const continued = await snapshot(page);
  expect(continued.combat.level).toBe(2); expect(continued.combat.score).toBe(completed.save.checkpoint.score);
  await debug(page, 'defeat');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('defeat');
  expect((await snapshot(page)).save.checkpoint.level).toBe(2);
  await action(page, 'retry');
  const retried = await snapshot(page);
  expect(retried.combat.level).toBe(1); expect(retried.combat.hp).toBe(3); expect(retried.combat.score).toBe(0);
  expect(retried.save.checkpoint).toBeNull(); expect(retried.combat.bullets.hostile).toBe(0);
});

test('the opening five levels unlock chapter two and keep a continue checkpoint', async ({ page }) => {
  await launch(page);
  for (let level = 1; level <= 5; level++) {
    expect((await snapshot(page)).combat.level).toBe(level);
    await debug(page, 'complete');
    await action(page, 'advance');
    expect((await snapshot(page)).screen).toBe('transmission');
    await action(page, 'transmission-next');
  }
  expect((await snapshot(page)).combat.level).toBe(6);
  expect((await snapshot(page)).save.unlockedTransmissions).toHaveLength(6);
  expect((await snapshot(page)).save.checkpoint.level).toBe(6);
  await page.locator('#pause-control').click();
  await action(page, 'menu');
  await expect(page.locator('[data-action="continue"]')).toBeEnabled();
  await expect(page.locator('[data-action="continue"]')).toContainText('LEVEL 06');
});

test('resize during drag pauses safely; corrupted saves still launch', async ({ page }) => {
  await launch(page);
  const canvas = await page.locator('canvas').boundingBox();
  await page.mouse.move(canvas!.x + 80, canvas!.y + canvas!.height - 50); await page.mouse.down();
  await page.setViewportSize({ width: 390, height: 680 });
  await expect.poll(async () => (await snapshot(page)).screen).toBe('paused');
  await page.mouse.up(); await action(page, 'resume');
  expect((await snapshot(page)).combat.player.x).toBe(240);
  await page.evaluate(() => localStorage.setItem('epoch.browser.save.v1', '{broken'));
  await page.reload();
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await expect(page.locator('[data-action="continue"]')).toBeDisabled();
});

test('storage denial reports a session checkpoint honestly', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); }; });
  await page.reload(); await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await launch(page); await debug(page, 'complete');
  await expect(page.locator('.checkpoint-label')).toContainText('SESSION CHECKPOINT ONLY');
  await expect(page.locator('.fine-print')).toContainText('lost when this page closes');
});
