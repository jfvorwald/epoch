import { test, expect, type Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).__EPOCH__.snapshot());
const action = (page: Page, name: string) => page.locator(`#overlay [data-action="${name}"]`).click();
const debug = (page: Page, name: string) => page.evaluate(name => (window as any).__EPOCH__.debug(name), name);
async function open(page: Page) {
  await page.goto('/');
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
}

test('signal tree keeps the five-level opening and shows all fifty levels without future story spoilers', async ({ page }, info) => {
  await open(page);
  await expect(page.locator('.right-side .sector-map')).toHaveCount(5);
  await action(page, 'signal-map');
  await expect(page.locator('.signal-chapter')).toHaveCount(10);
  await expect(page.locator('.signal-node')).toHaveCount(50);
  await expect(page.locator('[data-map-level="1"]')).toBeEnabled();
  await expect(page.locator('[data-map-level="50"]')).toBeDisabled();
  await expect(page.locator('.signal-chapter.locked')).toHaveCount(9);
  await expect(page.locator('#map-chapter-10')).not.toContainText('THE OPEN SKY');
  await page.screenshot({ path: `test-results/signal-map-${info.project.name}.png` });
  expect(await page.locator('.signal-map-panel').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.locator('[data-map-level="1"]').click();
  await expect(page.locator('.mission-location')).toContainText('LEVEL 01');
  await expect(page.locator('.mission-rules')).toContainText('0–2 RANDOM ASTEROID WAVES');
  await action(page, 'map-overview');
  await page.getByRole('button', { name: 'Close signal map' }).click();
  await expect(page.locator('.menu-topline')).toContainText('MAIN MENU');
});

test('level fifty resolves the story and continues through fifty-one, fifty-two and reload', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const save = (window as any).__EPOCH__.snapshot().save;
    save.furthestLevel = 50;
    save.checkpoint = { level: 50, score: 1_000_000_050, hp: 3 };
    localStorage.setItem('epoch.browser.save.v1', JSON.stringify(save));
  });
  await page.reload();
  await expect(page.locator('[data-action="continue"]')).toBeEnabled();
  await action(page, 'continue');
  expect((await snapshot(page)).combat.level).toBe(50);
  await expect(page.locator('#hud')).toContainText('LEVEL 50');
  await debug(page, 'complete');
  expect((await snapshot(page)).save.checkpoint.level).toBe(51);
  await action(page, 'advance');
  expect((await snapshot(page)).screen).toBe('transmission');
  await expect(page.locator('.transmission-text')).not.toBeEmpty();
  await action(page, 'transmission-next');
  expect((await snapshot(page)).screen).toBe('victory');
  await expect(page.locator('[data-action="continue-beyond"]')).toBeVisible();
  await action(page, 'continue-beyond');
  expect((await snapshot(page)).combat.level).toBe(51);
  await debug(page, 'complete');
  await action(page, 'advance');
  expect((await snapshot(page)).combat.level).toBe(52);
  await page.reload();
  await expect(page.locator('[data-action="continue"]')).toBeEnabled();
  await action(page, 'continue');
  expect((await snapshot(page)).combat.level).toBe(52);
  expect((await snapshot(page)).combat.score).toBeGreaterThan(1_000_000_050);
  expect((await snapshot(page)).save.unlockedTransmissions).toHaveLength(51);
});

test('each launch rolls zero to two asteroid waves and stores that plan through pause', async ({ page }) => {
  await open(page);
  await action(page, 'launch');
  const plans = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    const originalRandom = Math.random;
    try {
      return [0.05, 0.5, 0.95].map(roll => {
        Math.random = () => roll;
        scene.startRun({ level: 40, score: 0, hp: 3 });
        const before = scene.getDebugState();
        scene.pauseCombat();
        scene.update(0, 1000 / 60);
        const paused = scene.getDebugState();
        scene.resumeCombat();
        return { before, paused };
      });
    } finally { Math.random = originalRandom; }
  });
  expect(plans.map(plan => plan.before.asteroidWaves)).toEqual([0, 1, 2]);
  for (const plan of plans) {
    expect(plan.before.totalWaves).toBeGreaterThanOrEqual(8);
    expect(plan.before.totalWaves).toBeLessThanOrEqual(10);
    expect(plan.before.waves).toEqual(plan.paused.waves);
    expect(plan.paused.elapsed).toBe(plan.before.elapsed);
    expect(plan.before.waves[0].kind).not.toBe('debris');
    expect(plan.before.waves.at(-1).kind).not.toBe('debris');
  }
});

test('asteroids cross the firing area from multiple edges and travel both upward and downward', async ({ page }) => {
  await open(page);
  await action(page, 'launch');
  const result = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    scene.clearRun();
    scene.spawnWave({ ...scene.level.waves[2], kind: 'debris', count: 12, tier: 0, hold: 0 }, 2);
    const first = scene.getDebugState();
    const positions = scene.enemies.map((enemy: any) => ({ x: enemy.x, y: enemy.y }));
    for (let frame = 0; frame < 240; frame++) scene.updateEnemies(1 / 60);
    return { first, positions, after: scene.getDebugState() };
  });
  const rocks = result.first.enemies;
  expect(rocks.some((rock: any) => rock.sx < 0)).toBe(true);
  expect(rocks.some((rock: any) => rock.sx > 480)).toBe(true);
  expect(rocks.some((rock: any) => rock.sy < 0)).toBe(true);
  expect(rocks.some((rock: any) => rock.vx < 0)).toBe(true);
  expect(rocks.some((rock: any) => rock.vx > 0)).toBe(true);
  expect(rocks.some((rock: any) => rock.vy < 0)).toBe(true);
  expect(rocks.some((rock: any) => rock.vy > 0)).toBe(true);
  expect(result.after.enemies.some((rock: any, i: number) => Math.abs(rock.x - result.positions[i].x) > 40)).toBe(true);
  expect(result.after.bullets.hostile).toBe(0);
});
