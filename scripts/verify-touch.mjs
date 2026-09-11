import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(() => !document.querySelector('[data-action="launch"]')?.disabled);
  await page.locator('[data-action="launch"]').tap();
  const canvas = await page.locator('canvas').boundingBox();
  const snapshot = () => page.evaluate(() => window.__EPOCH__.snapshot().combat.player);
  const before = await snapshot();
  const cdp = await context.newCDPSession(page);
  const touch = { x: canvas.x + canvas.width * .28, y: canvas.y + canvas.height * .88, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
  assert.deepEqual(await snapshot(), before, 'initial real touch event does not teleport ship');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...touch, x: touch.x + 60, y: touch.y - 70 }] });
  await page.waitForTimeout(100);
  const moved = await snapshot();
  assert.ok(Math.abs(moved.x - before.x - 60 * 480 / canvas.width) < 1.5);
  assert.ok(Math.abs(moved.y - before.y + 70 * 800 / canvas.height) < 1.5);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  assert.deepEqual(await snapshot(), moved, 'lifting touch holds position');
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  await page.locator('#pause-control').tap();
  assert.equal(await page.evaluate(() => window.__EPOCH__.snapshot().screen), 'paused');
  console.log(JSON.stringify({ simulatedTouch: 'Chrome CDP', noInitialJump: true, relativeMovement: true, liftHoldsPosition: true, noScroll: true, pauseTap: true }));
} finally { await browser.close(); }
