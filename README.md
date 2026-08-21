# arb-dex-mcp

**Live cross-DEX crypto prices for your AI agent** — per-venue pool price, pool liquidity
and the gross cross-venue spread on 6 EVM chains, read straight from on-chain pool state.

[![npm](https://img.shields.io/npm/v/arb-dex-mcp)](https://www.npmjs.com/package/arb-dex-mcp)
[![npm downloads](https://img.shields.io/npm/dw/arb-dex-mcp)](https://www.npmjs.com/package/arb-dex-mcp)
[![provenance](https://img.shields.io/badge/npm-provenance-brightgreen)](https://www.npmjs.com/package/arb-dex-mcp#provenance)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-io.github.donnywin85%2Farb--dex--mcp-blue)](https://registry.modelcontextprotocol.io/v0/servers?search=arb-dex)
[![Indexed on TensorBlock MCP Index](https://mcp-index.tensorblock.co/v1/servers/github-donnywin85-arb-dex-mcp-7dd9a70c/badge.svg)](https://www.tensorblock.co/mcp/servers/github-donnywin85-arb-dex-mcp-7dd9a70c)
[![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/donnywin85/arb-dex-mcp)
[![license](https://img.shields.io/npm/l/arb-dex-mcp)](LICENSE)

Chains: **BSC · Polygon · Arbitrum · Base · Avalanche · Optimism**.
Venues: PancakeSwap (v2 + v3), Uniswap v3, SushiSwap, QuickSwap, Biswap, ApeSwap, BaseSwap,
Trader Joe, Pangolin — every v2-style pool **and every v3 fee tier separately**, because a
$12k 1% pool and a $19M 0.01% pool are not the same quote.

Nothing is modelled, estimated or backfilled. Every payload states its own block number and
carries its own scope note, so an agent that quotes a figure also has the caveats attached to it.

**Works with no API key** against a free hourly public snapshot. [Docs](https://donnywin85.github.io/arb-dex-mcp/) · [npm](https://www.npmjs.com/package/arb-dex-mcp)

---

## Quickstart

Nothing to clone or build. Your MCP client fetches the package. Requires Node 18+.

### Claude Desktop

`claude_desktop_config.json` — macOS `~/Library/Application Support/Claude/`,
Windows `%APPDATA%\Claude\`:

```json
{
  "mcpServers": {
    "arb-dex": {
      "command": "npx",
      "args": ["-y", "arb-dex-mcp"],
      "env": {
        "RAPIDAPI_KEY": "your-rapidapi-key-here"
      }
    }
  }
}
```

Restart Claude Desktop; the six tools appear under the connectors icon.
**Drop the `env` block entirely to run keyless** — the server still starts and the
free-snapshot tools still answer.

### Claude Code

```bash
claude mcp add arb-dex --env RAPIDAPI_KEY=your-rapidapi-key-here -- npx -y arb-dex-mcp
```

Keyless:

```bash
claude mcp add arb-dex -- npx -y arb-dex-mcp
```

Then `/mcp` to confirm it connected.

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project):

```json
{
  "mcpServers": {
    "arb-dex": {
      "command": "npx",
      "args": ["-y", "arb-dex-mcp"],
      "env": {
        "RAPIDAPI_KEY": "your-rapidapi-key-here"
      }
    }
  }
}
```

Cursor → Settings → MCP shows the server and its tools once the file is saved.

### Any other MCP client

Same three facts: command `npx`, args `["-y", "arb-dex-mcp"]`, transport **stdio**,
optional env `RAPIDAPI_KEY`.

---

## Try it

Real prompts, and the real shape that comes back. Payloads below were measured live on
**2026-08-15**; they are trimmed for width but nothing is invented.

### 1. "What is WBNB/USDT trading at on every BSC venue right now?"

`get_prices` reads every pool holding the pair — v2 pairs and each v3 fee tier separately —
at one stated block:

```json
{
  "pair": "WBNB/USDT",
  "network": "bsc",
  "chainId": 56,
  "blockNumber": 116151268,
  "pricesByVenue": [
    { "venue": "pancake",        "surface": "v2", "feeBps": 25,  "price": 611.7347, "tvlUsd": 56834814.36 },
    { "venue": "biswap",         "surface": "v2", "feeBps": 10,  "price": 610.8278, "tvlUsd": 415733.94 },
    { "venue": "apeswap",        "surface": "v2", "feeBps": 20,  "price": 611.1244, "tvlUsd": 3659.06 },
    { "venue": "pancakeV3:1",    "surface": "v3", "feeBps": 1,   "price": 610.5684, "tvlUsd": 18596810.32 },
    { "venue": "pancakeV3:5",    "surface": "v3", "feeBps": 5,   "price": 610.6531, "tvlUsd": 4941099.44 },
    { "venue": "pancakeV3:25",   "surface": "v3", "feeBps": 25,  "price": 610.6304, "tvlUsd": 52534.35 },
    { "venue": "pancakeV3:100",  "surface": "v3", "feeBps": 100, "price": 609.1025, "tvlUsd": 12206.21 }
  ],
  "bestBuy":  { "venue": "pancakeV3:100", "price": 609.1025 },
  "bestSell": { "venue": "pancake",       "price": 611.7347 },
  "midSpreadBps": 43.22,
  "crossDex": {
    "grossSpreadBps": 0,
    "grossUsd": 0,
    "optimalInput": { "amount": 0, "token": "WBNB", "usd": 0 },
    "buyVenue": "-",
    "sellVenue": "-"
  },
  "liquidity": { "venues": 7, "totalTvlUsd": 80856857.67 },
  "source": "rpc"
}
```

**Read the two spread numbers against each other.** The raw mid spread is **43 bps** — and the
gross capturable spread is **0**. The 609.10 quote lives in a $12k pool; the size that would
actually clear it moves the price past the gap before you get there. A tool that reported only
the 43 bps would be handing an agent a number it cannot trade. This one reports both, and
`optimalInput` is where the honesty lands.

### 2. "Show me the cross-DEX spreads on Base — are any actually capturable?"

`get_spreads` sweeps a whole chain and ranks by **gross USD at the optimal size**, not by
headline basis points:

```json
{
  "network": "base",
  "chainId": 8453,
  "scannedPairs": 11,
  "opportunities": [],
  "found": 0,
  "filters": { "minSpreadBps": 10, "minVenueTvlUsd": 1000, "minGrossUsd": 0.01, "limit": 5 },
  "ranking": "gross USD at the optimal trade size, NOT raw spread — a large spread with a tiny optimal size is not an opportunity",
  "scope": "GROSS cross-venue spread from live pool state, BEFORE gas, MEV and any slippage beyond the optimal size. Not a profit estimate and not trade advice. Venues below the liquidity floor are excluded because a spread against a dust pool is an artefact, not an opportunity.",
  "elapsedMs": 2847
}
```

**`found: 0` is a real answer and it is the common one.** Eleven pairs scanned, nothing cleared
the floor. Venues under $1,000 TVL are dropped outright. When rows *do* come back, each carries
`capturable`, `warning` and `shallowestSideTvlUsd` so a big basis-point number cannot mislead on
its own. This tool will tell your agent there is nothing there — which is the whole point of
asking it.

### 3. "How much history does arb-dex actually have, and for which chains?"

`get_history_summary` sizes the archive *before* you query it:

```json
{
  "rows": 133,
  "rowsWithPairDetail": 103,
  "rowsByEra": { "digest-totals-only": 30, "top-list-pairs": 5, "full-sweep": 98 },
  "pairsTracked": 107,
  "firstAt": "2026-08-10T17:35:09.355Z",
  "lastAt":  "2026-08-15T20:54:34.417Z",
  "spanHours": 123.32,
  "chainsSeen": ["arbitrum", "avalanche", "base", "bsc", "optimism", "polygon"],
  "pairs": [
    { "chain": "polygon",  "pair": "WBTC/USDC", "observations": 103, "qualifiedObservations": 39 },
    { "chain": "bsc",      "pair": "BTCB/USDT", "observations": 99,  "qualifiedObservations": 15 },
    { "chain": "arbitrum", "pair": "ARB/USDC",  "observations": 98,  "qualifiedObservations": 0 }
  ]
}
```

Coverage is only what was measured. A gap stays a gap — `rowsByEra` says how much detail each
era of rows carries, and `ARB/USDC` having 98 observations but **0 qualified** is the archive
telling you that pair has never once cleared the spread floor.

---

## Tools

| Tool | What it answers | Access |
|---|---|---|
| `get_chains` | Which chains are covered, their chain IDs, tokens and DEX venues | Any key · keyless returns the chain list only, and says so |
| `get_pairs` | What is priceable on one chain: token universe, venues, pair syntax | Any key · keyless returns the measured subset, labelled as such |
| `get_prices` | One pair's price at **every** venue holding a pool for it, plus reserves, TVL, fee tier and the cross-DEX spread | Any key |
| `get_spreads` | A whole chain's cross-venue dislocations, ranked by gross USD at the optimal size | Any key for `live: true` · keyless serves the free hourly snapshot |
| `get_history_summary` | What the measurement archive covers: rows, pairs tracked, chains seen, span, retention | Any key (free tier included) |
| `get_history` | One pair's per-venue price/liquidity series and gross cross-venue spread over 24h / 7d / 30d | **PRO plan** — see [Plans](#plans) |

The two history tools read the service's own measurement archive, so they answer the question
the live tools cannot: whether a dislocation *persisted* or was a single sample. Sampling is
roughly hourly, and gaps are never interpolated or backfilled. Call `get_history_summary` first
to see what span exists before asking for a window.

## What it will not do

- **Spreads are gross** — before gas, MEV and slippage beyond the optimal size. Not a profit
  estimate and not trade advice.
- **It never fabricates a row.** Without a key, `get_chains`, `get_pairs` and `get_spreads`
  answer from the free public surface and each carries a `limitation` field naming exactly what
  a key would add. `get_prices`, `get_history_summary` and `get_history` return an explicit
  key-required error with the signup link rather than a thinner answer dressed up as a full one.
- **It does not execute trades**, hold funds, or touch a wallet. It is read-only market data.
- **This package ships no credentials of any kind.** The key is yours and stays in your config.

## Get a key

The paid tools call the API through RapidAPI using **your own** key.

1. Subscribe — there is a free tier: <https://rapidapi.com/donnydev/api/multi-chain-dex-prices-liquidity>
2. Copy your `X-RapidAPI-Key` from the RapidAPI dashboard.
3. Put it in `RAPIDAPI_KEY` in the config above — never in code, and never in a commit.

### Plans

Five of the six tools work on the **free** tier. Only the per-pair history series is gated:

| Plan | Adds |
|---|---|
| **BASIC** ($0) | Live quotes on every chain, plus `get_history_summary` so you can size the archive before you buy it |
| **PRO** ($15/mo) | `get_history` — the measured per-venue series for one pair, 24h window, 1000 calls/mo |
| **ULTRA** ($49/mo) | No window limit and no history meter, plus depth/slippage and spread alerts |
| **MEGA** ($149/mo) | Bulk paging over the complete archive for your own store |

Calling `get_history` below PRO returns an explicit `tier_required` error naming the plan and
the upgrade URL — it does not fail silently or return an empty series.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `RAPIDAPI_KEY` | — | Your RapidAPI key. Required for the paid tools. |
| `ARB_DEX_TIMEOUT_MS` | `45000` | Request timeout. A live full-chain sweep is a real on-chain read and can take ~30s. |
| `ARB_DEX_FREE_BASE_URL` | production origin | Override the free-surface host. |
| `ARB_DEX_RAPIDAPI_HOST` | `multi-chain-dex-prices-liquidity.p.rapidapi.com` | Override the RapidAPI host. |

Set these in your MCP client's `env` block (see the configs above). `.env.example` ships in the
package and documents the same variables for local runs from a clone.

## Test

The test suite is not in the npm tarball — run it from a clone:

```bash
git clone https://github.com/donnywin85/arb-dex-mcp.git
cd arb-dex-mcp && npm install

npm run selftest                    # keyless: exercises the free fallbacks
RAPIDAPI_KEY=... npm run selftest   # keyed: exercises the paid routes
```

The test spawns the server over stdio and calls every tool against the **real production API** —
nothing is mocked. It asserts on live values (block number, per-venue prices, scanned-pair
counts), so a run that passes is evidence the data path works end to end.

## Links

- npm: <https://www.npmjs.com/package/arb-dex-mcp>
- Docs: <https://donnywin85.github.io/arb-dex-mcp/>
- Official MCP Registry: `io.github.donnywin85/arb-dex-mcp`
- TensorBlock MCP Index: <https://www.tensorblock.co/mcp/servers/github-donnywin85-arb-dex-mcp-7dd9a70c>
- Source: <https://github.com/donnywin85/arb-dex-mcp>
- The API behind it: <https://rapidapi.com/donnydev/api/multi-chain-dex-prices-liquidity>

## License

MIT — see [LICENSE](LICENSE).
