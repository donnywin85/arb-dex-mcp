// Live end-to-end test: spawns the MCP server over stdio, lists its tools, and
// calls EVERY tool against the real production API. It asserts on the shape of
// real data — a tool that answers with an error, or with a payload that does
// not carry the fields it advertises, fails the run. Nothing is mocked.
//
// Run with RAPIDAPI_KEY set to exercise the paid paths; run without it to
// exercise the keyless fallbacks. Both are expected to pass — differently.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, '..', 'src', 'index.mjs');
const KEYED = Boolean((process.env.RAPIDAPI_KEY || '').trim());

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [entry],
  env: { ...process.env },
});
const client = new Client({ name: 'arb-dex-mcp-test', version: '0.1.0' });
await client.connect(transport);

console.log(`\narb-dex-mcp live test — mode: ${KEYED ? 'KEYED (paid routes)' : 'KEYLESS (free fallbacks)'}\n`);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
console.log(`tools advertised: ${names.join(', ')}\n`);
check('all four tools listed', names.length === 4);
for (const t of tools) {
  check(`${t.name} has a substantive description`, (t.description || '').length > 120,
    `${(t.description || '').length} chars`);
}

async function call(name, args) {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content?.map((c) => c.text).join('\n') ?? '';
  if (r.isError) return { error: text };
  try { return { data: JSON.parse(text), text }; } catch { return { error: `non-JSON payload: ${text.slice(0, 200)}` }; }
}

// --- get_chains -----------------------------------------------------------
{
  const { data, error } = await call('get_chains', {});
  check('get_chains returns data', !error, error);
  if (data) {
    check('get_chains lists 6 chains', Array.isArray(data.chains) && data.chains.length === 6,
      `got ${data.chains?.length}`);
    check('get_chains includes bsc', (data.chains || []).some((c) => c.chain === 'bsc'));
    if (KEYED) {
      const bsc = data.chains.find((c) => c.chain === 'bsc');
      check('keyed get_chains carries chainId 56 for bsc', bsc?.chainId === 56, String(bsc?.chainId));
      check('keyed get_chains carries token list', Array.isArray(bsc?.tokens) && bsc.tokens.length > 3);
      check('keyed get_chains carries venue list', Array.isArray(bsc?.venues) && bsc.venues.includes('pancake'));
    } else {
      check('keyless get_chains declares its limitation', typeof data.limitation === 'string');
    }
  }
}

// --- get_pairs ------------------------------------------------------------
{
  const { data, error } = await call('get_pairs', { chain: 'bsc' });
  check('get_pairs(bsc) returns data', !error, error);
  if (data) {
    if (KEYED) {
      check('keyed get_pairs carries tokens', Array.isArray(data.tokens) && data.tokens.includes('WBNB'));
      check('keyed get_pairs states pair syntax', /TOKEN_A\/TOKEN_B/.test(data.pairSyntax || ''));
    } else {
      check('keyless get_pairs reports a real scan count', Number.isFinite(data.pairsScannedInLatestSweep));
      check('keyless get_pairs labels measuredPairs as a subset', /subset/.test(data.limitation || ''));
    }
  }
  const bad = await call('get_pairs', { chain: 'dogechain' });
  check('get_pairs rejects an unknown chain', Boolean(bad.error), 'expected a rejection');
}

// --- get_prices -----------------------------------------------------------
{
  const { data, error } = await call('get_prices', { chain: 'bsc', pair: 'WBNB/USDT' });
  if (KEYED) {
    check('get_prices(bsc, WBNB/USDT) returns data', !error, error);
    if (data) {
      check('get_prices reports the pair it was asked for', data.pair === 'WBNB/USDT', data.pair);
      check('get_prices carries a real block number', Number.isInteger(data.blockNumber) && data.blockNumber > 40_000_000,
        String(data.blockNumber));
      check('get_prices returns per-venue prices', Array.isArray(data.pricesByVenue) && data.pricesByVenue.length > 0,
        `${data.pricesByVenue?.length} venues`);
      const priced = (data.pricesByVenue || []).every((v) => Number.isFinite(v.price) && v.price > 0);
      check('every venue row carries a positive price', priced);
      check('get_prices carries liquidity totals', Number.isFinite(data.liquidity?.totalTvlUsd));
      const p = data.pricesByVenue?.[0]?.price;
      console.log(`        (live: WBNB/USDT = ${p} USDT at ${data.pricesByVenue?.[0]?.venue}, block ${data.blockNumber})`);
    }
  } else {
    check('keyless get_prices refuses with a key-required message', Boolean(error) && /RAPIDAPI_KEY/.test(error), error);
  }
}

// --- get_spreads ----------------------------------------------------------
{
  const { data, error } = await call('get_spreads', { chain: 'polygon' });
  check('get_spreads(polygon) snapshot returns data', !error, error);
  if (data) {
    check('get_spreads reports the chain asked for', data.chain === 'polygon', data.chain);
    check('get_spreads carries a scanned-pair count', Number.isFinite(data.scannedPairs), String(data.scannedPairs));
    check('get_spreads carries the gross-basis scope', /GROSS/.test(data.scope || ''));
    check('get_spreads timestamps its snapshot', typeof data.generatedAt === 'string');
    console.log(`        (snapshot ${data.generatedAt}: ${data.scannedPairs} pairs scanned, ${data.found} over filter)`);
  }
  if (KEYED) {
    const live = await call('get_spreads', { chain: 'bsc', live: true, limit: 3 });
    check('get_spreads live sweep returns data', !live.error, live.error);
    if (live.data) {
      check('live sweep is a fresh on-chain read', Number.isFinite(live.data.scannedPairs) && live.data.scannedPairs > 0,
        String(live.data.scannedPairs));
      check('live sweep ranks by gross USD, and says so', /gross USD/i.test(live.data.ranking || ''));
      console.log(`        (live bsc sweep: ${live.data.scannedPairs} pairs, ${live.data.found} opportunities, ${live.data.elapsedMs}ms)`);
    }
  }
}

await client.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
