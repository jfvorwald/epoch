import { defineConfig } from 'vite';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(file => file.isDirectory() ? walk(join(dir, file.name)) : [join(dir, file.name)]);
const buildInputs = [...walk('src'), ...walk('public'), ...walk('cloudflare'), 'wrangler.jsonc', 'index.html', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'vite.config.ts'].sort();
const buildHash = createHash('sha256');
for (const file of buildInputs) buildHash.update(file).update('\0').update(readFileSync(file)).update('\0');
const build = { version: JSON.parse(readFileSync('package.json', 'utf8')).version as string, id: buildHash.digest('hex').slice(0, 12) };

export default defineConfig({
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(build.version), 'import.meta.env.VITE_BUILD_ID': JSON.stringify(build.id) },
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } }, chunkSizeWarningLimit: 1600 },
  plugins: [{ name: 'epoch-offline-shell', closeBundle() {
    writeFileSync('dist/build.json', JSON.stringify(build) + '\n');
    const files = walk('dist').filter(file => !file.endsWith('sw.js'));
    const hash = createHash('sha256').update(readFileSync('public/sw.js')); files.forEach(file => hash.update(readFileSync(file)));
    // Cloudflare consumes these control files; they are not public fetchable assets.
    const publicFiles = files.filter(file => !['dist/_headers', 'dist/_redirects'].includes(file));
    const source = readFileSync('public/sw.js', 'utf8').replace('__EPOCH_CACHE__', `epoch-${hash.digest('hex').slice(0, 12)}`).replace('__EPOCH_ASSETS__', JSON.stringify(['/', ...publicFiles.map(file => `/${file.replace(/^dist\//, '')}`)]));
    writeFileSync('dist/sw.js', source);
  } }]
});
