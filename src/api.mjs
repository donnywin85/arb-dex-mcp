// HTTP layer for arb-dex-mcp.
//
// TWO HOSTS, deliberately. The upstream service serves a small free surface
// keyless on its own public origin, and everything else ONLY through the
// RapidAPI proxy (the origin 403s a direct call to a paid route). So:
//
//   FREE_BASE  — the public origin. Free routes only. No key, ever.
//   PAID_HOST  — the RapidAPI proxy. Needs the INSTALLING USER'S key, read
//                from RAPIDAPI_KEY in this process's env.
//
// This package ships NO key and embeds no credential. If RAPIDAPI_KEY is
// unset, paid tools return an explicit "key required" error with the signup
// link — never a fabricated or silently-degraded row.

export const FREE_BASE = process.env.ARB_DEX_FREE_BASE_URL
  || 'https://arb-dex-data-production.up.railway.app';

export const PAID_HOST = process.env.ARB_DEX_RAPIDAPI_HOST
  || 'multi-chain-dex-prices-liquidity.p.rapidapi.com';

export const LISTING_URL = 'https://rapidapi.com/donnydev/api/multi-chain-dex-prices-liquidity';

const TIMEOUT_MS = Number(process.env.ARB_DEX_TIMEOUT_MS || 45000);

export const hasKey = () => Boolean((process.env.RAPIDAPI_KEY || '').trim());

class ApiError extends Error {}

function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && String(v) !== '') u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

// The origin's error bodies are structured and the ACTIONABLE fields sit late in
// them — a tier_required payload leads with a long `tiers` blurb and ends with
// `upgradeUrl`. Blind-truncating the raw JSON to a fixed budget therefore cut off
// exactly the part an agent needs, and left it holding un-parseable half-JSON.
// Lift the fields that tell a caller what happened and what to do, in that order,
// and only fall back to truncation for genuinely unstructured bodies.
const ERROR_FIELDS = ['error', 'detail', 'route', 'yourTier', 'requiredTier', 'unlocks', 'upgradeUrl', 'message'];

function errorDetail(body) {
  if (typeof body === 'string') return body.slice(0, 400);
  if (!body || typeof body !== 'object') return String(body).slice(0, 400);

  const named = ERROR_FIELDS
    .filter((k) => body[k] !== undefined && body[k] !== null && body[k] !== '')
    .map((k) => `${k}: ${String(body[k])}`);

  // Nothing recognisable — fall back to the old behaviour rather than swallowing it.
  if (!named.length) return JSON.stringify(body).slice(0, 400);
  return named.join(' | ').slice(0, 700);
}

async function request(url, headers) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { headers, signal: ctl.signal });
  } catch (err) {
    throw new ApiError(
      err?.name === 'AbortError'
        ? `upstream did not answer within ${TIMEOUT_MS}ms (a full-chain scan is a live on-chain sweep and can be slow; raise ARB_DEX_TIMEOUT_MS)`
        : `network error reaching the arb-dex-data API: ${err?.message || String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }

  if (!res.ok) {
    throw new ApiError(`upstream HTTP ${res.status}: ${errorDetail(body)}`);
  }
  return body;
}

/** Free public surface — keyless, served by the origin itself. */
export function getFree(path, params) {
  return request(`${FREE_BASE}${path}${qs(params)}`, { accept: 'application/json' });
}

/** Paid surface — through RapidAPI, using the installing user's own key. */
export function getPaid(path, params) {
  const key = (process.env.RAPIDAPI_KEY || '').trim();
  if (!key) {
    throw new ApiError(
      `this endpoint is paid and needs a RapidAPI key. Set RAPIDAPI_KEY in this MCP server's env. `
      + `Subscribe (free tier available) at ${LISTING_URL}`,
    );
  }
  return request(`https://${PAID_HOST}${path}${qs(params)}`, {
    accept: 'application/json',
    'x-rapidapi-key': key,
    'x-rapidapi-host': PAID_HOST,
  });
}

export { ApiError };
