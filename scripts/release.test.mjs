import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { release } from './release.mjs';

const version = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const success = async () => `Current Version ID: ${version}\n`;
const stagingDatabaseId = '11111111-2222-4333-8444-555555555555';
const migrationSql = 'CREATE TABLE beta_feedback (id TEXT PRIMARY KEY, title TEXT NOT NULL);\n';

async function fixture(t, { worker = false, databases = false, configure = () => {} } = {}) {
  const root = await fs.mkdtemp(join(tmpdir(), 'release-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(join(root, 'dist'), { recursive: true });
  await fs.writeFile(join(root, 'dist', 'index.html'), 'reviewed version');
  await fs.writeFile(join(root, 'dist', 'build.json'), JSON.stringify({ version: '1.0.0', id: 'build-before-edit' }));
  await fs.writeFile(join(root, '.env'), 'MUST_NOT_COPY=secret');
  await fs.writeFile(join(root, 'package.json'), '{}');
  await fs.mkdir(join(root, 'node_modules', 'wrangler'), { recursive: true });
  await fs.writeFile(join(root, 'node_modules', 'wrangler', 'package.json'), JSON.stringify({
    name: 'wrangler', version: '4.131.0', bin: { wrangler: 'bin/wrangler.js' },
  }));
  const config = {
    $schema: './node_modules/wrangler/config-schema.json',
    name: 'fixture-staging', assets: { directory: './dist' },
    routes: [{ pattern: 'staging.example.com', custom_domain: true }],
    env: { production: { name: 'fixture', routes: [{ pattern: 'example.com', custom_domain: true }] } },
  };
  if (worker) {
    config.main = 'cloudflare/worker.js';
    await fs.mkdir(join(root, 'cloudflare'));
    await fs.writeFile(join(root, 'cloudflare', 'worker.js'), 'export default { fetch() { return new Response("reviewed worker"); } };');
  }
  if (databases) {
    config.vars = {
      BETA_ENABLED: 'true', BETA_OWNER: 'owner@gmail.com', BETA_TESTERS: 'owner@gmail.com,tester@gmail.com',
      ACCESS_TEAM_DOMAIN: 'fixture.cloudflareaccess.com', ACCESS_AUD: 'a'.repeat(64),
    };
    config.d1_databases = [{ binding: 'BETA_DB', database_name: 'fixture-beta-staging', database_id: stagingDatabaseId, migrations_dir: './cloudflare/migrations' }];
    config.env.production.vars = { BETA_ENABLED: 'false' };
    config.env.production.d1_databases = [];
    await fs.mkdir(join(root, 'cloudflare', 'migrations'), { recursive: true });
    await fs.writeFile(join(root, 'cloudflare', 'migrations', '0001_beta_feedback.sql'), migrationSql);
  }
  configure(config);
  // Also exercise JSONC comments and a trailing comma.
  await fs.writeFile(join(root, 'wrangler.jsonc'), `// release config\n${JSON.stringify(config).replace(/}$/, ',}')}\n`);
  return root;
}

function privateSettings() {
  return {
    vars: {
      BETA_OWNER: 'owner@gmail.com', BETA_TESTERS: 'owner@gmail.com,tester@gmail.com',
      BETA_EMAIL_FROM: 'feedback@example.com', ACCESS_TEAM_DOMAIN: 'fixture.cloudflareaccess.com', ACCESS_AUD: 'a'.repeat(64),
    },
    d1_databases: [{ binding: 'BETA_DB', database_name: 'fixture-beta-staging', database_id: stagingDatabaseId, migrations_dir: './cloudflare/migrations' }],
    send_email: [{ name: 'BETA_EMAIL', destination_address: 'owner@gmail.com', allowed_sender_addresses: ['feedback@example.com'] }],
  };
}

async function privateFixture(t, overrides = privateSettings()) {
  const root = await fixture(t, { worker: true, databases: true, configure: (config) => {
    config.vars = { BETA_ENABLED: 'true', BETA_EMAIL_ENABLED: 'true' };
    config.d1_databases = [];
    config.send_email = [];
    config.triggers = { crons: ['*/5 * * * *'] };
    config.env.production.vars = { BETA_ENABLED: 'false', BETA_EMAIL_ENABLED: 'false' };
    config.env.production.send_email = [];
    config.env.production.triggers = { crons: [] };
  } });
  if (overrides !== null) {
    await fs.mkdir(join(root, '.private'));
    await fs.writeFile(join(root, '.private', 'staging.json'), JSON.stringify(overrides));
  }
  return root;
}

test('new staging snapshots resolve private bindings outside public files, leaving production isolated', async (t) => {
  const root = await privateFixture(t);
  await fs.writeFile(join(root, '.private', 'unrelated.txt'), 'DO_NOT_COPY');
  let stagedConfig;
  const staged = await release({ root, args: ['stage'], execute: async (call) => {
    stagedConfig = JSON.parse(await fs.readFile(join(call.cwd, 'wrangler.json'), 'utf8'));
    assert.equal(stagedConfig.vars.BETA_OWNER, 'owner@gmail.com');
    assert.equal(stagedConfig.vars.BETA_TESTERS, 'owner@gmail.com,tester@gmail.com');
    assert.equal(stagedConfig.vars.BETA_EMAIL_RECIPIENT, 'owner@gmail.com');
    assert.equal(stagedConfig.vars.BETA_EMAIL_SENDER, 'feedback@example.com');
    assert.equal(stagedConfig.d1_databases[0].database_id, stagingDatabaseId);
    assert.deepEqual(stagedConfig.send_email, privateSettings().send_email);
    assert.deepEqual(stagedConfig.routes, [{ pattern: 'staging.example.com', custom_domain: true }]);
    assert.deepEqual(stagedConfig.env.production.vars, { BETA_ENABLED: 'false', BETA_EMAIL_ENABLED: 'false' });
    assert.deepEqual(stagedConfig.env.production.d1_databases, []);
    assert.deepEqual(stagedConfig.env.production.send_email, []);
    assert.deepEqual(stagedConfig.env.production.triggers, { crons: [] });
    await assert.rejects(fs.access(join(call.cwd, '.private')));
    await assert.rejects(fs.access(join(call.cwd, 'dist', '.private')));
    assert.deepEqual((await fs.readdir(join(call.cwd, 'dist'))).sort(), ['build.json', 'index.html']);
    assert.doesNotMatch(await fs.readFile(join(call.cwd, 'dist', 'index.html'), 'utf8'), /owner@gmail\.com|tester@gmail\.com/);
    return success();
  } });
  const manifest = JSON.parse(await fs.readFile(join(staged.directory, 'manifest.json'), 'utf8'));
  assert.ok(manifest.files.every((file) => !file.path.includes('.private') && !file.path.endsWith('staging.json')));
  // Existing frozen releases must be independent of subsequent private setup changes.
  await fs.writeFile(join(root, '.private', 'staging.json'), '{invalid local edits');
  await fs.writeFile(join(root, 'wrangler.jsonc'), '{}');
  await release({ root, args: ['production', staged.id], execute: async (call) => {
    assert.deepEqual(JSON.parse(await fs.readFile(join(call.cwd, 'wrangler.json'), 'utf8')), stagedConfig);
    assert.equal(call.args[call.args.indexOf('--env') + 1], 'production');
    return success();
  } });
});

test('an enabled beta public clone without private setup fails before deployment with setup instructions', async (t) => {
  const root = await privateFixture(t, null);
  let invoked = false;
  await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: async () => { invoked = true; return success(); } }), /Copy cloudflare\/staging\.example\.json to \.private\/staging\.json/);
  assert.equal(invoked, false);
  assert.equal(await fs.readFile(join(root, 'dist', 'index.html'), 'utf8'), 'reviewed version');
});

for (const field of ['BETA_OWNER', 'BETA_TESTERS', 'ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'BETA_EMAIL_FROM']) {
  test(`enabled beta rejects a private setup missing ${field}`, async (t) => {
    const settings = privateSettings();
    delete settings.vars[field];
    const root = await privateFixture(t, settings);
    await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: success }), /configuration is missing or invalid|recipient and sole sender must match/);
  });
}

for (const field of ['d1_databases', 'send_email']) {
  test(`enabled beta rejects private setup missing ${field}`, async (t) => {
    const settings = privateSettings();
    delete settings[field];
    const root = await privateFixture(t, settings);
    await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: success }), /configuration is missing or invalid/);
  });
}

for (const extra of [
  { env: { production: { vars: { BETA_ENABLED: 'true' } } } },
  { routes: [{ pattern: 'public.example.com' }] },
  { name: 'production-worker' },
  { workers_dev: true },
  { triggers: { crons: ['* * * * *'] } },
  { vars: { BETA_ENABLED: 'false' } },
  { vars: { BETA_EMAIL_RECIPIENT: 'another@gmail.com' } },
  { vars: { BETA_EMAIL_SENDER: 'another@example.com' } },
]) {
  test(`private setup rejects routing, production, or policy override ${JSON.stringify(extra)}`, async (t) => {
    const root = await privateFixture(t, { ...privateSettings(), ...extra });
    let invoked = false;
    await assert.rejects(release({ root, args: ['stage'], execute: async () => { invoked = true; return success(); } }), /only .* are allowed/);
    assert.equal(invoked, false);
  });
}

test('private setup rejects unrestricted email, mismatched addresses, and arbitrary database bindings', async (t) => {
  const changes = [
    (settings) => { delete settings.send_email[0].destination_address; },
    (settings) => { settings.send_email[0].destination_address = 'another@gmail.com'; },
    (settings) => { settings.send_email[0].allowed_sender_addresses.push('another@example.com'); },
    (settings) => { settings.send_email[0].allowed_destination_addresses = ['another@gmail.com']; },
    (settings) => { settings.d1_databases[0].binding = 'PRODUCTION_DB'; },
    (settings) => { settings.d1_databases[0].database_id = 'REPLACE_ME'; },
    (settings) => { settings.d1_databases[0].migrations_dir = './dist'; },
  ];
  for (const change of changes) {
    const settings = privateSettings();
    change(settings);
    const root = await privateFixture(t, settings);
    await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: success }), /Invalid \.private\/staging\.json/);
  }
});

test('private setup rejects malformed JSON and symlinks without disclosing its contents', async (t) => {
  const root = await privateFixture(t);
  const path = join(root, '.private', 'staging.json');
  await fs.writeFile(path, '{"sensitive-value":');
  await assert.rejects(release({ root, args: ['stage'], execute: success }), /^Error: Invalid JSON in \.private\/staging\.json\.$/);
  await fs.rm(path);
  await fs.symlink(join(root, '.env'), path);
  await assert.rejects(release({ root, args: ['stage'], execute: success }), /not a symlink/);
});

test('staging rejects an accidentally copied private directory in public dist', async (t) => {
  const root = await privateFixture(t);
  await fs.mkdir(join(root, 'dist', '.private'));
  await fs.copyFile(join(root, '.private', 'staging.json'), join(root, 'dist', '.private', 'staging.json'));
  await assert.rejects(release({ root, args: ['stage'], execute: success }), /Refusing to snapshot private configuration files/);
});

test('production deploys the staged config, Worker and assets after the checkout changes', async (t) => {
  const root = await fixture(t, { worker: true });
  const calls = [];
  const execute = async (call) => {
    calls.push({
      ...call,
      page: await fs.readFile(join(call.cwd, 'dist', 'index.html'), 'utf8'),
      worker: await fs.readFile(join(call.cwd, 'worker.js'), 'utf8'),
      config: JSON.parse(await fs.readFile(join(call.cwd, 'wrangler.json'), 'utf8')),
    });
    await assert.rejects(fs.access(join(call.cwd, '.env')));
    // Wrangler's temporary output must never contaminate the stored artifact.
    await fs.writeFile(join(call.cwd, 'generated.tmp'), 'temporary');
    return success();
  };
  const staged = await release({ root, args: ['stage'], execute });
  await fs.writeFile(join(root, 'dist', 'index.html'), 'unreviewed version');
  await fs.writeFile(join(root, 'cloudflare', 'worker.js'), 'unreviewed worker');
  await fs.writeFile(join(root, 'wrangler.jsonc'), '{}');
  await release({ root, args: ['production', staged.id], execute });
  assert.equal(calls[1].page, calls[0].page);
  assert.equal(calls[1].worker, calls[0].worker);
  assert.deepEqual(calls[1].config, calls[0].config);
  assert.equal(calls[0].args[calls[0].args.indexOf('--env') + 1], '');
  assert.equal(calls[1].args[calls[1].args.indexOf('--env') + 1], 'production');
  assert.ok(calls[1].args.includes(`RELEASE_ID:${staged.id}`));
  assert.equal(calls[1].config.assets.directory, './dist');
  assert.equal(calls[1].config.main, './worker.js');
  assert.equal(calls[1].config.$schema, undefined);
  const receipt = JSON.parse(await fs.readFile(join(staged.directory, 'staged.json'), 'utf8'));
  assert.equal(receipt.cloudflareVersionId, version);
  assert.equal(receipt.build.id, 'build-before-edit');
  await assert.rejects(fs.access(join(staged.directory, 'artifact', 'generated.tmp')));
});

test('dry runs do not create staging receipts and cannot authorize production', async (t) => {
  const root = await fixture(t);
  const staged = await release({ root, args: ['--dry-run', 'stage'], execute: async (call) => {
    assert.ok(call.args.includes('--dry-run'));
    return '';
  } });
  await assert.rejects(fs.access(join(staged.directory, 'staged.json')));
  await assert.rejects(release({ root, args: ['production', '--dry-run', staged.id], execute: success }), /no successful staging receipt/);
});

test('failed staging and missing Wrangler version output create no successful receipt', async (t) => {
  const root = await fixture(t);
  const staged = await release({ root, args: ['stage', '--dry-run'], execute: success });
  await assert.rejects(release({ root, args: ['stage'], execute: async () => { throw new Error('upload failed'); } }), /upload failed/);
  await assert.rejects(fs.access(join(staged.directory, 'staged.json')));
  await assert.rejects(release({ root, args: ['stage'], execute: async () => 'Uploaded' }), /no version ID/);
  await assert.rejects(fs.access(join(staged.directory, 'staged.json')));
});

for (const change of ['asset', 'config', 'extra-file', 'receipt', 'wrangler']) {
  test(`production rejects ${change} drift before invoking Wrangler`, async (t) => {
    const root = await fixture(t);
    const staged = await release({ root, args: ['stage'], execute: success });
    if (change === 'asset') await fs.writeFile(join(staged.directory, 'artifact', 'dist', 'index.html'), 'modified');
    if (change === 'config') await fs.writeFile(join(staged.directory, 'artifact', 'wrangler.json'), '{}');
    if (change === 'extra-file') await fs.writeFile(join(staged.directory, 'artifact', 'dist', 'extra.html'), 'not reviewed');
    if (change === 'receipt') await fs.writeFile(join(staged.directory, 'staged.json'), '{}');
    if (change === 'wrangler') await fs.writeFile(join(root, 'node_modules', 'wrangler', 'package.json'), JSON.stringify({ version: '4.999.0', bin: { wrangler: 'bin/wrangler.js' } }));
    let invoked = false;
    await assert.rejects(release({ root, args: ['production', staged.id], execute: async () => { invoked = true; return success(); } }), /integrity|receipt|Wrangler version/);
    assert.equal(invoked, false);
  });
}

test('a production dry run preserves staging receipt and creates no production receipt', async (t) => {
  const root = await fixture(t);
  const staged = await release({ root, args: ['stage'], execute: success });
  const before = await fs.readFile(join(staged.directory, 'staged.json'), 'utf8');
  await release({ root, args: ['production', '--dry-run', staged.id], execute: async () => '' });
  assert.equal(await fs.readFile(join(staged.directory, 'staged.json'), 'utf8'), before);
  await assert.rejects(fs.access(join(staged.directory, 'production.json')));
});

test('staging rejects secrets files and symbolic links in assets', async (t) => {
  const root = await fixture(t);
  await fs.writeFile(join(root, 'dist', '.env.production'), 'secret');
  await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: success }), /secrets file/);
  await fs.rm(join(root, 'dist', '.env.production'));
  await fs.symlink(join(root, '.env'), join(root, 'dist', 'linked.txt'));
  await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: success }), /symlinks/);
});

test('production always requires an explicit exact release ID', async (t) => {
  const root = await fixture(t);
  for (const args of [['production'], ['production', '../escape'], ['production', 'latest'], ['stage', '--env', 'production']]) {
    await assert.rejects(release({ root, args, execute: success }), /Usage:/);
  }
});

test('releases freeze SQL migrations outside public assets and preserve the isolated production bindings', async (t) => {
  const root = await fixture(t, { worker: true, databases: true, configure: config => {
    config.send_email = [{ name: 'BETA_EMAIL', destination_address: 'owner@example.com' }];
    config.triggers = { crons: ['*/5 * * * *'] };
    config.env.production.send_email = [];
    config.env.production.triggers = { crons: [] };
  } });
  const calls = [];
  const execute = async (call) => {
    const config = JSON.parse(await fs.readFile(join(call.cwd, 'wrangler.json'), 'utf8'));
    const directory = config.d1_databases[0].migrations_dir;
    assert.match(directory, /^\.\/migrations\//);
    calls.push({
      config,
      migration: await fs.readFile(join(call.cwd, directory, '0001_beta_feedback.sql'), 'utf8'),
      worker: await fs.readFile(join(call.cwd, 'worker.js'), 'utf8'),
    });
    await assert.rejects(fs.access(join(call.cwd, 'dist', 'migrations')));
    await assert.rejects(fs.access(join(call.cwd, 'cloudflare')));
    return success();
  };
  const staged = await release({ root, args: ['stage'], execute });
  await fs.writeFile(join(root, 'cloudflare', 'migrations', '0001_beta_feedback.sql'), 'DROP TABLE beta_feedback;');
  await fs.writeFile(join(root, 'cloudflare', 'worker.js'), 'unreviewed worker');
  await release({ root, args: ['production', staged.id], execute });
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(calls[1].migration, migrationSql);
  assert.equal(calls[1].config.vars.BETA_ENABLED, 'true');
  assert.equal(calls[1].config.env.production.vars.BETA_ENABLED, 'false');
  assert.deepEqual(calls[1].config.env.production.d1_databases, []);
  assert.deepEqual(calls[1].config.send_email, [{ name: 'BETA_EMAIL', destination_address: 'owner@example.com' }]);
  assert.deepEqual(calls[1].config.triggers, { crons: ['*/5 * * * *'] });
  assert.deepEqual(calls[1].config.env.production.send_email, []);
  assert.deepEqual(calls[1].config.env.production.triggers, { crons: [] });
  const manifest = JSON.parse(await fs.readFile(join(staged.directory, 'manifest.json'), 'utf8'));
  assert.ok(manifest.files.some((file) => file.path === 'migrations/0/0001_beta_feedback.sql'));
  assert.ok(manifest.files.every((file) => !file.path.startsWith('dist/') || !file.path.endsWith('.sql')));
});

test('production rejects migration changes inside a frozen artifact before invoking Wrangler', async (t) => {
  const root = await fixture(t, { databases: true });
  const staged = await release({ root, args: ['stage'], execute: success });
  await fs.writeFile(join(staged.directory, 'artifact', 'migrations', '0', '0001_beta_feedback.sql'), 'DROP TABLE beta_feedback;');
  let invoked = false;
  await assert.rejects(release({ root, args: ['production', staged.id], execute: async () => { invoked = true; return success(); } }), /integrity/);
  assert.equal(invoked, false);
});

for (const field of ['database_id', 'preview_database_id']) {
  test(`staging rejects a production ${field} that points to its database before invoking Wrangler`, async (t) => {
    const root = await fixture(t, { databases: true, configure: (config) => {
      config.env.production.d1_databases = [{ binding: 'RENAMED_PRODUCTION_DB', database_id: 'aaaaaaaa-2222-4333-8444-555555555555', [field]: stagingDatabaseId.toUpperCase() }];
    } });
    let invoked = false;
    await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: async () => { invoked = true; return success(); } }), /cannot share a D1/);
    assert.equal(invoked, false);
  });
}

test('staging also rejects its preview database being bound to production', async (t) => {
  const root = await fixture(t, { databases: true, configure: (config) => {
    config.d1_databases[0].preview_database_id = 'preview-id';
    config.env.production.d1_databases = [{ binding: 'PRODUCTION_DB', database_id: 'preview-id' }];
  } });
  await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: success }), /cannot share a D1/);
});

test('staging requires production to explicitly declare its database bindings', async (t) => {
  const root = await fixture(t, { databases: true, configure: (config) => { delete config.env.production.d1_databases; } });
  await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: success }), /explicitly declare d1_databases/);
});

for (const path of ['../migrations', './cloudflare/../cloudflare/migrations', '.', tmpdir(), './dist/migrations']) {
  test(`staging rejects the unsafe migrations directory ${path}`, async (t) => {
    const root = await fixture(t, { databases: true, configure: (config) => { config.d1_databases[0].migrations_dir = path; } });
    let invoked = false;
    await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: async () => { invoked = true; return success(); } }), /path traversal|inside the project|outside the public/);
    assert.equal(invoked, false);
  });
}

for (const link of ['directory', 'ancestor', 'file']) {
  test(`staging rejects a migration ${link} symlink`, async (t) => {
    const root = await fixture(t, { databases: true });
    if (link === 'directory') {
      await fs.rename(join(root, 'cloudflare', 'migrations'), join(root, 'actual-migrations'));
      await fs.symlink(join(root, 'actual-migrations'), join(root, 'cloudflare', 'migrations'));
    } else if (link === 'ancestor') {
      await fs.rename(join(root, 'cloudflare'), join(root, 'actual-cloudflare'));
      await fs.symlink(join(root, 'actual-cloudflare'), join(root, 'cloudflare'));
    } else {
      await fs.symlink(join(root, '.env'), join(root, 'cloudflare', 'migrations', '0002_link.sql'));
    }
    await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: success }), /symlinks/);
  });
}

for (const name of ['.env', '.env.sql', '.dev.vars.beta', 'credentials.json']) {
  test(`staging refuses to copy ${name} from a migration directory`, async (t) => {
    const root = await fixture(t, { databases: true });
    await fs.writeFile(join(root, 'cloudflare', 'migrations', name), 'MUST_NOT_COPY=secret');
    await assert.rejects(release({ root, args: ['stage', '--dry-run'], execute: success }), /secrets file|only SQL files/);
  });
}

test('the default D1 migrations directory is frozen and multiple bindings share one frozen copy', async (t) => {
  const root = await fixture(t, { databases: true, configure: (config) => {
    delete config.d1_databases[0].migrations_dir;
    config.env.production.d1_databases = [{ binding: 'UNRELATED_DB', database_id: 'separate-production-id' }];
  } });
  await fs.rename(join(root, 'cloudflare', 'migrations'), join(root, 'migrations'));
  const staged = await release({ root, args: ['stage', '--dry-run'], execute: async (call) => {
    const config = JSON.parse(await fs.readFile(join(call.cwd, 'wrangler.json'), 'utf8'));
    assert.equal(config.d1_databases[0].migrations_dir, config.env.production.d1_databases[0].migrations_dir);
    assert.equal(await fs.readFile(join(call.cwd, config.d1_databases[0].migrations_dir, '0001_beta_feedback.sql'), 'utf8'), migrationSql);
    return '';
  } });
  assert.deepEqual(await fs.readdir(join(staged.directory, 'artifact', 'migrations')), ['0']);
});
