// Drives the npm registry web-auth flow directly.
//
// Two facts learned the hard way:
//  1. `npm login --auth-type=web` gives up after ~5 min and falls back to the
//     legacy Username: prompt, which EOFs on piped stdin. Hence driving it here.
//  2. A web-auth session 404s its doneUrl exactly ~5 min after creation. The
//     login URL is therefore only clickable for ~5 min, so a URL parked in a
//     relay file goes stale before a human reads it.
//
// So: mint a fresh session every ROTATE_MS, keep polling the last few sessions
// until each 404s (an approval must never land on a session nobody watches),
// and keep the relay file pointing at a URL that is always < ROTATE_MS old.
// Prints URLs and progress only. NEVER prints the token.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const REGISTRY = 'https://registry.npmjs.org';
const MAX_MS = Number(process.argv[2] || 22) * 60 * 1000;
const RELAY = process.argv[3] || path.join(process.cwd(), 'state', 'npm-login-url.json');
const ROTATE_MS = 4 * 60 * 1000;
const RING = 3;
const UA = 'npm/11.16.0 node/v24.18.0 win32 x64';
const HEADERS = {
  'content-type': 'application/json',
  'npm-auth-type': 'web', // mandatory — without it the init call 401s
  'npm-command': 'login',
  'user-agent': UA,
  accept: '*/*',
};

const log = (m) => { process.stdout.write(`[${new Date().toISOString()}] ${m}\n`); };
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

let attempt = Number(process.env.NPM_LOGIN_ATTEMPT || 3);
const sessions = [];

async function mint() {
  const res = await fetch(`${REGISTRY}/-/v1/login`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ hostname: os.hostname() }),
  });
  if (!res.ok) { log(`WARN: mint failed ${res.status}`); return null; }
  const { loginUrl, doneUrl } = await res.json();
  if (!loginUrl || !doneUrl) { log('WARN: mint returned no urls'); return null; }
  const s = { loginUrl, doneUrl, born: Date.now() };
  sessions.push(s);
  while (sessions.length > RING) sessions.shift();
  attempt += 1;
  const expires = new Date(s.born + 5 * 60 * 1000).toISOString();
  fs.writeFileSync(RELAY, JSON.stringify({
    loginUrl,
    startedAtIso: new Date(s.born).toISOString(),
    expiresAtIso: expires,
    attempt,
    note: 'npm web-auth sessions expire ~5 min after creation; this file is refreshed every 4 min while the login job runs',
  }, null, 2) + '\n');
  log(`LOGIN_URL ${loginUrl}  (valid until ${expires})`);
  return s;
}

const started = Date.now();
let lastMint = 0;
let lastBeat = 0;
let token = null;

await mint();
lastMint = Date.now();

while (Date.now() - started < MAX_MS && !token) {
  for (const s of [...sessions]) {
    let r;
    try {
      r = await fetch(s.doneUrl, { headers: HEADERS });
    } catch (e) {
      log(`poll transient error: ${e.message}`);
      continue;
    }
    if (r.status === 200) {
      const body = await r.json().catch(() => null);
      if (body && body.token) { token = body.token; break; }
    } else if (r.status === 404 || r.status === 410) {
      const i = sessions.indexOf(s);
      if (i >= 0) sessions.splice(i, 1);
    } else if (r.status !== 202) {
      log(`poll unexpected status ${r.status}`);
    }
  }
  if (token) break;

  const now = Date.now();
  if (now - lastMint >= ROTATE_MS || sessions.length === 0) {
    await mint();
    lastMint = Date.now();
  }
  const elapsed = now - started;
  if (elapsed - lastBeat >= 60000) {
    lastBeat = elapsed;
    const cur = sessions[sessions.length - 1];
    const age = cur ? Math.round((now - cur.born) / 1000) : -1;
    log(`WAITING — ${Math.round(elapsed / 60000)} min elapsed, ${Math.round((MAX_MS - elapsed) / 60000)} min left, ${sessions.length} live session(s), current URL age ${age}s`);
  }
  await sleep(5000);
}

if (!token) { log('TIMEOUT: no approval within window'); process.exit(3); }

const npmrc = path.join(os.homedir(), '.npmrc');
let existing = '';
try { existing = fs.readFileSync(npmrc, 'utf8'); } catch { /* first login */ }
const kept = existing
  .split(/\r?\n/)
  .filter((l) => !/^\/\/registry\.npmjs\.org\/:_authToken=/.test(l.trim()))
  .join('\n')
  .replace(/\n+$/, '');
fs.writeFileSync(npmrc, (kept ? kept + '\n' : '') + `//registry.npmjs.org/:_authToken=${token}\n`, { mode: 0o600 });
log('TOKEN_STORED in ~/.npmrc');
log('SUCCESS');
