# The realistic discovery ceiling — for Donny, 2026-08-13

No hype. Every number below was measured today, not recalled.

## What the sibling package actually did

`dex-data-mcp` has been in the MCP registry since 2026-08-01 and on npm through
v1.5.1. Its result, from `EXPERIMENT-mcp-distribution-2026-08-02.md`:
**2 real MCP client calls in 6 days.** Its npm download curve for
2026-08-03 → 08-09 is `669, 133, 68, 39, 0, 54, 38` — 1,001 downloads a week that
decay from a publish-day spike and include a hard zero. That is registry mirrors and
crawlers, not installs. The x402 storefront underneath it has **0 external payer
wallets and $0.04 of external revenue, all time**, against ~$7.33/month of cost.

## The paragraph

Given that, the realistic ceiling for `arb-dex-mcp` over the next 21 days is **single-digit
real tool calls, most likely zero to three, and zero paying users** — and the honest reason
is not that the tool is bad, it is that MCP discovery is a distribution surface with almost
no traffic on it yet. The registry now lists ~thousands of servers and hands out no ranking
signal an agent acts on; `awesome-mcp-servers` has 92,215 stars but the entry would be
1 of **398** in Finance & Fintech alone and 1 of **3,371** overall, in a document nobody
reads top-to-bottom. Both are *crawlable surfaces*, not audiences. The only one of the
three drafted channels worth Donny's time is the **awesome-mcp-servers PR**, and only
because it is already staged and costs one click: it is a durable artifact that indexers
(Glama, mcp.so, PulseMCP) and coding agents scrape repeatedly, so its tiny per-day yield
compounds without further effort, and the marginal cost from here is a minute. The other
two are vanity. The **newsletter** blurb goes to **1 active subscriber** with **0 issues
ever sent** — that is a measured beehiiv reading, not a guess, so it reaches Donny and
nobody else. The **dev.to post** is worse than neutral: it needs an account he does not
have, plus two to three hours of writing and moderation, aimed at human developers who are
not the buyer — the buyer is an agent, and agents do not read dev.to. If he wants a second
hour spent on discovery at all, it should not go to any of these three; it should go to the
one intervention with a *measured* effect size on this exact channel — republishing under
the `com.donnyautomation/` namespace, which moved `dex-data` from **#288 to #18** in
registry search for "dex", because the registry substring-matches names and sorts
alphabetically and `io.github.*` sorts near the bottom. `arb-dex-mcp` just shipped as
`io.github.donnywin85/arb-dex-mcp` — the low-ranking form.

## The three channels, ranked

| channel | cost from here | measured reach | verdict |
|---|---|---|---|
| awesome-mcp-servers PR | one click (branch already pushed) | 1 of 398 in section; repo has 92,215 stars; scraped by indexers | **Worth it.** Only because it is already done. |
| dev.to article | account creation + 2-3h writing | no account exists; audience is humans, buyer is an agent | Vanity. Draft is written and can sit indefinitely at zero cost. |
| arb-desk newsletter blurb | ~10 min | **1 active subscriber, 0 issues sent, 0% open rate** | Vanity. Ship it when there is an issue going out anyway; do not schedule one for this. |

## The uncomfortable part

The pre-registered kill criterion in `EXPERIMENT-mcp-distribution-2026-08-02.md` §5 is
still binding on the `dex-data` observational read, and its decision date is **2026-08-25**.
That rule says: *0 new external payer wallets → the channel is dead, stop investing in the
storefront.* Publishing `arb-dex-mcp` and drafting three promo channels for it on 2026-08-13
is investing in the storefront twelve days before the decision that may say to stop.

That is not an argument for undoing today's work — the package is published, it is honest,
and the registry listing cost nothing. It is an argument for **not spending another
weekend on discovery until 08-25**. If the day-21 read comes back null, the correct
response is to stop promoting and let the two listings sit there for free, not to write
a second article.

**Recommended: click the PR. Leave the dev.to draft on disk. Fold the newsletter blurb
into whatever issue goes out next, if one goes out. Then wait for 08-25.**

## What would change this read

- The `com.donnyautomation/arb-dex` namespace republish landing and moving registry search
  rank the way it did for `dex-data` (#288 → #18). That is the one lever with a measured
  effect size.
- A real, non-mirror install showing up — an npm download day that is *not* adjacent to a
  publish, or a keyed call in the API logs from a wallet/IP that is not ours.
- Anything at all in the 08-25 day-21 read other than zero.
