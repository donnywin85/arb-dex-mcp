> **DRAFT — NOT PUBLISHED.** Nothing in this file has been posted anywhere.
>
> **Standing to-do before this can ship: Donny must create/verify a dev.to account.**
> There is no dev.to account on file for this empire. Until that exists, this is a
> markdown file, not a post. Paste the block below the `---` line into the dev.to
> editor when the account is live.
>
> Frontmatter is set to `published: false` on purpose — even after pasting, it lands
> as a dev.to draft and needs a second, deliberate publish click.
>
> Every number below was measured on 2026-08-13 against the published package, not
> recalled. If you paste this more than a few days later, re-run the commands — a
> stale spread quoted as live is exactly the lie this tool exists not to tell.
>
> **One caveat on the evidence.** The `get_spreads` JSON in the post is a verbatim
> capture. The per-row *field names* are not — at capture time every chain returned
> `found: 0` on the free snapshot, so no populated row was observed. They are read
> from the service's own renderer (`arb-dex-data/dashboard.js:26-42`), which consumes
> the same payload. Before publishing, get a populated row with a keyed `live: true`
> sweep and paste the real thing; if any name has drifted, the post is wrong.

---

---
title: "A DEX spread tool your agent can actually call — and why most of the spreads it finds are worthless"
published: false
tags: mcp, ai, defi, web3
canonical_url:
---

I build cross-DEX arbitrage instrumentation. The most useful thing I learned doing it
is not where the money is — it is how often a big, real, correctly-computed number is
worth nothing. So when I wrapped the data as an MCP tool, I made the tool say that out
loud on every row.

This is `arb-dex-mcp`. It is small, it is new, and I have no adoption numbers to show
you. What I do have is the data path, working, that you can verify in about thirty
seconds.

## Install

```bash
npx -y arb-dex-mcp
```

That starts a stdio MCP server, which is only useful to an MCP client. So:

**Claude Code**

```bash
claude mcp add arb-dex -- npx -y arb-dex-mcp
```

**Claude Desktop / Cursor** — in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "arb-dex": {
      "command": "npx",
      "args": ["-y", "arb-dex-mcp"]
    }
  }
}
```

No key, no signup, no wallet for that config. Two of the six tools answer keyless
against a free hourly snapshot. Live per-block reads need your own RapidAPI key —
more on that below, including the part where I tell you not to bother yet.

## What it returns

Six tools across BSC, Polygon, Arbitrum, Base, Avalanche and Optimism:

| tool | answers | key |
|---|---|---|
| `get_chains` | which chains are covered | optional |
| `get_pairs` | what is priceable on a chain | optional |
| `get_spreads` | a chain's cross-venue dislocations, ranked by gross USD at the optimal size | optional |
| `get_prices` | one pair's price at **every** venue holding a pool for it, plus reserves, TVL, fee tier | required |
| `get_history_summary` | what the measurement archive actually covers | required |
| `get_history` | one pair's per-venue series over 24h / 7d / 30d | required |

Here is a real keyless `get_spreads` response for BSC, captured 2026-08-13T11:54Z:

```json
{
  "chain": "bsc",
  "chainId": 56,
  "name": "BNB Smart Chain",
  "scannedPairs": 31,
  "found": 0,
  "top": [],
  "filters": {
    "minSpreadBps": 10,
    "minVenueTvlUsd": 1000,
    "minGrossUsd": 0.01,
    "topPerChain": 5
  },
  "scope": "GROSS cross-venue spreads from live pool state, BEFORE gas, MEV and any slippage beyond the optimal size. Not a profit estimate and not trade advice. Venues below the liquidity floor are excluded because a spread against a dust pool is an artefact, not an opportunity.",
  "source": "free public snapshot (hourly). Pass live=true with a RAPIDAPI_KEY for a fresh sweep and tunable filters."
}
```

`found: 0`. Thirty-one pairs scanned, nothing above the floor.

I am leading with the empty response on purpose, because it is the honest modal answer
and because it is the one an LLM is most likely to hallucinate its way past.

## The part that matters: gross is not profit

Run this over a week and you get numbers like the widest one my own desk recorded in
the 2026-08-10 → 08-16 window: **171.68 bps on WBTC/USDC on Polygon.** That is a real,
correctly-computed 1.7% divergence between two Uniswap v3 fee tiers.

It is also worth **one cent**.

The shallow side of that pair held $1,470 of TVL. The optimal trade size — the size
that maximises gross capture before you move the price against yourself — was **$0.85**.
Gross at that size: **$0.01**, before gas. Not one spread on any chain that week was
capturable.

So every `get_spreads` row ships these together and never one without the others:

- `grossSpreadBps` — the raw divergence
- `optimalTradeSizeUsd` — the size that actually captures it
- `grossUsdAtOptimalSize` — what that size earns, gross
- `capturable` — a flag; `false` means the spread is real but fees eat it at any tradeable size
- `shallowestSideTvlUsd`, plus `buyAt` / `sellAt` with per-venue TVL
- `tickBoundaryBreach` — set when the optimal-size math crosses a v3 tick band, i.e. the
  true cost is higher than the row shows

An agent handed only the first number will confidently tell its user there is a 171 bps
arb on Polygon. That is not a hallucination — the number is right — and it is still
completely wrong. The fix is not a smarter model, it is a payload that refuses to be
quoted out of context.

Same reason the free-tier responses carry a `limitation` field naming exactly what a key
would add. A tool that quietly returns a thinner answer in the same shape as a full one
teaches the agent to trust it wrongly.

## History: did it persist, or was it one sample?

The two history tools read the service's own measurement archive rather than live chain
state, which answers the question the live tools structurally cannot: was that
dislocation *there*, or did you catch one hourly sample of a thin quote?

Sampling is roughly hourly and **a gap stays a gap** — nothing is interpolated or
backfilled. Call `get_history_summary` first to see what span exists before you ask for
a window; asking for 30d of a pair with 3 days of record gets you 3 days of record and a
note saying so, not a smooth 30-day line.

## Scope, honestly

What this is not:

- **Not a profit estimate.** Gross, before gas, MEV, and slippage beyond the optimal size.
- **Not trade advice.** It reports pool state. What you do with it is entirely on you.
- **Not exhaustive.** Six chains, a curated pair universe, v2 and v3 constant-product and
  concentrated-liquidity pools. If your pair is not in the sweep, it is not in the sweep.
- **Not a CEX feed.** On-chain pool state only.
- **Not battle-tested at scale.** It was published on 2026-08-13. I am the main user.

What it is: a way for an agent to read on-chain pool prices and cross-venue spreads at a
stated block without you standing up RPC infrastructure across six chains and
re-deriving v3 tick math.

## Keys, and why you probably do not need one yet

The three paid tools proxy through RapidAPI on **your own** key — the package ships no
credentials of any kind, and there is a free tier. But start keyless. `get_spreads` on
the free snapshot tells you within one call whether this data is shaped like something
you want, and that costs you nothing and no signup.

- npm: `arb-dex-mcp`
- Official MCP Registry: `io.github.donnywin85/arb-dex-mcp`
- Source: https://github.com/donnywin85/arb-dex-mcp
- MIT

If you point an agent at it and it says something dumb, open an issue with the payload.
That is the most useful thing anyone could do with this right now.
