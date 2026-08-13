# README audit — arb-dex-mcp, 2026-08-13

Audited against the **published** package (`arb-dex-mcp@1.0.0`, npm, published
2026-08-13T03:19:22Z) and the **live** MCP Registry listing, not against the source tree's
intentions. Every claim was executed, not read.

**Result: 7 real defects found, all fixed in the repo.** The README fixes are publishable
docs and are committed. One fix is outside the README (`src/index.mjs`) and is flagged
below because it does not reach installed users until a `1.0.1` publish.

## Verification actually performed

```
npx -y arb-dex-mcp                       -> starts, speaks MCP over stdio
initialize                               -> serverInfo { name: "arb-dex", version: "0.1.0" }   <- DEFECT 6
tools/list                               -> get_chains, get_pairs, get_prices,
                                            get_spreads, get_history_summary, get_history  (6, matches README)
get_chains        (keyless)              -> 200, 6 chains + a `limitation` note
get_pairs  bsc    (keyless)              -> 200, chainId 56, 31 pairs scanned + `limitation` note
get_spreads bsc/polygon/base/avalanche   -> 200, found: 0 on all four, full `scope` string present
get_prices bsc WBNB/USDT (keyless)       -> isError:true, explicit key-required + signup link  (correct)
get_history_summary      (keyless)       -> isError:true, same                                 (correct)
MCP Registry: io.github.donnywin85/arb-dex-mcp -> status "active", publishedAt 2026-08-13T12:26:43Z
npm tarball contents: 7 files, no credentials, LICENSE absent                                  <- DEFECT 5
```

The install path works end to end and returns real data with no key. That is the single
most important thing a README can be wrong about, and it was: see defect 1.

## Defects found and fixed

| # | Defect | Why it mattered | Fix |
|---|---|---|---|
| 1 | **`## Install` said `git clone` + `npm install`.** | The package is on npm with a `bin`. Anyone landing on the npm page — the main discovery surface — was told to clone from GitHub. Reads as unpublished. | Rewritten to `npx -y arb-dex-mcp`, with npm and registry links. |
| 2 | **Claude Desktop config used `"command": "node", "args": ["/absolute/path/to/arb-dex-mcp/src/index.mjs"]`.** | Only works after a clone. A copy-paste user gets a path that does not exist on their machine. | `"command": "npx", "args": ["-y", "arb-dex-mcp"]`, plus a note that dropping `env` runs it keyless. |
| 3 | **Claude Code line ended `-- node /absolute/path/...`.** | Same. Not copy-pasteable. | `-- npx -y arb-dex-mcp`, plus a keyless variant. |
| 4 | **No badges, and the live registry listing was unlinked.** | The listing went active at 12:26Z today and the README did not mention it existed. | npm version, MCP Registry and license badges added at the top. |
| 5 | **`## License` said MIT but there was no `LICENSE` file in the repo.** | `package.json` declares MIT; npm auto-ships `LICENSE` if present and it was absent from the 1.0.0 tarball (verified: 7 files, no LICENSE). A license badge would also have linked to a 404. | `LICENSE` (MIT, 2026 donnywin85) added. |
| 6 | **`src/index.mjs` reported `version: '0.1.0'` while the package is `1.0.0`.** | An MCP client shows that string in its server list. A user installing 1.0.0 sees 0.1.0 and reasonably concludes the install is stale. | Set to `1.0.0` with a keep-in-step comment. **Not a README fix — see "still outstanding".** |
| 7 | **Overstated keyless fallbacks.** The tools table promised `get_chains` returns "chain IDs, tokens and DEX venues" as an optional-key tool; measured, keyless it returns the chain list only. `get_pairs` likewise returns a filtered subset, not the token universe. | This is the "measured, not promised" rule applied to our own docs. The server itself is scrupulous — it ships a `limitation` field on every degraded payload — and the README was less honest than the code. | Both table rows now state what keyless actually returns; the paragraph below names which three tools answer keyless and which three hard-fail. |

Two further honesty edits made in the same pass:

- **"Try it" prompts split into keyless vs key-required.** Four of the six suggested
  questions silently required a key. A reader trying the first one that fails concludes
  the tool is broken.
- **`## Test` now says the suite is not in the tarball.** `test/` is not in `files`, so
  `npm run selftest` is unrunnable for an npx user. The clone steps moved here, where
  they are actually needed.

## Checked and correct — no change

- All six tool names and descriptions match `tools/list` exactly.
- The `RAPIDAPI_KEY` / `ARB_DEX_TIMEOUT_MS` / `ARB_DEX_FREE_BASE_URL` /
  `ARB_DEX_RAPIDAPI_HOST` config table matches `src/api.mjs` and `.env.example`.
- The "spreads are gross" caveat matches the `scope` string the server actually emits.
- The "Closed gap" section's account of the `/v1/history/*` listing is accurate.
- Repo, issues and RapidAPI links all resolve.
- The claim "ships no credentials of any kind" holds — verified against the tarball.

## Still outstanding — needs Donny

1. **The npm page still shows the old README.** npm serves the README from the published
   tarball. Every fix above is live on GitHub immediately but reaches npm only on the next
   publish. **The npm listing currently tells visitors to `git clone`.**
2. **Defect 6 (`version: '0.1.0'`) likewise does not reach installed users until a publish.**
3. Both are fixed by one `npm version patch && npm publish` → `1.0.1`. Not done here:
   publishing is a public action. Recommended, and cheap.
4. Minor, cosmetic, **do not publish just for this**: the 1.0.0 tarball's bundled
   `server.json` carries the pre-`3a08de7` long description, since the trim landed after
   the publish. The registry has the correct short one, which is the copy that matters.
