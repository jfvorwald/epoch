/** Refresh the self-hosted, Latin-only Google Fonts used by EPOCH. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const destination = new URL('../public/fonts/', import.meta.url);
const source = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,500;0,600;0,700;0,800;0,900;1,800&family=Barlow:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap';
const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

async function download(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} downloading ${url}`);
  return response;
}

await mkdir(destination, { recursive: true });
const upstream = await (await download(source)).text();
const faces = [...upstream.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g)].map(match => match[1]);
if (faces.length !== 14) throw new Error(`Expected 14 Latin font faces, received ${faces.length}`);

let totalBytes = 0;
const localFaces = await Promise.all(faces.map(async face => {
  const family = face.match(/font-family:\s*'([^']+)'/)[1];
  const style = face.match(/font-style:\s*([^;]+)/)[1];
  const weight = face.match(/font-weight:\s*([^;]+)/)[1];
  const url = face.match(/src:\s*url\(([^)]+)\)/)[1];
  if (!url.startsWith('https://fonts.gstatic.com/') || !url.endsWith('.woff2')) {
    throw new Error(`Expected Google-hosted WOFF2: ${url}`);
  }
  const filename = `${family.toLowerCase().replaceAll(' ', '-')}-${weight}-${style}-latin.woff2`;
  const bytes = Buffer.from(await (await download(url)).arrayBuffer());
  if (bytes.subarray(0, 4).toString() !== 'wOF2') throw new Error(`Invalid WOFF2: ${filename}`);
  await writeFile(new URL(filename, destination), bytes);
  totalBytes += bytes.length;
  return `/* Source: ${url} */\n${face.replace(url, `/fonts/${filename}`)}`;
}));

const licenses = ['barlow', 'barlowcondensed', 'ibmplexmono'];
await Promise.all(licenses.map(async family => {
  const license = await (await download(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`)).text();
  if (!license.includes('SIL OPEN FONT LICENSE')) throw new Error(`Unexpected license for ${family}`);
  await writeFile(new URL(`LICENSE-${family}.txt`, destination), license);
}));

await writeFile(new URL('fonts.css', destination), `/* Self-hosted Latin fonts. SIL Open Font License 1.1; see LICENSE-*.txt.\n * Refresh with: node scripts/fetch-fonts.mjs\n */\n${localFaces.join('\n\n')}\n`);
console.log(`Saved ${faces.length} Latin WOFF2 font faces (${(totalBytes / 1024).toFixed(1)} KiB) and three OFL licenses to ${fileURLToPath(destination)}`);
