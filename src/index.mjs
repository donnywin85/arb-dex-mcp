#!/usr/bin/env node
// arb-dex-mcp — MCP server over the arb-dex-data API.
//
// Live, on-chain cross-DEX market data for 6 EVM chains: per-venue pool prices,
// pool liquidity, and the GROSS cross-venue spread computed from those same
// measured venues. Every number is a live read of pool state — nothing here is
// modelled, estimated or backfilled, and the payloads carry that scope with
// them so an agent quoting a figure also has its caveats.
//
// Keys: this package bundles NONE. Paid routes use RAPIDAPI_KEY from this
// process's env — the installing user's own key. Free routes need no key at
// all and are used automatically as a fallback where a free equivalent exists.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getFree, getPaid, hasKey, LISTING_URL } from './api.mjs';

const server = new McpServer({ name: 'arb-dex', version: '0.1.0' });

const PAID = `Paid route: needs your own RapidAPI key in RAPIDAPI_KEY (free tier available at ${LISTING_URL}).`;

const CHAINS = ['bsc', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism'];

const chainArg = z.enum(CHAINS).describe(
  'Chain key. One of: ' + CHAINS.join(', ') + '. Numeric chain IDs are not accepted here — use the key.',
);

const ok = (payload) => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] });
const fail = (msg) => ({ isError: true, content: [{ type: 'text', text: msg }] });

/** Run a handler, turning any upstream/network failure into an honest tool error. */
async function guard(fn) {
  try { return await fn(); }
  catch (err) { return fail(err?.message || String(err)); }
}

/** Pull one chain's slice out of the free digest snapshot. */
function digestChain(digest, chain) {
  return (digest.chains || []).find((c) => c.chain === chain) || null;
}

// ---------------------------------------------------------------- get_chains

server.registerTool('get_chains', {
  title: 'List supported chains, their tokens and DEX venues',
  description:
    'List every blockchain this API covers, with its chain ID, native asset, default trading pair, the token tickers it prices, and the DEX venues it reads (both Uniswap-v2-style pools and Uniswap-v3-style concentrated-liquidity pools). Call this first to discover valid `chain` values for the other tools. '
    + 'With a RapidAPI key you get the full per-chain token and venue lists; without one it falls back to the free public snapshot, which names the chains but not their token universes, and says so in the response. '
    + PAID,
  inputSchema: {},
}, () => guard(async () => {
  if (hasKey()) return ok(await getPaid('/chains'));
  const health = await getFree('/health');
  return ok({
    chains: (health.chains || []).map((chain) => ({ chain })),
    defaultChain: health.defaultChain,
    source: 'free public snapshot',
    limitation: 'Per-chain token tickers, chain IDs and DEX venue lists come from the paid /chains route. Set RAPIDAPI_KEY to get them.',
    subscribe: LISTING_URL,
  });
}));

// ----------------------------------------------------------------- get_pairs

server.registerTool('get_pairs', {
  title: 'What can be priced on one chain',
  description:
    'Show what is queryable on a single chain: the token tickers the API prices, the DEX venues it reads, and the chain default pair. A `pair` for get_prices is written as TOKEN_A/TOKEN_B from these tickers (first symbol is the base, second is the quote) — any ERC-20 contract address on the chain also works in place of a ticker. '
    + 'This returns the token universe, not a fixed enumerated pair list: the API prices whatever pair of these you ask for that has live pool liquidity, and returns 404 when no pool exists. '
    + 'Without a RapidAPI key it falls back to the free snapshot and returns only the pairs actually measured in the latest scan of that chain, labelled as such. '
    + PAID,
  inputSchema: { chain: chainArg },
}, ({ chain }) => guard(async () => {
  if (hasKey()) {
    const all = await getPaid('/chains');
    const row = (all.chains || []).find((c) => c.chain === chain);
    if (!row) return fail(`chain "${chain}" is not in the API's chain list — call get_chains for valid values`);
    return ok({
      ...row,
      pairSyntax: 'TOKEN_A/TOKEN_B — e.g. ' + row.defaultPair + '. Base first, quote second. A raw 0x… ERC-20 address may replace either ticker.',
      note: 'Pairs are formed on demand from these tokens; the API returns 404 when the requested pair has no live pool on this chain. This is a token universe, not a pre-enumerated pair list.',
    });
  }
  const digest = await getFree('/digest.json');
  const row = digestChain(digest, chain);
  if (!row) return fail(`chain "${chain}" is not present in the free snapshot — call get_chains for valid values`);
  return ok({
    chain,
    chainId: row.chainId,
    name: row.name,
    pairsScannedInLatestSweep: row.scannedPairs,
    measuredPairs: (row.top || []).map((t) => t.pair),
    source: 'free public snapshot',
    generatedAt: digest.generatedAt,
    limitation: 'measuredPairs lists ONLY the pairs that cleared the snapshot spread/liquidity filters — it is a subset of what is queryable, not the token universe. Set RAPIDAPI_KEY to get the full token and venue list.',
    subscribe: LISTING_URL,
  });
}));

// ---------------------------------------------------------------- get_prices

server.registerTool('get_prices', {
  title: 'Per-venue live pool prices for one pair',
  description:
    'Live price of one trading pair at EVERY DEX venue on a chain that holds a pool for it, read directly from pool state at a stated block number. Returns per-venue price (quote token per 1 base token), pool reserves, pool TVL in USD and the venue fee tier; plus the best bid/ask venues, the raw mid spread in basis points, aggregate liquidity, and the cross-DEX gross spread with its optimal trade size. '
    + 'Use this when you need the actual number a swap would price against on a specific venue, or to compare one pair across venues. For ranking opportunities across a whole chain, use get_spreads instead. '
    + 'Spreads are GROSS — before gas, MEV and slippage beyond the optimal size — and are not a profit estimate or trade advice. '
    + PAID,
  inputSchema: {
    chain: chainArg,
    pair: z.string().describe('Pair as BASE/QUOTE, e.g. "WBNB/USDT". The first symbol is the base (the USD-priceable side). A raw 0x… ERC-20 address may replace either ticker. Call get_pairs for the tickers a chain knows.'),
    fee: z.number().int().optional().describe('Optional Uniswap-v3 fee tier in hundredths of a bip (100, 500, 2500, 3000, 10000). Restricts the v3 probe to that single tier instead of sweeping all of them. Omit to sweep every tier.'),
  },
}, ({ chain, pair, fee }) => guard(async () => ok(await getPaid('/dex', { chain, pair, fee }))));

// --------------------------------------------------------------- get_spreads

server.registerTool('get_spreads', {
  title: 'Rank cross-DEX spread opportunities on a chain',
  description:
    'Sweep a whole chain and rank its cross-venue price dislocations, each with the buy venue, sell venue, spread in basis points, the optimal trade size, and the gross USD that size would capture. '
    + 'Ranking is by GROSS USD AT THE OPTIMAL SIZE, not by headline basis points — a 160bps spread against a $1,470 pool is worth about a cent, and the payload says so per row (`capturable`, `warning`, `shallowestSideTvlUsd`). Venues below the liquidity floor are excluded because a spread against a dust pool is an artefact, not an opportunity. '
    + 'Numbers are GROSS: before gas, MEV and any slippage beyond the optimal size. Not a profit estimate and not trade advice. '
    + 'With a RapidAPI key and live=true this runs a fresh on-chain sweep (slow, ~30s, most current). Otherwise it serves the free hourly public snapshot, which is keyless and fast — the response always states which, and when it was generated. '
    + PAID,
  inputSchema: {
    chain: chainArg,
    live: z.boolean().optional().describe('true = run a fresh on-chain sweep now (requires RAPIDAPI_KEY, takes ~30s). false/omitted = the free public snapshot, rebuilt hourly.'),
    minSpreadBps: z.number().optional().describe('Live sweeps only. Minimum spread in basis points to report. Default 10.'),
    limit: z.number().int().min(1).max(40).optional().describe('Live sweeps only. Maximum rows, 1..40. Default 15.'),
  },
}, ({ chain, live, minSpreadBps, limit }) => guard(async () => {
  if (live) return ok(await getPaid('/scan', { chain, minSpreadBps, limit }));
  const digest = await getFree('/digest.json');
  const row = digestChain(digest, chain);
  if (!row) return fail(`chain "${chain}" is not present in the snapshot — call get_chains for valid values`);
  return ok({
    ...row,
    filters: digest.filters,
    scope: digest.scope,
    generatedAt: digest.generatedAt,
    source: 'free public snapshot (hourly). Pass live=true with a RAPIDAPI_KEY for a fresh sweep and tunable filters.',
    ...(digest.failedChains?.length ? { failedChains: digest.failedChains } : {}),
  });
}));

// NOTE — the paid history archive (/v1/history/*) is live on the origin but is
// NOT yet registered on the RapidAPI listing, so calls through the proxy 404
// (verified 2026-08-11). A get_history tool is therefore deliberately absent
// rather than shipped broken; add it once the listing exposes those routes.

const transport = new StdioServerTransport();
await server.connect(transport);
