import { test, expect } from '@playwright/test';

test('the compact menu keeps ship parts and every primary route accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await expect(page.locator('.menu-topline')).toContainText('MAIN MENU');
  await expect(page.locator('.menu-parts')).toHaveAttribute('aria-label', /Ship parts: 0 of 12/);
  await expect(page.locator('.menu-parts')).toBeVisible();
  expect(await page.locator('.menu-parts').evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(30);
  await expect(page.locator('#overlay .primary-button')).toHaveCount(1);
  for (const action of ['hangar', 'continue', 'signal-map', 'archive', 'settings']) {
    const control = page.locator(`#overlay [data-action="${action}"]`);
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(30);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  await page.locator('#overlay [data-action="archive"]').click();
  await expect(page.locator('[data-transmission="launch-orders"]')).toBeVisible();
});

test('all levels render distinct scenery with bounded textures and theme-correct enemies', async ({ page }) => {
  // This stress check uploads and reads 52 complete environments back-to-back.
  test.setTimeout(60_000);
  await page.goto('/');
  await page.locator('[data-action="launch"]:not(:disabled)').click();
  const result = await page.evaluate(() => {
    const { scene, game } = (window as any).__EPOCH__;
    game.loop.stop();
    const baselineTextures = scene.textures.getTextureKeys().length;
    const levels = [...Array.from({ length: 50 }, (_, i) => i + 1), 51, 100];
    const hashes = [], counts = [], correctEnemies = [];
    const probe = document.createElement('canvas'); probe.width = 60; probe.height = 100;
    const ctx = probe.getContext('2d')!;
    for (const level of levels) {
      scene.startRun({ level, score: 0, hp: 3 });
      scene.pauseCombat();
      const appearance = scene.getDebugState().appearance;
      ctx.drawImage(scene.textures.get('level-environment').getSourceImage(), 0, 0, 60, 100);
      let hash = 2166136261;
      for (const value of ctx.getImageData(0, 0, 60, 100).data) hash = Math.imul(hash ^ value, 16777619);
      hashes.push(hash >>> 0);
      counts.push(scene.textures.getTextureKeys().length);
      scene.spawnWave({ ...scene.level.waves[0], kind: 'weaver', count: 3 }, 0);
      scene.spawnBoss();
      correctEnemies.push(scene.enemies.every((enemy: any) => enemy.sprite.texture.key === appearance.textures[enemy.boss ? enemy.bossKind : enemy.kind]));
    }
    const stars = () => scene.stars.map((star: any) => ({ x: star.sprite.x, y: star.sprite.y }));
    scene.setPreferences({ music: false, sfx: false, reducedMotion: true });
    const before = stars(); scene.updateBackdrop(1); const after = stars();
    return { hashes, counts, baselineTextures, correctEnemies, before, after };
  });
  expect(new Set(result.hashes).size).toBe(52);
  expect(new Set(result.counts)).toEqual(new Set([result.baselineTextures]));
  expect(result.correctEnemies.every(Boolean)).toBe(true);
  expect(result.after).toEqual(result.before);
});
