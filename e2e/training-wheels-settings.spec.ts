import { test, expect, type Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => (window as any).__EPOCH__.snapshot());
const action = (page: Page, name: string) => page.locator(`#overlay [data-action="${name}"]`).click();
const trainingWheels = (page: Page) => page.getByRole('switch', { name: 'Training Wheels', exact: false });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
});

test('Training Wheels starts off and persists an explicit opt-in without losing an older save', async ({ page }, info) => {
  await action(page, 'settings');
  await expect(trainingWheels(page)).not.toBeChecked();
  await expect(page.locator('.settings-list')).toContainText('Show enemy routes, shot paths & safe lanes');
  await action(page, 'settings-back');

  const olderSave = await page.evaluate(() => {
    const saved = (window as any).__EPOCH__.snapshot().save;
    saved.bestScore = 35000;
    saved.furthestLevel = 3;
    saved.checkpoint = { level: 3, score: 12000, hp: 2, shipId: 'strelka', loadout: { handling: 'agile', reactor: 'rapid' } };
    saved.hangar.parts = 7;
    saved.hangar.loadouts.strelka = { handling: 'agile', reactor: 'rapid' };
    saved.preferences = { music: false, sfx: false, reducedMotion: true };
    localStorage.setItem('epoch.browser.save.v1', JSON.stringify(saved));
    return saved;
  });
  await page.reload();
  await expect(page.locator('[data-action="continue"]')).toBeEnabled();
  await action(page, 'settings');
  await expect(trainingWheels(page)).not.toBeChecked();
  await trainingWheels(page).focus();
  await page.keyboard.press('Space');
  await expect(trainingWheels(page)).toBeChecked();
  await page.screenshot({ path: info.outputPath('training-wheels-settings.png') });
  await action(page, 'settings-back');
  await page.reload();
  await expect(page.locator('[data-action="continue"]')).toBeEnabled();
  const restored = (await snapshot(page)).save;
  expect(restored).toMatchObject({
    bestScore: olderSave.bestScore, furthestLevel: olderSave.furthestLevel,
    checkpoint: olderSave.checkpoint, hangar: olderSave.hangar,
    preferences: { ...olderSave.preferences, trainingWheels: true },
  });
  await action(page, 'settings');
  await expect(trainingWheels(page)).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Music', exact: false })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Reduced motion', exact: false })).toBeChecked();
});

test('Training Wheels changes apply while paused and return to the same flight', async ({ page }) => {
  await action(page, 'launch');
  await expect.poll(async () => (await snapshot(page)).screen).toBe('playing');
  await page.locator('#pause-control').click();
  const paused = (await snapshot(page)).combat;
  await action(page, 'settings');
  await trainingWheels(page).check();
  expect((await snapshot(page)).combat.trainingWheels).toBe(true);
  await action(page, 'settings-back');
  expect((await snapshot(page)).screen).toBe('paused');
  expect((await snapshot(page)).combat).toEqual({ ...paused, trainingWheels: true });

  await action(page, 'settings');
  await trainingWheels(page).uncheck();
  expect((await snapshot(page)).combat.trainingWheels).toBe(false);
  await action(page, 'settings-back');
  expect((await snapshot(page)).screen).toBe('paused');
  expect((await snapshot(page)).combat).toEqual(paused);
  await action(page, 'resume');
  await expect.poll(async () => (await snapshot(page)).combat.elapsed).toBeGreaterThan(paused.elapsed);

  await page.reload();
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await action(page, 'settings');
  await expect(trainingWheels(page)).not.toBeChecked();
});
