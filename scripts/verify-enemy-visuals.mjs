/** Start Vite; run node scripts/verify-enemy-visuals.mjs for fifty-level texture QA. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1500 }, deviceScaleFactor: 1 });
  await page.goto(process.env.EPOCH_BASE_URL ?? 'http://127.0.0.1:5173/');
  await page.locator('[data-action="launch"]:not(:disabled)').waitFor();
  const result = await page.evaluate(async () => {
    const { createEnemyVisuals } = await import('/src/game/enemyVisuals.ts');
    const { getLevelVisual } = await import('/src/data/visuals.ts');
    const { getLevel } = await import('/src/data/levels.ts');
    const { scene, game } = window.__EPOCH__;
    game.loop.stop();
    const before = scene.textures.getTextureKeys().length;
    const originalRandom = Math.random;
    let randomCalls = 0;
    const levels = [];
    const silhouetteHashes = [];
    let maxTextures = before;
    try {
      Math.random = () => { randomCalls++; return 0.37; };
      for (let id = 1; id <= 50; id++) {
        const visual = getLevelVisual(id);
        const set = createEnemyVisuals(scene, visual);
        maxTextures = Math.max(maxTextures, scene.textures.getTextureKeys().length);
        const source = key => scene.textures.get(key).getSourceImage();
        const straight = source(set.enemies.straight);
        // Record silhouettes independently of palette, using an alpha-only hash.
        const pixels = straight.getContext('2d').getImageData(0, 0, straight.width, straight.height).data;
        let hash = 2166136261;
        for (let index = 3; index < pixels.length; index += 4) hash = Math.imul(hash ^ (pixels[index] > 120 ? 1 : 0), 16777619) >>> 0;
        silhouetteHashes.push(hash);
        levels.push({
          id, fleet: visual.fleet, style: visual.hullStyle, variant: visual.hullVariant,
          images: [set.enemies.straight, set.enemies.weaver, set.enemies.shooter, set.enemies.debris, set.bosses[getLevel(id).boss.kind]].map(key => source(key).toDataURL()),
        });
        set.dispose(); set.dispose();
        if (scene.textures.getTextureKeys().length !== before) throw new Error(`Level ${id} leaked textures`);
      }
    } finally { Math.random = originalRandom; }
    return { levels, randomCalls, before, after: scene.textures.getTextureKeys().length, maxTextures, silhouetteHashes };
  });
  assert.equal(result.randomCalls, 0, 'Artwork generation does not consume gameplay RNG');
  assert.equal(result.after, result.before, 'All generated textures are retired');
  assert.equal(result.maxTextures - result.before, 9, 'Only one nine-texture fleet exists at a time');
  const roles = ['straight', 'weaver', 'shooter', 'asteroid', 'guardian'];
  const uniquePerRole = Object.fromEntries(roles.map((role, index) => [role, new Set(result.levels.map(level => level.images[index])).size]));
  for (const role of roles) assert.equal(uniquePerRole[role], 50, `Every authored level has a unique ${role} appearance`);
  assert.equal(new Set(result.silhouetteHashes.slice(0, 10)).size, 10, 'The ten fleet styles have distinct silhouettes even without color');
  await mkdir('test-results', { recursive: true });
  const style = `<style>body{margin:0;padding:32px;background:#0b1020;color:#e7edf9;font:15px system-ui}h1{margin:0 0 6px}p{color:#92a2bd;margin:0 0 20px}.row{height:124px;display:grid;grid-template-columns:280px 160px 160px 160px 160px 340px;align-items:center;border-top:1px solid #283246}.row strong{display:block;font-size:17px}.row small{color:#92a2bd}.row img{width:98px;height:98px;object-fit:contain;image-rendering:auto}.row img:last-child{width:270px;height:120px}.labels{height:30px;color:#8093ae;font-size:11px;letter-spacing:1px}</style>`;
  const htmlFor = levels => `${style}<h1>EPOCH / FLEET IDENTITIES</h1><p>Native vector textures · levels ${levels[0].id}–${levels.at(-1).id} · enlarged for inspection</p><div class="row labels"><span>LEVEL / FLEET</span><span>STRAIGHT</span><span>WEAVER</span><span>SHOOTER</span><span>ASTEROID</span><span>GUARDIAN</span></div>${levels.map(level => `<div class="row"><div><strong>${String(level.id).padStart(2, '0')} · ${level.fleet}</strong><small>Hull style ${level.style + 1} · configuration ${level.variant + 1}</small></div>${level.images.map(src => `<img src="${src}"/>`).join('')}</div>`).join('')}`;
  for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
    const levels = result.levels.slice(pageIndex * 10, pageIndex * 10 + 10);
    await page.setContent(htmlFor(levels));
    await page.screenshot({ path: `test-results/enemy-fleets-${pageIndex + 1}.png`, fullPage: true });
  }
  await writeFile('test-results/enemy-fleets.html', htmlFor(result.levels));
  const summary = { levels: 50, uniquePerRole, distinctBaseSilhouettes: new Set(result.silhouetteHashes.slice(0, 10)).size, distinctConfiguredSilhouettes: new Set(result.silhouetteHashes).size, randomCalls: result.randomCalls, retainedTextures: result.after - result.before, peakGeneratedTextures: result.maxTextures - result.before };
  await writeFile('test-results/enemy-visuals-audit.json', JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary));
} finally { await browser.close(); }
