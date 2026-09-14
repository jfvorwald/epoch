import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGIN = 'https://epoch-staging.jaqstudios.com';
const OWNER = 'epoch-test-owner@gmail.com';
const TESTER = 'epoch-test-pilot@gmail.com';
const ISSUER = 'https://jaqstudios.cloudflareaccess.com';
const AUDIENCE = 'test-staging-audience';
const ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const baseMigration = readFileSync(new URL('../cloudflare/migrations/0001_beta_feedback.sql', import.meta.url), 'utf8');
const emailMigration = readFileSync(new URL('../cloudflare/migrations/0002_beta_feedback_email.sql', import.meta.url), 'utf8');
const migration = `${baseMigration}\n${emailMigration}`;
let keys: CryptoKeyPair;
let publicJwk: JsonWebKey & { kid: string };

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function signedToken(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const prefix = `${encode({ alg: 'RS256', kid: 'test-signing-key', typ: 'JWT', ...header })}.${encode({
    iss: ISSUER, aud: [AUDIENCE], exp: now + 600, iat: now - 1, email: OWNER, ...claims,
  })}`;
  const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(prefix));
  return `${prefix}.${Buffer.from(signature).toString('base64url')}`;
}

// Exercise the actual migration and parameterized SQL through a D1-shaped SQLite adapter.
function d1(database: DatabaseSync) {
  return {
    prepare: vi.fn((sql: string) => {
      const statement = database.prepare(sql);
      let values: (string | number | null)[] = [];
      const prepared = {
        bind(...parameters: (string | number | null)[]) { values = parameters; return prepared; },
        async first() { return statement.get(...values) ?? null; },
        async all() { return { success: true, results: statement.all(...values) }; },
        async run() { return { success: true, meta: { changes: Number(statement.run(...values).changes) } }; },
      };
      return prepared;
    }),
  };
}

type BackgroundContext = { waitUntil(work: Promise<void>): void };
type Worker = {
  fetch(request: Request, env: any, context?: BackgroundContext): Promise<Response>;
  scheduled(event: unknown, env: any, context?: BackgroundContext): Promise<void>;
};
let worker: Worker;
let database: DatabaseSync;
let env: any;
let ownerToken: string;
let testerToken: string;
let fetchCertificates: ReturnType<typeof vi.fn>;

async function call(path = '/api/beta/session', options: {
  token?: string | null; method?: string; body?: unknown; rawBody?: string;
  headers?: Record<string, string>; origin?: string; context?: BackgroundContext;
} = {}) {
  const method = options.method ?? 'GET';
  const headers = new Headers(options.headers);
  const token = options.token === undefined ? ownerToken : options.token;
  if (token) headers.set('Cf-Access-Jwt-Assertion', token);
  if (method === 'POST' || method === 'PATCH') {
    if (!headers.has('Origin')) headers.set('Origin', ORIGIN);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }
  const request = new Request(`${options.origin ?? ORIGIN}${path}`, {
    method, headers,
    ...(options.body === undefined && options.rawBody === undefined ? {} : { body: options.rawBody ?? JSON.stringify(options.body) }),
  });
  return worker.fetch(request, env, options.context);
}

function report(overrides: Record<string, unknown> = {}) {
  return { id: ID, type: 'bug', title: 'Guardian stops moving', description: 'The final wave guardian froze after I paused.', build: 'staging-test-001', level: 8, wave: 9, ship: 'viper', ...overrides };
}

beforeAll(async () => {
  keys = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  publicJwk = { ...await webcrypto.subtle.exportKey('jwk', keys.publicKey), kid: 'test-signing-key' };
});

beforeEach(async () => {
  vi.resetModules();
  worker = (await import('../cloudflare/worker.js')).default;
  database = new DatabaseSync(':memory:');
  database.exec(migration);
  env = {
    BETA_ENABLED: 'true', ACCESS_TEAM_DOMAIN: 'jaqstudios.cloudflareaccess.com', ACCESS_AUD: AUDIENCE,
    BETA_TESTERS: `${OWNER},${TESTER}`, BETA_OWNER: OWNER, BETA_DB: d1(database),
    BETA_EMAIL_ENABLED: 'true', BETA_EMAIL_FROM: 'feedback@beta.example.com',
    BETA_EMAIL_RECIPIENT: OWNER, BETA_EMAIL_SENDER: 'feedback@beta.example.com',
    BETA_EMAIL: { send: vi.fn(async () => ({ messageId: 'provider-test-message' })) },
    ASSETS: { fetch: vi.fn(async () => new Response('game assets')) },
  };
  fetchCertificates = vi.fn(async () => Response.json({ keys: [publicJwk] }));
  vi.stubGlobal('fetch', fetchCertificates);
  ownerToken = await signedToken();
  testerToken = await signedToken({ email: TESTER });
});

afterEach(() => {
  database.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('staging beta boundary and verified identity', () => {
  it.each(['https://epoch.jaqstudios.com', 'https://epoch.example.workers.dev', 'https://preview.epoch.example.workers.dev', 'http://epoch-staging.jaqstudios.com'])('returns private no-store 404 on %s before auth or storage', async origin => {
    delete env.ACCESS_AUD;
    const response = await call('/api/beta/feedback', { origin, method: 'POST', body: report() });
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchCertificates).not.toHaveBeenCalled();
    expect(env.BETA_DB.prepare).not.toHaveBeenCalled();
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });

  it('serves game assets separately and rejects beta APIs unless explicitly enabled', async () => {
    env.BETA_ENABLED = 'false';
    expect((await call()).status).toBe(404);
    expect(await (await call('/assets/game.js', { origin: 'https://epoch.jaqstudios.com', token: null })).text()).toBe('game assets');
    expect(fetchCertificates).not.toHaveBeenCalled();
  });

  it.each(['BETA_DB', 'BETA_TESTERS', 'BETA_OWNER', 'ACCESS_TEAM_DOMAIN', 'ACCESS_AUD'])('fails closed when %s is absent', async key => {
    delete env[key];
    expect((await call()).status).toBe(503);
    expect(fetchCertificates).not.toHaveBeenCalled();
  });

  it('rejects an unsafe certificate host without making a request', async () => {
    env.ACCESS_TEAM_DOMAIN = 'jaqstudios.cloudflareaccess.com.attacker.example';
    expect((await call()).status).toBe(503);
    expect(fetchCertificates).not.toHaveBeenCalled();
  });

  it('uses signed identity and ignores the asserted email header and cookies', async () => {
    expect((await call('/api/beta/session', { token: null, headers: { 'Cf-Access-Authenticated-User-Email': OWNER, Cookie: 'CF_Authorization=forged' } })).status).toBe(401);
    const response = await call('/api/beta/session', { token: testerToken, headers: { 'Cf-Access-Authenticated-User-Email': OWNER } });
    expect(await response.json()).toEqual({ email: TESTER, isOwner: false });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    ['expired', () => ({ exp: Math.floor(Date.now() / 1000) - 1 })],
    ['wrong audience', () => ({ aud: ['production-audience'] })],
    ['wrong issuer', () => ({ iss: 'https://other.cloudflareaccess.com' })],
    ['future not-before', () => ({ nbf: Math.floor(Date.now() / 1000) + 600 })],
    ['missing expiry', () => ({ exp: undefined })],
  ] as const)('rejects a signed token with %s', async (_name, claims) => {
    expect((await call('/api/beta/session', { token: await signedToken(claims()) })).status).toBe(401);
    expect(env.BETA_DB.prepare).not.toHaveBeenCalled();
  });

  it('rejects algorithm substitution, malformed tokens, and a tampered signed payload', async () => {
    for (const token of ['forged', await signedToken({}, { alg: 'none' }), await signedToken({}, { alg: 'HS256' })]) {
      expect((await call('/api/beta/session', { token })).status).toBe(401);
    }
    const parts = ownerToken.split('.');
    parts[1] = encode({ ...JSON.parse(Buffer.from(parts[1], 'base64url').toString()), email: TESTER });
    expect((await call('/api/beta/session', { token: parts.join('.') })).status).toBe(401);
  });

  it('rejects a verified identity outside the exact roster', async () => {
    expect((await call('/api/beta/session', { token: await signedToken({ email: 'uninvited@gmail.com' }) })).status).toBe(403);
    expect((await call('/api/beta/session', { token: await signedToken({ email: 'jfvorwald+other@gmail.com' }) })).status).toBe(403);
  });

  it('caches trusted certificates and rejects unknown keys without fetching repeatedly', async () => {
    expect((await call()).status).toBe(200);
    expect((await call('/api/beta/session', { token: testerToken })).status).toBe(200);
    expect((await call('/api/beta/session', { token: await signedToken({}, { kid: 'unknown' }) })).status).toBe(401);
    expect(fetchCertificates).toHaveBeenCalledTimes(1);
    expect(fetchCertificates).toHaveBeenCalledWith(`${ISSUER}/cdn-cgi/access/certs`, expect.objectContaining({ redirect: 'manual' }));
  });

  it('fails closed when certificate retrieval is unavailable or malformed', async () => {
    fetchCertificates.mockRejectedValueOnce(new Error('Network failure'));
    expect((await call()).status).toBe(503);
    fetchCertificates.mockResolvedValueOnce(Response.json({ keys: [] }));
    expect((await call()).status).toBe(503);
    fetchCertificates.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://untrusted.example/certs' } }));
    expect((await call()).status).toBe(503);
    expect(fetchCertificates).toHaveBeenCalledTimes(3);
  });
});

describe('private beta feedback', () => {
  it('stores a report with server identity, status, time, and browser context', async () => {
    const response = await call('/api/beta/feedback', { token: testerToken, method: 'POST', headers: { 'User-Agent': 'beta-test-browser' }, body: report({ email: OWNER, status: 'fixed', userAgent: 'spoofed', createdAt: 'spoofed' }) });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: ID });
    const result = await (await call('/api/beta/feedback', { token: testerToken })).json();
    expect(result.testers).toBeUndefined();
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]).toEqual({ ...report(), email: TESTER, status: 'new', createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/), userAgent: 'beta-test-browser' });
  });

  it('limits testers to their reports and makes the roster and all reports visible only to the owner', async () => {
    await call('/api/beta/feedback', { method: 'POST', body: report({ type: 'idea' }) });
    await call('/api/beta/feedback', { token: testerToken, method: 'POST', body: report({ id: OTHER_ID }) });
    const own = await (await call('/api/beta/feedback', { token: testerToken })).json();
    expect(own.reports.map((item: any) => item.id)).toEqual([OTHER_ID]);
    expect(Object.keys(own)).toEqual(['reports']);
    const all = await (await call('/api/beta/feedback')).json();
    expect(all.reports).toHaveLength(2);
    expect(all.testers).toEqual([OWNER, TESTER]);
  });

  it('makes retries idempotent without replacing the first report or accepting another user’s ID', async () => {
    expect((await call('/api/beta/feedback', { token: testerToken, method: 'POST', body: report() })).status).toBe(201);
    const retry = await call('/api/beta/feedback', { token: testerToken, method: 'POST', body: report({ title: 'Changed on retry' }) });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ id: ID });
    expect((await call('/api/beta/feedback', { method: 'POST', body: report() })).status).toBe(409);
    const result = await (await call('/api/beta/feedback')).json();
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0].title).toBe('Guardian stops moving');
    expect(result.reports[0].email).toBe(TESTER);
  });

  it('allows only the owner to change status, with no content or identity changes', async () => {
    await call('/api/beta/feedback', { token: testerToken, method: 'POST', body: report() });
    const path = `/api/beta/feedback/${ID}`;
    expect((await call(path, { token: testerToken, method: 'PATCH', body: { status: 'fixed' } })).status).toBe(403);
    for (const status of ['planned', 'fixed', 'new']) {
      expect(await (await call(path, { method: 'PATCH', body: { status, email: OWNER, title: 'overwrite' } })).json()).toEqual({ id: ID, status });
    }
    expect((await call(path, { method: 'PATCH', body: { status: 'deleted' } })).status).toBe(400);
    expect((await call(`/api/beta/feedback/${OTHER_ID}`, { method: 'PATCH', body: { status: 'fixed' } })).status).toBe(404);
    const result = await (await call('/api/beta/feedback')).json();
    expect(result.reports[0]).toMatchObject({ email: TESTER, title: report().title, status: 'new' });
  });

  it.each([
    { id: 'not-a-uuid' }, { type: 'feature' }, { title: '' }, { title: ' '.repeat(10) }, { title: 'x'.repeat(121) },
    { description: '' }, { description: 'x'.repeat(4001) }, { build: 'x'.repeat(81) }, { ship: 'x'.repeat(41) },
    { level: 0 }, { level: 1.5 }, { wave: -1 }, { wave: '3' }, { title: 'bad\u0000title' },
  ])('rejects invalid report fields %j without writing', async invalid => {
    expect((await call('/api/beta/feedback', { method: 'POST', body: report(invalid) })).status).toBe(400);
    expect(env.BETA_DB.prepare).not.toHaveBeenCalled();
  });

  it('permits nullable game context and safely stores SQL-looking text', async () => {
    const title = "It's stuck'); DROP TABLE beta_feedback; --";
    expect((await call('/api/beta/feedback', { method: 'POST', body: report({ title, level: null, wave: null, ship: '', build: '' }) })).status).toBe(201);
    expect((await (await call('/api/beta/feedback')).json()).reports[0]).toMatchObject({ title, level: null, wave: null });
  });

  it.each([
    { Origin: 'https://attacker.example' }, { Origin: '' }, { Origin: 'null' },
    { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' },
  ])('blocks cross-origin mutations %j', async headers => {
    expect((await call('/api/beta/feedback', { method: 'POST', headers, body: report() })).status).toBe(403);
    expect((await call(`/api/beta/feedback/${ID}`, { method: 'PATCH', headers, body: { status: 'fixed' } })).status).toBe(403);
    expect(env.BETA_DB.prepare).not.toHaveBeenCalled();
  });

  it('requires JSON and bounds actual streamed body bytes without relying on Content-Length', async () => {
    expect((await call('/api/beta/feedback', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: report() })).status).toBe(415);
    expect((await call('/api/beta/feedback', { method: 'POST', rawBody: '{invalid' })).status).toBe(400);
    expect((await call('/api/beta/feedback', { method: 'POST', body: [] })).status).toBe(400);
    expect((await call('/api/beta/feedback', { method: 'POST', rawBody: JSON.stringify(report({ description: 'x'.repeat(25000) })) })).status).toBe(413);
    expect(env.BETA_DB.prepare).not.toHaveBeenCalled();
  });

  it('returns safe no-store errors on database failure without claiming success', async () => {
    env.BETA_DB.prepare.mockImplementation(() => { throw new Error(`secret database failure for ${OWNER}`); });
    const response = await call('/api/beta/feedback', { method: 'POST', body: report() });
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toBe('{"error":"Beta feedback is temporarily unavailable."}');
  });
});

describe('owner Markdown feedback inbox', () => {
  it('exports every report and its context as a private downloadable Markdown file', async () => {
    await call('/api/beta/feedback', { method: 'POST', headers: { 'User-Agent': 'owner-browser' }, body: report() });
    await call('/api/beta/feedback', { token: testerToken, method: 'POST', body: report({ id: OTHER_ID, type: 'idea', title: 'More ships', description: 'Please add another ship.', level: null, wave: null }) });
    await call(`/api/beta/feedback/${OTHER_ID}`, { method: 'PATCH', body: { status: 'planned' } });
    const response = await call('/api/beta/feedback.md');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="epoch-beta-feedback.md"');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const text = await response.text();
    expect(text).toMatch(/^# EPOCH staging beta feedback\n\nGenerated: \d{4}-\d\d-\d\dT/);
    expect(text).toContain('Reports: 2');
    for (const value of [ID, OTHER_ID, OWNER, TESTER, 'Guardian stops moving', 'More ships', 'planned', 'bug', 'idea', 'staging-test-001', 'viper', 'owner-browser', 'Please add another ship.']) {
      expect(text).toContain(value);
    }
    expect(text).toContain('    Level: 8\n    Wave: 9');
    expect(text).toContain('    Level: null\n    Wave: null');
    expect(text).toMatch(/    Created: "\d{4}-\d\d-\d\dT/);
    expect(text.match(/^## Report /gm)).toHaveLength(2);
  });

  it('keeps hostile titles and details inside plain-text blocks without Markdown or HTML interpretation', async () => {
    const title = '<script>alert(1)</script>\n## Fake report\n![image](https://attacker.example/i) ` ```';
    const description = '<img src="https://attacker.example/pixel" onerror="alert(1)">\r\n\r\n```\n``````\n~~~\n# Forged heading\n![pixel](https://attacker.example/pixel)\n[link](https://attacker.example/)\n</pre><script>alert(1)</script>\u2028## Unicode heading';
    expect((await call('/api/beta/feedback', { token: testerToken, method: 'POST', body: report({ title, description }) })).status).toBe(201);
    const text = await (await call('/api/beta/feedback.md')).text();
    expect(text).toContain(`    Title: ${JSON.stringify(title)}`);
    expect(text).toContain('    <img src="https://attacker.example/pixel" onerror="alert(1)">');
    expect(text).toContain('    ```\n    ``````\n    ~~~\n    # Forged heading');
    expect(text).toContain('    ![pixel](https://attacker.example/pixel)');
    expect(text).toContain('    </pre><script>alert(1)</script>\n    ## Unicode heading');
    const unindented = text.split('\n').filter(line => line && !line.startsWith('    '));
    expect(unindented).toEqual([
      '# EPOCH staging beta feedback', expect.stringMatching(/^Generated: /), 'Reports: 1', '## Report 1', '### Details',
    ]);
  });

  it('denies other testers, missing authentication, and production before reading feedback', async () => {
    expect((await call('/api/beta/feedback.md', { token: testerToken })).status).toBe(403);
    expect((await call('/api/beta/feedback.md', { token: null })).status).toBe(401);
    expect((await call('/api/beta/feedback.md', { origin: 'https://epoch.jaqstudios.com' })).status).toBe(404);
    expect((await call('/api/beta/feedback.md?view=1', { token: testerToken })).status).toBe(403);
    expect((await call('/api/beta/feedback.md?view=1', { token: null })).status).toBe(401);
    expect(env.BETA_DB.prepare).not.toHaveBeenCalled();
  });

  it('lets the owner read Markdown as inert on-screen text without downloading a file', async () => {
    await call('/api/beta/feedback', { method: 'POST', body: report({ description: '<script>alert(1)</script>' }) });
    const response = await call('/api/beta/feedback.md?view=1');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('inline; filename="epoch-beta-feedback.md"');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await response.text()).toContain('    <script>alert(1)</script>');
  });

  it('exports an empty inbox and rejects attempts to write to the download route', async () => {
    expect(await (await call('/api/beta/feedback.md')).text()).toContain('Reports: 0\n\nNo feedback has been submitted yet.');
    expect((await call('/api/beta/feedback.md', { method: 'POST', body: report() })).status).toBe(405);
  });
});

describe('durable owner email notifications', () => {
  function queued(id = ID) {
    return database.prepare('SELECT * FROM beta_feedback_email_outbox WHERE report_id = ?').get(id) as Record<string, any>;
  }

  async function status() {
    return (await call('/api/beta/notifications')).json();
  }

  it('migrates without emailing historical reports and atomically queues each new report once', () => {
    const legacy = new DatabaseSync(':memory:');
    try {
      legacy.exec(baseMigration);
      const insert = legacy.prepare(`INSERT INTO beta_feedback (id, type, title, description, email, created_at)
        VALUES (?, 'bug', 'Title', 'Details', ?, ?) ON CONFLICT(id) DO NOTHING`);
      insert.run(ID, OWNER, '2026-09-14T00:00:00.000Z');
      legacy.exec(emailMigration);
      expect(legacy.prepare('SELECT COUNT(*) AS count FROM beta_feedback').get()?.count).toBe(1);
      expect(legacy.prepare('SELECT COUNT(*) AS count FROM beta_feedback_email_outbox').get()?.count).toBe(0);
      insert.run(OTHER_ID, TESTER, '2026-09-14T00:01:00.000Z');
      insert.run(OTHER_ID, TESTER, '2026-09-14T00:02:00.000Z');
      expect(legacy.prepare('SELECT * FROM beta_feedback_email_outbox').all()).toEqual([
        expect.objectContaining({ report_id: OTHER_ID, attempts: 0, sent_at: null, queued_at: '2026-09-14T00:01:00.000Z' }),
      ]);
      legacy.exec(`CREATE TRIGGER reject_notification BEFORE INSERT ON beta_feedback_email_outbox
        BEGIN SELECT RAISE(ABORT, 'queue unavailable'); END;`);
      expect(() => insert.run('33333333-3333-4333-8333-333333333333', OWNER, '2026-09-14T00:03:00.000Z')).toThrow('queue unavailable');
      expect(legacy.prepare('SELECT COUNT(*) AS count FROM beta_feedback').get()?.count).toBe(2);
    } finally {
      legacy.close();
    }
  });

  it('saves immediately and sends a plain-text notification only to the approved owner', async () => {
    let release!: () => void;
    const providerGate = new Promise<void>(resolve => { release = resolve; });
    env.BETA_EMAIL.send.mockImplementation(async () => { await providerGate; return { messageId: 'accepted-message-id' }; });
    const work: Promise<void>[] = [];
    const response = await call('/api/beta/feedback', {
      token: testerToken, method: 'POST', context: { waitUntil: promise => { work.push(promise); } },
      body: report({ title: 'Title\r\nBcc: attacker@example.com', description: '<script>unsafe()</script>\nShips 🚀', email: 'attacker@example.com', to: 'attacker@example.com' }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: ID });
    expect(work).toHaveLength(1);
    expect(queued()).toMatchObject({ attempts: 1, sent_at: null });
    release();
    await Promise.all(work);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledTimes(1);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledWith({
      to: OWNER, from: 'feedback@beta.example.com', subject: 'EPOCH staging feedback: new bug',
      text: expect.stringContaining('Title: "Title\\r\\nBcc: attacker@example.com"'), headers: { 'X-Epoch-Report-ID': ID },
    });
    const email = env.BETA_EMAIL.send.mock.calls[0][0];
    expect(email.text).toContain(`Tester: "${TESTER}"`);
    expect(email.text).toContain('<script>unsafe()</script>\nShips 🚀');
    expect(email.text).toContain(`${ORIGIN}/`);
    expect(email).not.toHaveProperty('html');
    expect(email).not.toHaveProperty('bcc');
    expect(email).not.toHaveProperty('replyTo');
    expect(queued()).toMatchObject({ attempts: 1, provider_message_id: 'accepted-message-id', lease_token: null, last_error: null });
    expect(queued().sent_at).toEqual(expect.any(String));
    expect(await status()).toEqual({ configured: true, pending: 0, sent: 1, lastFailure: null });
  });

  it('does not duplicate email when a successful report POST is retried or status changes', async () => {
    expect((await call('/api/beta/feedback', { method: 'POST', body: report() })).status).toBe(201);
    await worker.scheduled({}, env);
    const work: Promise<void>[] = [];
    expect((await call('/api/beta/feedback', {
      method: 'POST', body: report({ title: 'Changed on retry' }), context: { waitUntil: promise => { work.push(promise); } },
    })).status).toBe(200);
    await Promise.all(work);
    await call(`/api/beta/feedback/${ID}`, { method: 'PATCH', body: { status: 'fixed' } });
    await worker.scheduled({}, env);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledTimes(1);
    expect(database.prepare('SELECT COUNT(*) AS count FROM beta_feedback_email_outbox').get()?.count).toBe(1);
    expect(queued().attempts).toBe(1);
  });

  it('recognizes a newly inserted report when D1 counts both the report and its trigger write', async () => {
    const prepare = env.BETA_DB.prepare.getMockImplementation();
    env.BETA_DB.prepare.mockImplementation((sql: string) => {
      const statement = prepare(sql);
      if (sql.startsWith('INSERT INTO beta_feedback\n')) {
        const run = statement.run;
        statement.run = async () => {
          const result = await run();
          return { ...result, meta: { changes: result.meta.changes ? 2 : 0 } };
        };
      }
      return statement;
    });
    expect((await call('/api/beta/feedback', { method: 'POST', body: report() })).status).toBe(201);
    expect((await call('/api/beta/feedback', { method: 'POST', body: report() })).status).toBe(200);
    expect(queued()).toMatchObject({ report_id: ID, attempts: 0 });
  });

  it('keeps saved feedback on provider failure, hides private errors, and retries only when due', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = Date.now();
    env.BETA_EMAIL.send.mockRejectedValueOnce(Object.assign(new Error(`Private error: ${TESTER} and report body`), { code: 'E_RATE_LIMIT_EXCEEDED' }));
    const work: Promise<void>[] = [];
    const response = await call('/api/beta/feedback', { method: 'POST', body: report(), context: { waitUntil: promise => { work.push(promise); } } });
    expect(response.status).toBe(201);
    await Promise.all(work);
    expect((await (await call('/api/beta/feedback')).json()).reports).toHaveLength(1);
    expect(queued()).toMatchObject({ attempts: 1, next_attempt_at: now + 60000, sent_at: null, last_error: 'rate_limited', lease_token: null });
    expect(await status()).toEqual({ configured: true, pending: 1, sent: 0, lastFailure: { code: 'rate_limited', at: new Date(now).toISOString() } });
    await worker.scheduled({}, env);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledTimes(1);
    vi.setSystemTime(now + 60000);
    await worker.scheduled({}, env);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledTimes(2);
    expect(queued()).toMatchObject({ attempts: 2, last_error: null, last_error_at: null });
    expect(await status()).toEqual({ configured: true, pending: 0, sent: 1, lastFailure: null });
  });

  it('bounds retry frequency even after repeated failures without discarding the report', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = Date.now();
    await call('/api/beta/feedback', { method: 'POST', body: report() });
    database.prepare('UPDATE beta_feedback_email_outbox SET attempts = 25 WHERE report_id = ?').run(ID);
    env.BETA_EMAIL.send.mockRejectedValue(new Error('Transient outage'));
    await worker.scheduled({}, env);
    expect(queued()).toMatchObject({ attempts: 26, next_attempt_at: now + 6 * 60 * 60 * 1000, last_error: 'delivery_failed', sent_at: null });
    expect(database.prepare('SELECT COUNT(*) AS count FROM beta_feedback').get()?.count).toBe(1);
  });

  it('prevents overlapping drains from sending a report while another drain holds its lease', async () => {
    await call('/api/beta/feedback', { method: 'POST', body: report() });
    let release!: () => void;
    let announce!: () => void;
    const providerGate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { announce = resolve; });
    env.BETA_EMAIL.send.mockImplementation(async () => { announce(); await providerGate; return { messageId: 'concurrent-message' }; });
    const first = worker.scheduled({}, env);
    await started;
    await worker.scheduled({}, env);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledTimes(1);
    expect(queued().attempts).toBe(1);
    release();
    await first;
    expect(queued().sent_at).toEqual(expect.any(String));
  });

  it('recovers an interrupted delivery after its lease expires', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = Date.now();
    await call('/api/beta/feedback', { method: 'POST', body: report() });
    database.prepare('UPDATE beta_feedback_email_outbox SET lease_token = ?, leased_until = ?, attempts = 1 WHERE report_id = ?')
      .run('interrupted-claim', now + 120000, ID);
    await worker.scheduled({}, env);
    expect(env.BETA_EMAIL.send).not.toHaveBeenCalled();
    vi.setSystemTime(now + 120000);
    await worker.scheduled({}, env);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledTimes(1);
    expect(queued()).toMatchObject({ attempts: 2, lease_token: null });
    expect(queued().sent_at).toEqual(expect.any(String));
  });

  it('retains work if provider acceptance cannot be recorded, with a possible retry after lease expiry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = Date.now();
    await call('/api/beta/feedback', { method: 'POST', body: report() });
    const prepare = env.BETA_DB.prepare.getMockImplementation();
    env.BETA_DB.prepare.mockImplementation((sql: string) => {
      const statement = prepare(sql);
      if (sql.includes('SET sent_at = ?')) statement.run = async () => { throw new Error('Private database failure'); };
      return statement;
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    await worker.scheduled({}, env);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledTimes(1);
    expect(queued()).toMatchObject({ attempts: 1, sent_at: null, leased_until: now + 120000 });
    expect(logged).toHaveBeenCalledWith('EPOCH beta notification processing is temporarily unavailable.');
    env.BETA_DB.prepare.mockImplementation(prepare);
    await worker.scheduled({}, env);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledTimes(1);
    vi.setSystemTime(now + 120000);
    await worker.scheduled({}, env);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledTimes(2);
    expect(env.BETA_EMAIL.send.mock.calls[0][0].headers).toEqual(env.BETA_EMAIL.send.mock.calls[1][0].headers);
    expect(queued()).toMatchObject({ attempts: 2, lease_token: null });
    expect(queued().sent_at).toEqual(expect.any(String));
  });

  it('limits each drain to ten pending emails and leaves the remainder durable', async () => {
    for (let index = 0; index < 11; index += 1) {
      await call('/api/beta/feedback', { method: 'POST', body: report({ id: crypto.randomUUID() }) });
    }
    await worker.scheduled({}, env);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledTimes(10);
    expect(await status()).toMatchObject({ pending: 1, sent: 10 });
    await worker.scheduled({}, env);
    expect(env.BETA_EMAIL.send).toHaveBeenCalledTimes(11);
    expect(await status()).toMatchObject({ pending: 0, sent: 11 });
  });

  it.each([
    ['BETA_ENABLED', 'false'], ['BETA_EMAIL_ENABLED', 'false'], ['BETA_EMAIL', undefined],
    ['BETA_EMAIL_FROM', 'attacker@example.com'], ['BETA_OWNER', TESTER],
    ['BETA_EMAIL_RECIPIENT', undefined], ['BETA_EMAIL_SENDER', undefined],
    ['BETA_EMAIL_RECIPIENT', TESTER], ['BETA_EMAIL_SENDER', 'attacker@example.com'],
  ])('never touches the mail queue or sends when %s is not approved', async (name, value) => {
    await call('/api/beta/feedback', { method: 'POST', body: report() });
    const send = env.BETA_EMAIL.send;
    env[name] = value;
    env.BETA_DB.prepare.mockClear();
    await worker.scheduled({}, env);
    expect(send).not.toHaveBeenCalled();
    expect(env.BETA_DB.prepare).not.toHaveBeenCalled();
    expect(queued()).toMatchObject({ attempts: 0, sent_at: null });
  });

  it('keeps notification status private and does not expose a mail-sending API', async () => {
    expect((await call('/api/beta/notifications', { token: testerToken })).status).toBe(403);
    expect((await call('/api/beta/notifications', { token: null })).status).toBe(401);
    expect((await call('/api/beta/notifications', { origin: 'https://epoch.jaqstudios.com' })).status).toBe(404);
    expect((await call('/api/beta/notifications', { method: 'POST', body: { to: TESTER } })).status).toBe(405);
    expect(env.BETA_DB.prepare).not.toHaveBeenCalled();
    expect(env.BETA_EMAIL.send).not.toHaveBeenCalled();
    env.BETA_EMAIL_ENABLED = 'false';
    const response = await call('/api/beta/notifications');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ configured: false, pending: 0, sent: 0, lastFailure: null });
  });
});
