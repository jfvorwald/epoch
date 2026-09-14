// This entry is copied into immutable releases. Keep it self-contained.
const STAGING_HOST = 'epoch-staging.jaqstudios.com';
const CERTIFICATE_TTL = 5 * 60 * 1000;
const CERTIFICATE_REFRESH_INTERVAL = 30 * 1000;
const MAX_BODY_BYTES = 24 * 1024;
const NOTIFICATION_LEASE_MS = 2 * 60 * 1000;
const NOTIFICATION_BATCH_SIZE = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const certificateCache = new Map();

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Cf-Access-Jwt-Assertion',
    },
  });
}

function configuration(env) {
  const team = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  const testers = typeof env.BETA_TESTERS === 'string'
    ? [...new Set(env.BETA_TESTERS.split(',').map(email => email.trim().toLowerCase()).filter(Boolean))]
    : [];
  const owner = typeof env.BETA_OWNER === 'string' ? env.BETA_OWNER.trim().toLowerCase() : '';
  if (typeof team !== 'string' || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(team)
    || typeof audience !== 'string' || !audience.trim() || !env.BETA_DB
    || !testers.length || testers.some(email => !/^[^\s@]+@gmail\.com$/.test(email))
    || !owner || !testers.includes(owner)) {
    throw new ApiError(503, 'Beta feedback is not configured.');
  }
  return { issuer: `https://${team}`, audience, testers, owner };
}

async function boundedJson(source, limit, tooLargeStatus = 413) {
  const length = source.headers.get('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) {
    throw new ApiError(tooLargeStatus, 'Request is too large.');
  }
  if (!source.body) throw new ApiError(400, 'A JSON body is required.');
  const reader = source.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError(tooLargeStatus, 'Request is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new ApiError(400, 'A valid JSON object is required.');
  }
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid token');
  const encoded = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')), char => char.charCodeAt(0));
}

function decodeClaim(value) {
  const claim = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64Url(value)));
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) throw new Error('Invalid token');
  return claim;
}

async function signingKey(issuer, kid) {
  const now = Date.now();
  let cached = certificateCache.get(issuer);
  let key = cached?.keys.find(candidate => candidate.kid === kid);
  if (!cached || now >= cached.expiresAt || (!key && now >= cached.refreshAfter)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
        // Workerd supports manual redirects, but rejects redirect: 'error'.
        // A redirect is non-OK and is rejected below; never follow another host.
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('Certificates unavailable');
      const body = await boundedJson(response, 64 * 1024, 503);
      if (!Array.isArray(body.keys) || !body.keys.length || body.keys.length > 20) throw new Error('Invalid certificates');
      cached = { keys: body.keys, expiresAt: now + CERTIFICATE_TTL, refreshAfter: now + CERTIFICATE_REFRESH_INTERVAL };
      // Only a configured Access team is consulted; bound isolate memory as well.
      if (certificateCache.size >= 4) certificateCache.delete(certificateCache.keys().next().value);
      certificateCache.set(issuer, cached);
      key = cached.keys.find(candidate => candidate.kid === kid);
    } catch {
      throw new ApiError(503, 'Beta sign-in is temporarily unavailable.');
    } finally {
      clearTimeout(timeout);
    }
  }
  if (!key || key.kty !== 'RSA' || (key.alg && key.alg !== 'RS256') || (key.use && key.use !== 'sig')
    || typeof key.n !== 'string' || typeof key.e !== 'string') {
    throw new ApiError(401, 'Sign in to the staging beta to continue.');
  }
  return crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

async function authenticate(request, config) {
  try {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token || token.length > 16384) throw new Error('Missing token');
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token');
    const header = decodeClaim(parts[0]);
    const claims = decodeClaim(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.kid.length > 256
      || header.crit !== undefined
      || claims.iss !== config.issuer
      || !Number.isSafeInteger(claims.exp) || claims.exp <= now
      || (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now))
      || (claims.iat !== undefined && (!Number.isSafeInteger(claims.iat) || claims.iat > now + 60))
      || !(typeof claims.aud === 'string' ? claims.aud === config.audience
        : Array.isArray(claims.aud) && claims.aud.every(aud => typeof aud === 'string') && claims.aud.includes(config.audience))
      || typeof claims.email !== 'string') throw new Error('Invalid token');
    const key = await signingKey(config.issuer, header.kid);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) throw new Error('Invalid signature');
    const email = claims.email.trim().toLowerCase();
    if (!config.testers.includes(email)) throw new ApiError(403, 'This account is not in the staging beta.');
    return { email, isOwner: email === config.owner };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Sign in to the staging beta to continue.');
  }
}

function sameOriginMutation(request, url) {
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (request.headers.get('Origin') !== url.origin || (fetchSite && fetchSite !== 'same-origin')) {
    throw new ApiError(403, 'Submit feedback from the staging game.');
  }
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get('Content-Type') || '')) {
    throw new ApiError(415, 'Use application/json for beta feedback.');
  }
}

function textField(value, field, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /\u0000/.test(value)) {
    throw new ApiError(400, `Invalid ${field}.`);
  }
  return value.trim();
}

function progressField(value, field) {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647) throw new ApiError(400, `Invalid ${field}.`);
  return value;
}

function feedbackInput(body) {
  if (typeof body.id !== 'string' || !UUID.test(body.id)) throw new ApiError(400, 'Invalid report ID.');
  if (body.type !== 'bug' && body.type !== 'idea') throw new ApiError(400, 'Choose a bug or idea.');
  return {
    id: body.id.toLowerCase(), type: body.type,
    title: textField(body.title, 'title', 120, true),
    description: textField(body.description, 'description', 4000, true),
    build: textField(body.build, 'build', 80),
    level: progressField(body.level, 'level'), wave: progressField(body.wave, 'wave'),
    ship: textField(body.ship, 'ship', 40),
  };
}

const REPORT_COLUMNS = 'id, type, title, description, email, status, created_at AS createdAt, build, level, wave, ship, user_agent AS userAgent';

function notificationsConfigured(env) {
  // Release preparation derives both pins from the restricted email binding.
  // A changed owner/from flag alone cannot redirect notifications elsewhere.
  return env.BETA_ENABLED === 'true' && env.BETA_EMAIL_ENABLED === 'true'
    && typeof env.BETA_EMAIL_RECIPIENT === 'string' && /^[^\s@]+@gmail\.com$/.test(env.BETA_EMAIL_RECIPIENT)
    && typeof env.BETA_EMAIL_SENDER === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.BETA_EMAIL_SENDER)
    && env.BETA_OWNER === env.BETA_EMAIL_RECIPIENT && env.BETA_EMAIL_FROM === env.BETA_EMAIL_SENDER
    && !!env.BETA_DB && typeof env.BETA_EMAIL?.send === 'function';
}

function notificationError(error) {
  if (['E_SENDER_NOT_VERIFIED', 'E_SENDER_DOMAIN_NOT_AVAILABLE'].includes(error?.code)) return 'sender_not_ready';
  if (['E_RECIPIENT_NOT_ALLOWED', 'E_RECIPIENT_SUPPRESSED'].includes(error?.code)) return 'recipient_unavailable';
  if (['E_RATE_LIMIT_EXCEEDED', 'E_DAILY_LIMIT_EXCEEDED'].includes(error?.code)) return 'rate_limited';
  // Do not persist or expose provider messages, which may contain private data.
  return 'delivery_failed';
}

function reportNotification(report, env) {
  const fields = [
    ['Title', report.title], ['Tester', report.email], ['Type', report.type],
    ['Report ID', report.id], ['Submitted', report.createdAt], ['Build', report.build],
    ['Level', report.level], ['Wave', report.wave], ['Ship', report.ship], ['Browser', report.userAgent],
  ];
  return {
    to: env.BETA_EMAIL_RECIPIENT,
    from: env.BETA_EMAIL_SENDER,
    // User text stays in the plain-text body, never in email headers or HTML.
    subject: `EPOCH staging feedback: new ${report.type === 'idea' ? 'idea' : 'bug'}`,
    text: [
      'A tester submitted feedback for the private EPOCH staging beta.', '',
      ...fields.map(([label, value]) => `${label}: ${JSON.stringify(value ?? null)}`),
      '', 'Details:', report.description, '',
      `Open the game and select Beta feedback > Beta inbox: https://${STAGING_HOST}/`,
      '', 'This report is saved in the Beta inbox even if an email is delayed.',
    ].join('\n'),
    headers: { 'X-Epoch-Report-ID': report.id },
  };
}

async function drainNotifications(env) {
  if (!notificationsConfigured(env)) return;
  for (let index = 0; index < NOTIFICATION_BATCH_SIZE; index += 1) {
    const now = Date.now();
    const lease = crypto.randomUUID();
    // A single conditional UPDATE is the claim. Concurrent POSTs and cron runs
    // cannot send the same row while its lease is active.
    const claimed = await env.BETA_DB.prepare(`UPDATE beta_feedback_email_outbox
      SET lease_token = ?, leased_until = ?, attempts = attempts + 1
      WHERE report_id = (
        SELECT report_id FROM beta_feedback_email_outbox
        WHERE sent_at IS NULL AND next_attempt_at <= ? AND leased_until <= ?
        ORDER BY queued_at, report_id LIMIT 1
      ) AND sent_at IS NULL AND next_attempt_at <= ? AND leased_until <= ?
      RETURNING report_id, attempts`)
      .bind(lease, now + NOTIFICATION_LEASE_MS, now, now, now, now).first();
    if (!claimed) return;
    const report = await env.BETA_DB.prepare(`SELECT ${REPORT_COLUMNS} FROM beta_feedback WHERE id = ?`)
      .bind(claimed.report_id).first();
    if (!report) throw new Error('Notification report unavailable');
    let delivery;
    try {
      delivery = await env.BETA_EMAIL.send(reportNotification(report, env));
    } catch (error) {
      const delay = Math.min(6 * 60 * 60 * 1000, 60 * 1000 * 2 ** Math.min(claimed.attempts - 1, 9));
      const result = await env.BETA_DB.prepare(`UPDATE beta_feedback_email_outbox
        SET lease_token = NULL, leased_until = 0, next_attempt_at = ?, last_error = ?, last_error_at = ?
        WHERE report_id = ? AND lease_token = ? AND sent_at IS NULL`)
        .bind(Date.now() + delay, notificationError(error), new Date().toISOString(), claimed.report_id, lease).run();
      if (!result.success) throw new Error('Notification retry write failed');
      continue;
    }
    // Provider acceptance and this write cannot share a transaction. A crash in
    // between can cause a retry email; the report ID identifies the same report.
    const result = await env.BETA_DB.prepare(`UPDATE beta_feedback_email_outbox
      SET sent_at = ?, provider_message_id = ?, lease_token = NULL, leased_until = 0,
        last_error = NULL, last_error_at = NULL
      WHERE report_id = ? AND lease_token = ? AND sent_at IS NULL`)
      .bind(new Date().toISOString(), typeof delivery?.messageId === 'string' ? delivery.messageId.slice(0, 256) : null,
        claimed.report_id, lease).run();
    if (!result.success) throw new Error('Notification receipt write failed');
  }
}

async function processNotifications(env) {
  try {
    await drainNotifications(env);
  } catch {
    // The durable queue and expiring lease retain unfinished work for cron.
    console.error('EPOCH beta notification processing is temporarily unavailable.');
  }
}

function scheduleNotifications(env, context) {
  if (notificationsConfigured(env) && typeof context?.waitUntil === 'function') {
    context.waitUntil(processNotifications(env));
  }
}

async function notificationStatus(env) {
  const counts = await env.BETA_DB.prepare(`SELECT
    COUNT(CASE WHEN sent_at IS NULL THEN 1 END) AS pending,
    COUNT(CASE WHEN sent_at IS NOT NULL THEN 1 END) AS sent
    FROM beta_feedback_email_outbox`).first();
  const lastFailure = await env.BETA_DB.prepare(`SELECT last_error AS code, last_error_at AS at
    FROM beta_feedback_email_outbox WHERE sent_at IS NULL AND last_error IS NOT NULL
    ORDER BY last_error_at DESC, report_id DESC LIMIT 1`).first();
  if (!counts) throw new Error('Notification status unavailable');
  return { configured: notificationsConfigured(env), pending: counts.pending, sent: counts.sent, lastFailure };
}

async function feedbackReports(env, session) {
  const query = session.isOwner
    ? env.BETA_DB.prepare(`SELECT ${REPORT_COLUMNS} FROM beta_feedback ORDER BY created_at DESC, id DESC`)
    : env.BETA_DB.prepare(`SELECT ${REPORT_COLUMNS} FROM beta_feedback WHERE email = ? ORDER BY created_at DESC, id DESC`).bind(session.email);
  const result = await query.all();
  if (!result.success) throw new Error('Database read failed');
  return result.results;
}

function indentedText(value) {
  return String(value).split(/\r\n|[\r\n\u2028\u2029]/).map(line => `    ${line}`).join('\n');
}

function markdownInbox(reports, inline = false) {
  const lines = ['# EPOCH staging beta feedback', '', `Generated: ${new Date().toISOString()}`, '', `Reports: ${reports.length}`, ''];
  if (!reports.length) lines.push('No feedback has been submitted yet.', '');
  reports.forEach((report, index) => {
    const fields = [
      ['Title', report.title], ['ID', report.id], ['Status', report.status], ['Type', report.type],
      ['Email', report.email], ['Created', report.createdAt], ['Build', report.build],
      ['Level', report.level], ['Wave', report.wave], ['Ship', report.ship], ['Browser', report.userAgent],
    ];
    // Every user-controlled value stays in an indented code block. Quoted scalar
    // values preserve newlines as escapes so they cannot impersonate field labels.
    const metadata = fields.map(([label, value]) => `${label}: ${JSON.stringify(value ?? null)
      .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}`).join('\n');
    lines.push(`## Report ${index + 1}`, '', indentedText(metadata), '', '### Details', '', indentedText(report.description), '');
  });
  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': inline ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="epoch-beta-feedback.md"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Cf-Access-Jwt-Assertion',
    },
  });
}

async function api(request, env, url, context) {
  if (url.protocol !== 'https:' || url.hostname !== STAGING_HOST || env.BETA_ENABLED !== 'true') {
    throw new ApiError(404, 'Not found.');
  }
  const config = configuration(env);
  const session = await authenticate(request, config);
  if (request.method === 'GET' && url.pathname === '/api/beta/session') return json(session);
  if (url.pathname === '/api/beta/notifications') {
    if (!session.isOwner) throw new ApiError(403, 'Only the beta owner can read notification status.');
    if (request.method !== 'GET') throw new ApiError(405, 'Method not allowed.');
    return json(await notificationStatus(env));
  }
  if (url.pathname === '/api/beta/feedback.md') {
    if (!session.isOwner) throw new ApiError(403, 'Only the beta owner can read the complete feedback inbox.');
    if (request.method !== 'GET') throw new ApiError(405, 'Method not allowed.');
    return markdownInbox(await feedbackReports(env, session), url.searchParams.get('view') === '1');
  }
  if (url.pathname === '/api/beta/feedback') {
    if (request.method === 'GET') {
      return json({ reports: await feedbackReports(env, session), ...(session.isOwner ? { testers: config.testers } : {}) });
    }
    if (request.method === 'POST') {
      sameOriginMutation(request, url);
      const report = feedbackInput(await boundedJson(request, MAX_BODY_BYTES));
      const result = await env.BETA_DB.prepare(`INSERT INTO beta_feedback
        (id, type, title, description, email, status, created_at, build, level, wave, ship, user_agent)
        VALUES (?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
        .bind(report.id, report.type, report.title, report.description, session.email, new Date().toISOString(),
          report.build, report.level, report.wave, report.ship, (request.headers.get('User-Agent') || '').slice(0, 512)).run();
      if (!result.success) throw new Error('Database write failed');
      if (result.meta.changes > 0) {
        scheduleNotifications(env, context);
        return json({ id: report.id }, 201);
      }
      const existing = await env.BETA_DB.prepare('SELECT email FROM beta_feedback WHERE id = ?').bind(report.id).first();
      if (!existing) throw new Error('Database read failed');
      if (existing.email !== session.email) throw new ApiError(409, 'Report ID is already in use.');
      scheduleNotifications(env, context);
      return json({ id: report.id });
    }
    throw new ApiError(405, 'Method not allowed.');
  }
  const match = /^\/api\/beta\/feedback\/([^/]+)$/.exec(url.pathname);
  if (match && request.method === 'PATCH') {
    if (!session.isOwner) throw new ApiError(403, 'Only the beta owner can update report status.');
    sameOriginMutation(request, url);
    if (!UUID.test(match[1])) throw new ApiError(400, 'Invalid report ID.');
    const body = await boundedJson(request, MAX_BODY_BYTES);
    if (!['new', 'planned', 'fixed'].includes(body.status)) throw new ApiError(400, 'Invalid report status.');
    const id = match[1].toLowerCase();
    const result = await env.BETA_DB.prepare('UPDATE beta_feedback SET status = ? WHERE id = ?').bind(body.status, id).run();
    if (!result.success) throw new Error('Database write failed');
    if (result.meta.changes !== 1) throw new ApiError(404, 'Report not found.');
    return json({ id, status: body.status });
  }
  throw new ApiError(404, 'Not found.');
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/beta' && !url.pathname.startsWith('/api/beta/')) return env.ASSETS.fetch(request);
    try {
      return await api(request, env, url, context);
    } catch (error) {
      return json({ error: error instanceof ApiError ? error.message : 'Beta feedback is temporarily unavailable.' }, error instanceof ApiError ? error.status : 503);
    }
  },
  async scheduled(_event, env, context) {
    const work = processNotifications(env);
    if (typeof context?.waitUntil === 'function') context.waitUntil(work);
    await work;
  },
};
