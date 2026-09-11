import { defineConfig } from 'vite';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
export default defineConfig({
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } }, chunkSizeWarningLimit: 1600 },
  plugins: [{ name: 'epoch-offline-shell', closeBundle() {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(file => file.isDirectory() ? walk(join(dir, file.name)) : [join(dir, file.name)]);
    const files = walk('dist').filter(file => !file.endsWith('sw.js'));
    const hash = createHash('sha256').update(readFileSync('public/sw.js')); files.forEach(file => hash.update(readFileSync(file)));
    const source = readFileSync('public/sw.js', 'utf8').replace('__EPOCH_CACHE__', `epoch-${hash.digest('hex').slice(0, 12)}`).replace('__EPOCH_ASSETS__', JSON.stringify(['/', ...files.map(file => `/${file.replace(/^dist\//, '')}`)]));
    writeFileSync('dist/sw.js', source);
  } }]
});
