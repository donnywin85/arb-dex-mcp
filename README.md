# arb-dex-mcp

An [MCP](https://modelcontextprotocol.io) server that gives an AI agent **live cross-DEX
market data** on six EVM chains — BSC, Polygon, Arbitrum, Base, Avalanche and Optimism.

Every number is read from on-chain pool state at a stated block: per-venue pool price,
pool TVL, and the **gross** cross-venue spread with the optimal trade size that captures
it. Nothing is modelled, estimated or backfilled, and each payload carries its own scope
note — so an agent that quotes a figure also has the caveats attached to it.

Backed by the [Multi-Chain DEX Prices & Liquidity API](https://rapidapi.com/donnydev/api/multi-chain-dex-prices-liquidity).

## Tools

| Tool | What it answers | Key needed |
|---|---|---|
| `get_chains` | Which chains are covered, their chain IDs, tokens and DEX venues | Optional — falls back to the free snapshot |
| `get_pairs` | What is priceable on one chain: token universe, venues, pair syntax | Optional — falls back to the free snapshot |
| `get_prices` | One pair's price at **every** venue holding a pool for it, plus reserves, TVL, fee tier and the cross-DEX spread | Required |
| `get_spreads` | A whole chain's cross-venue dislocations, ranked by gross USD at the optimal size | Optional — free hourly snapshot without a key, fresh on-chain sweep with `live: true` |
| `get_history_summary` | What the measurement archive covers: rows, pairs tracked, chains seen, span, retention | Required |
| `get_history` | One pair's per-venue price/liquidity series and gross cross-venue spread over 24h / 7d / 30d | Required |

The two history tools read the service's own measurement archive, so they answer the
question the live tools cannot: whether a dislocation *persisted* or was a single sample.
Coverage is only what was measured — sampling is roughly hourly, and a gap stays a gap
rather than being interpolated or backfilled. Call `get_history_summary` first to see what
span exists before asking for a window.

Without a key the server still runs and returns real data from the free public surface,
labelled as such. It never fabricates a row or silently degrades: a paid call with no key
returns an explicit key-required error with the signup link.

**Spreads are gross** — before gas, MEV and slippage beyond the optimal size. Not a profit
estimate and not trade advice. A wide spread against a shallow pool is worth very little,
and `get_spreads` says so per row rather than letting a big basis-point number mislead.

## Install

```bash
git clone https://github.com/donnywin85/arb-dex-mcp.git
cd arb-dex-mcp
npm install
```

Requires Node 18+.

## Get a key

The paid tools call the API through RapidAPI using **your own** key. This package ships no
credentials of any kind.

1. Subscribe (there is a free tier): <https://rapidapi.com/donnydev/api/multi-chain-dex-prices-liquidity>
2. Copy your `X-RapidAPI-Key` from the RapidAPI dashboard.
3. Put it in `RAPIDAPI_KEY` in the config below — never in code, and never in a commit.

## Claude Desktop

`claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`,
Windows: `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "arb-dex": {
      "command": "node",
      "args": ["/absolute/path/to/arb-dex-mcp/src/index.mjs"],
      "env": {
        "RAPIDAPI_KEY": "your-rapidapi-key-here"
      }
    }
  }
}
```

Restart Claude Desktop; the six tools appear under the connectors icon.

## Claude Code

```bash
claude mcp add arb-dex --env RAPIDAPI_KEY=your-rapidapi-key-here -- node /absolute/path/to/arb-dex-mcp/src/index.mjs
```

Then `/mcp` to confirm it connected.

## Try it

Ask your agent:

- *"Which chains and DEX venues does arb-dex cover?"*
- *"What is WBNB/USDT trading at on every BSC venue right now?"*
- *"Show me the cross-DEX spreads on Polygon — are any actually capturable?"*
- *"Run a live spread sweep on Arbitrum and rank by gross USD."*
- *"How much history does arb-dex actually have, and for which chains?"*
- *"Did the WETH/USDC spread on Base persist over the last 24h or was it one sample?"*

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `RAPIDAPI_KEY` | — | Your RapidAPI key. Required for paid tools. |
| `ARB_DEX_TIMEOUT_MS` | `45000` | Request timeout. A live full-chain sweep is a real on-chain read and can take ~30s. |
| `ARB_DEX_FREE_BASE_URL` | production origin | Override the free-surface host. |
| `ARB_DEX_RAPIDAPI_HOST` | `multi-chain-dex-prices-liquidity.p.rapidapi.com` | Override the RapidAPI host. |

See `.env.example`.

## Test

```bash
npm run selftest                    # keyless: exercises the free fallbacks
RAPIDAPI_KEY=... npm run selftest   # keyed: exercises the paid routes
```

The test spawns the server over stdio and calls every tool against the **real production
API** — nothing is mocked. It asserts on live values (block number, per-venue prices,
scanned-pair counts), so a run that passes is evidence the data path works end to end.

## Closed gap

The API's paid measurement archive (`/v1/history/*`) was live on the origin but unlisted on
RapidAPI, so calls through the proxy 404'd and `get_history` was deliberately held back
rather than shipped broken. Both routes were published on the listing on 2026-08-11 and
re-measured through the proxy the same day — summary 200, pair series 200, unsupported
window 400 — so `get_history_summary` and `get_history` ship as tools, each covered by a
live keyed assertion in the selftest.

## License

MIT
