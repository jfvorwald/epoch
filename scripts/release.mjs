import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const PRIVATE_STAGING_PATH = '.private/staging.json';
const PRIVATE_STAGING_VARS = ['BETA_OWNER', 'BETA_TESTERS', 'BETA_EMAIL_FROM', 'ACCESS_TEAM_DOMAIN', 'ACCESS_AUD'];
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function allowedKeys(value, keys, field) {
  if (!record(value) || Object.keys(value).some((key) => !keys.includes(key))) {
    throw new Error(`Invalid ${PRIVATE_STAGING_PATH} ${field}; only ${keys.join(', ')} are allowed.`);
  }
}

function privateDatabase(binding) {
  allowedKeys(binding, ['binding', 'database_name', 'database_id', 'migrations_dir'], 'D1 binding');
  if (binding.binding !== 'BETA_DB' || typeof binding.database_name !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(binding.database_name) ||
      typeof binding.database_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(binding.database_id) ||
      binding.migrations_dir !== './cloudflare/migrations') {
    throw new Error(`Invalid ${PRIVATE_STAGING_PATH} BETA_DB; use an existing staging database UUID and ./cloudflare/migrations.`);
  }
}

/** Merge only staging identity/resource bindings; private input cannot replace routes, protection, or production. */
async function mergePrivateStaging(root, config) {
  let contents;
  try {
    const directory = await fs.lstat(join(root, '.private'));
    if (directory.isSymbolicLink() || !directory.isDirectory()) throw new Error('Private staging configuration must use a real .private directory.');
    const file = await fs.lstat(join(root, PRIVATE_STAGING_PATH));
    if (file.isSymbolicLink() || !file.isFile()) throw new Error('Private staging configuration must be a regular file, not a symlink.');
    contents = await fs.readFile(join(root, PRIVATE_STAGING_PATH), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  let overrides;
  try { overrides = JSON.parse(contents); }
  catch { throw new Error(`Invalid JSON in ${PRIVATE_STAGING_PATH}.`); }
  allowedKeys(overrides, ['vars', 'd1_databases', 'send_email'], 'top-level fields');
  if (overrides.vars !== undefined) {
    allowedKeys(overrides.vars, PRIVATE_STAGING_VARS, 'vars');
    if (Object.values(overrides.vars).some((value) => typeof value !== 'string' || !value.trim() || /[\r\n\0]/.test(value))) {
      throw new Error(`Invalid ${PRIVATE_STAGING_PATH} vars; values must be nonempty single-line strings.`);
    }
    config.vars = { ...config.vars, ...overrides.vars };
  }
  if (overrides.d1_databases !== undefined) {
    if (!Array.isArray(overrides.d1_databases) || overrides.d1_databases.length !== 1) {
      throw new Error(`Invalid ${PRIVATE_STAGING_PATH} d1_databases; exactly one BETA_DB binding is allowed.`);
    }
    privateDatabase(overrides.d1_databases[0]);
    config.d1_databases = overrides.d1_databases;
  }
  if (overrides.send_email !== undefined) {
    if (!Array.isArray(overrides.send_email) || overrides.send_email.length !== 1) {
      throw new Error(`Invalid ${PRIVATE_STAGING_PATH} send_email; exactly one restricted BETA_EMAIL binding is allowed.`);
    }
    const binding = overrides.send_email[0];
    allowedKeys(binding, ['name', 'destination_address', 'allowed_sender_addresses'], 'email binding');
    if (binding.name !== 'BETA_EMAIL' || binding.destination_address !== config.vars?.BETA_OWNER ||
        !Array.isArray(binding.allowed_sender_addresses) || binding.allowed_sender_addresses.length !== 1 ||
        binding.allowed_sender_addresses[0] !== config.vars?.BETA_EMAIL_FROM) {
      throw new Error(`Invalid ${PRIVATE_STAGING_PATH} BETA_EMAIL; recipient and sole sender must match BETA_OWNER and BETA_EMAIL_FROM.`);
    }
    config.send_email = overrides.send_email;
  }
}

function assertBetaStagingConfiguration(config) {
  if (config.vars?.BETA_ENABLED !== 'true') return;
  const vars = config.vars;
  const owner = vars.BETA_OWNER;
  const testers = typeof vars.BETA_TESTERS === 'string' ? vars.BETA_TESTERS.split(',').map((email) => email.trim()) : [];
  if (typeof owner !== 'string' || !/^[^\s@]+@gmail\.com$/.test(owner) || !testers.includes(owner) ||
      testers.some((email) => !/^[^\s@]+@gmail\.com$/.test(email)) ||
      typeof vars.ACCESS_TEAM_DOMAIN !== 'string' || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(vars.ACCESS_TEAM_DOMAIN) ||
      typeof vars.ACCESS_AUD !== 'string' || !/^[a-f0-9]{64}$/i.test(vars.ACCESS_AUD) ||
      !databaseBindings(config).some((binding) => binding.binding === 'BETA_DB')) {
    throw new Error(`Enabled beta staging configuration is missing or invalid. Copy cloudflare/staging.example.json to ${PRIVATE_STAGING_PATH} and supply the approved owner, tester roster, Access application, and staging BETA_DB.`);
  }
  if (config.vars.BETA_EMAIL_ENABLED === 'true') {
    const mail = config.send_email?.find((binding) => binding.name === 'BETA_EMAIL');
    if (typeof vars.BETA_EMAIL_FROM !== 'string' || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(vars.BETA_EMAIL_FROM) ||
        mail?.destination_address !== owner || !Array.isArray(mail.allowed_sender_addresses) ||
        mail.allowed_sender_addresses.length !== 1 || mail.allowed_sender_addresses[0] !== vars.BETA_EMAIL_FROM) {
      throw new Error(`Enabled beta email configuration is missing or invalid. Configure the restricted BETA_EMAIL sender and owner recipient in ${PRIVATE_STAGING_PATH}.`);
    }
    // Pins come from the restricted binding, never from user-supplied private vars.
    vars.BETA_EMAIL_RECIPIENT = mail.destination_address;
    vars.BETA_EMAIL_SENDER = mail.allowed_sender_addresses[0];
  }
}

// Wrangler uses JSONC. Remove comments and trailing commas only outside strings.
function parseConfig(source) {
  const tokens = source.match(/"(?:\\.|[^"\\])*"|\/\/[^\n\r]*|\/\*[\s\S]*?\*\/|[^"/]+|\//g) ?? [];
  const clean = tokens.map((token) => token.startsWith('//') || token.startsWith('/*') ? ' ' : token).join('');
  return JSON.parse(clean.replace(/"(?:\\.|[^"\\])*"|,(\s*[}\]])/g, (match, closing) => closing ?? match));
}

async function filesIn(directory, prefix = '') {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Release files cannot be symlinks: ${name}`);
    if (entry.isDirectory()) files.push(...await filesIn(join(directory, entry.name), name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Unsupported release file: ${name}`);
  }
  return files.sort();
}

async function copyTree(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  for (const name of await filesIn(source)) {
    if (name.split('/').includes('.private')) throw new Error(`Refusing to snapshot private configuration files: ${name}`);
    if (/^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/.test(name.split('/').at(-1))) {
      throw new Error(`Refusing to snapshot a local secrets file: ${name}`);
    }
    await fs.mkdir(dirname(join(destination, name)), { recursive: true });
    await fs.copyFile(join(source, name), join(destination, name));
  }
}

function databaseBindings(settings) {
  if (settings.d1_databases === undefined) return [];
  if (!Array.isArray(settings.d1_databases)) throw new Error('D1 bindings must be an array.');
  for (const binding of settings.d1_databases) {
    if (!binding || typeof binding !== 'object' || typeof binding.database_id !== 'string' || !binding.database_id.trim()) {
      throw new Error('Release D1 bindings must specify an existing database_id.');
    }
  }
  return settings.d1_databases;
}

function assertDatabaseIsolation(config) {
  const staging = databaseBindings(config);
  const production = config.env?.production ?? {};
  if (staging.length && !Array.isArray(production.d1_databases)) {
    throw new Error('Production must explicitly declare d1_databases; use [] when staging feedback has no production database.');
  }
  const identifiers = (binding) => [binding.database_id, binding.preview_database_id]
    .filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim().toLowerCase());
  const stagingIds = new Set(staging.flatMap(identifiers));
  if (databaseBindings(production).some((binding) => identifiers(binding).some((id) => stagingIds.has(id)))) {
    throw new Error('Staging and production cannot share a D1 database_id or preview_database_id.');
  }
}

async function snapshotMigrations(root, artifact, config) {
  const copied = new Map();
  for (const settings of [config, ...Object.values(config.env ?? {})]) {
    for (const binding of databaseBindings(settings)) {
      const configured = binding.migrations_dir ?? './migrations';
      if (typeof configured !== 'string' || !configured || configured.split(/[\\/]/).includes('..')) {
        throw new Error('D1 migrations must use a project directory without path traversal.');
      }
      const source = resolve(root, configured);
      const path = relative(root, source);
      if (!path || path === '..' || path.startsWith(`..${sep}`)) {
        throw new Error('D1 migrations must be inside the project.');
      }
      if (source === join(root, 'dist') || source.startsWith(`${join(root, 'dist')}${sep}`)) {
        throw new Error('D1 migrations must be outside the public dist directory.');
      }
      let ancestor = root;
      for (const component of path.split(sep)) {
        ancestor = join(ancestor, component);
        const stat = await fs.lstat(ancestor);
        if (stat.isSymbolicLink()) throw new Error('D1 migration directories cannot contain symlinks.');
        if (!stat.isDirectory()) throw new Error('D1 migrations_dir must be a directory.');
      }
      if (!copied.has(source)) {
        const destination = `./migrations/${copied.size}`;
        const files = await filesIn(source);
        if (!files.length) throw new Error('D1 migration directories must contain SQL migrations.');
        for (const name of files) {
          if (/^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/.test(name.split('/').at(-1))) {
            throw new Error(`Refusing to snapshot a local secrets file: ${name}`);
          }
          if (!/\.sql$/i.test(name)) throw new Error(`D1 migration directories may contain only SQL files: ${name}`);
          const target = join(artifact, destination, name);
          await fs.mkdir(dirname(target), { recursive: true });
          await fs.copyFile(join(source, name), target);
        }
        copied.set(source, destination);
      }
      binding.migrations_dir = copied.get(source);
    }
  }
}

async function fingerprint(directory, wranglerVersion) {
  const files = [];
  for (const path of await filesIn(directory)) {
    const contents = await fs.readFile(join(directory, path));
    files.push({ path, size: contents.length, sha256: hash(contents) });
  }
  const digest = hash(JSON.stringify({ wranglerVersion, files }));
  return { format: 1, id: digest.slice(0, 16), digest, wranglerVersion, files };
}

async function localWrangler(root) {
  const require = createRequire(join(root, 'package.json'));
  const packagePath = require.resolve('wrangler/package.json');
  const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
  return { version: pkg.version, binary: resolve(dirname(packagePath), pkg.bin.wrangler) };
}

async function snapshot(root, wranglerVersion) {
  const config = parseConfig(await fs.readFile(join(root, 'wrangler.jsonc'), 'utf8'));
  await mergePrivateStaging(root, config);
  const production = config.env?.production;
  if (!config.name?.includes('staging') || !production?.name || production.name === config.name) {
    throw new Error('Wrangler must default to a staging Worker and define a different env.production.name.');
  }
  assertDatabaseIsolation(config);
  assertBetaStagingConfiguration(config);
  const releases = join(root, '.releases');
  await fs.mkdir(releases, { recursive: true });
  const temporary = await fs.mkdtemp(join(releases, '.snapshot-'));
  const artifact = join(temporary, 'artifact');
  try {
    const main = config.main;
    for (const settings of [config, ...Object.values(config.env ?? {})]) {
      if (settings.build || settings.tsconfig || settings.base_dir) {
        throw new Error('Release snapshots do not support build commands, tsconfig, or base_dir; prepare the Worker before staging.');
      }
      if (settings.main && settings.main !== main) throw new Error('All environments must use the same Worker entry point.');
      if (settings.assets?.directory && resolve(root, settings.assets.directory) !== join(root, 'dist')) {
        throw new Error('All environments must deploy the same dist directory.');
      }
      delete settings.$schema;
      if (settings.assets?.directory) settings.assets.directory = './dist';
      if (settings.main) settings.main = './worker.js';
    }
    if (!config.assets?.directory) throw new Error('The staging config must define assets.directory as ./dist.');
    await copyTree(join(root, 'dist'), join(artifact, 'dist'));
    if (main) {
      const entry = resolve(root, main);
      if (relative(root, entry).startsWith(`..${sep}`) || relative(root, entry) === '..') {
        throw new Error('The Worker entry point must be inside the project.');
      }
      if (!(await fs.lstat(entry)).isFile()) throw new Error('The Worker entry point must be a regular file.');
      await fs.copyFile(entry, join(artifact, 'worker.js'));
    }
    await snapshotMigrations(root, artifact, config);
    await fs.writeFile(join(artifact, 'wrangler.json'), json(config));
    const manifest = await fingerprint(artifact, wranglerVersion);
    await fs.writeFile(join(temporary, 'manifest.json'), json(manifest));
    const directory = join(releases, manifest.id);
    try {
      await fs.rename(temporary, directory);
    } catch (error) {
      if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
      await verify(directory, manifest.id, wranglerVersion);
    }
    return { directory, manifest };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

async function verify(directory, id, wranglerVersion) {
  const manifest = JSON.parse(await fs.readFile(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.format !== 1 || manifest.id !== id || manifest.wranglerVersion !== wranglerVersion) {
    throw new Error('Release metadata or local Wrangler version differs from the staged release.');
  }
  const actual = await fingerprint(join(directory, 'artifact'), wranglerVersion);
  if (actual.digest !== manifest.digest || actual.id !== id || JSON.stringify(actual.files) !== JSON.stringify(manifest.files)) {
    throw new Error('Release integrity check failed; its frozen assets or configuration changed.');
  }
  return manifest;
}

function executeWrangler({ binary, args, cwd }) {
  return new Promise((resolveRun, reject) => {
    let output = '';
    const child = spawn(process.execPath, [binary, ...args], {
      cwd,
      env: { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false', WRANGLER_SEND_METRICS: 'false' },
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    for (const [stream, terminal] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on('data', (data) => { output += data.toString(); terminal.write(data); });
    }
    child.on('error', reject);
    child.on('close', (code, signal) => code === 0
      ? resolveRun(output)
      : reject(new Error(`Wrangler failed (${signal ?? `exit ${code}`}); no successful deployment receipt was recorded.`)));
  });
}

async function writeReceipt(directory, filename, receipt) {
  const temporary = join(directory, `${filename}.${process.pid}.tmp`);
  await fs.writeFile(temporary, json(receipt), { flag: 'wx' });
  await fs.rename(temporary, join(directory, filename));
}

export async function release({ root = resolve(dirname(scriptPath), '..'), args = process.argv.slice(2), execute = executeWrangler } = {}) {
  const dryRun = args.includes('--dry-run');
  const positional = args.filter((argument) => argument !== '--dry-run');
  const [command, id] = positional;
  if (!['stage', 'production'].includes(command) ||
      (command === 'stage' && positional.length !== 1) ||
      (command === 'production' && (positional.length !== 2 || !/^[a-f0-9]{16}$/.test(id)))) {
    throw new Error('Usage: node scripts/release.mjs stage [--dry-run] | production <release-id> [--dry-run]');
  }
  const wrangler = await localWrangler(root);
  const selected = command === 'stage'
    ? await snapshot(root, wrangler.version)
    : { directory: join(root, '.releases', id) };
  const releaseId = selected.manifest?.id ?? id;
  const manifest = await verify(selected.directory, releaseId, wrangler.version);
  const config = JSON.parse(await fs.readFile(join(selected.directory, 'artifact', 'wrangler.json'), 'utf8'));
  assertDatabaseIsolation(config);
  let build;
  try { build = JSON.parse(await fs.readFile(join(selected.directory, 'artifact', 'dist', 'build.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (command === 'production') {
    let staged;
    try { staged = JSON.parse(await fs.readFile(join(selected.directory, 'staged.json'), 'utf8')); }
    catch { throw new Error(`Release ${releaseId} has no successful staging receipt. A dry run does not approve a production release.`); }
    if (staged.releaseId !== releaseId || staged.digest !== manifest.digest ||
        staged.wranglerVersion !== wrangler.version || staged.worker !== config.name ||
        !/^[a-f0-9-]{36}$/i.test(staged.cloudflareVersionId ?? '')) {
      throw new Error('The staging receipt does not match this release.');
    }
  }
  // Wrangler works on an exact verified copy so it cannot modify the saved artifact.
  const deployment = await fs.mkdtemp(join(tmpdir(), 'jaq-release-'));
  try {
    await copyTree(join(selected.directory, 'artifact'), deployment);
    if ((await fingerprint(deployment, wrangler.version)).digest !== manifest.digest) {
      throw new Error('Release changed while preparing deployment.');
    }
    const deployArgs = ['deploy', '--config', join(deployment, 'wrangler.json'), '--env', command === 'production' ? 'production' : '', '--no-autoconfig'];
    if (config.main) deployArgs.push('--var', `RELEASE_ID:${releaseId}`);
    if (dryRun) deployArgs.push('--dry-run');
    else deployArgs.push('--tag', releaseId, '--message', `Reviewed release ${releaseId}`);
    console.log(`${dryRun ? 'Checking' : 'Deploying'} ${command} release ${releaseId}`);
    if (build?.id) console.log(`App build: ${build.version ?? 'unversioned'} / ${build.id}`);
    const output = await execute({ binary: wrangler.binary, args: deployArgs, cwd: deployment });
    if (!dryRun) {
      const cloudflareVersionId = output.match(/(?:Current|Worker) Version ID:\s*([a-f0-9-]{36})/i)?.[1];
      if (!cloudflareVersionId) throw new Error('Wrangler succeeded but returned no version ID; no success receipt was recorded.');
      await writeReceipt(selected.directory, command === 'stage' ? 'staged.json' : 'production.json', {
        releaseId, digest: manifest.digest, wranglerVersion: wrangler.version,
        worker: command === 'stage' ? config.name : config.env.production.name,
        cloudflareVersionId, build, deployedAt: new Date().toISOString(),
      });
    }
    console.log(dryRun
      ? `Dry run complete. Release ${releaseId} has not been marked successfully staged by this run.`
      : `${command} deployed: ${releaseId}`);
    if (command === 'stage' && !dryRun) console.log(`After reviewing staging: pnpm deploy:production ${releaseId}`);
    return { id: releaseId, directory: selected.directory, dryRun };
  } finally {
    await fs.rm(deployment, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  release().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
