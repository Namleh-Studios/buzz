# Upstream Selective-Port Map

Recorded for OPS-198 on 2026-08-13. This is a decision record, not an
authorization to merge `upstream/main` or an upstream feature branch.

## Checkpoint

- Original untouched baseline: `f8f2ef0440e7a074223ec04dc3b32d817b8b9d9b`
- Reviewed upstream checkpoint: `45f4b91a36145f2ce642548c34f699f1b529bcf5`
- Upstream range: `f8f2ef044..45f4b91a3`
- Range size: 41 commits; 422 files changed, 42,863 insertions, and 7,810
  deletions.
- Namleh `dev` at review start: `aeda6825e90e60d212cfca6fc253182c0e7a5948`
- No upstream commit or branch was merged by OPS-198.

The untouched behavioral baseline remains in
[`UPSTREAM_BASELINE.md`](UPSTREAM_BASELINE.md). The live upstream and Namleh
check suites for the checkpoint commits must finish before this ticket is
represented as complete. Any failure is recorded and assigned rather than
silently treated as a passing baseline.

## Checkpoint build and test results

- Namleh `dev` at `aeda6825e` passed all 23 jobs in
  [run 31727625541](https://github.com/Namleh-Studios/buzz/actions/runs/31727625541),
  including Rust, Windows, macOS, web, mobile, security, relay/backend E2E, all
  four desktop smoke shards, and both desktop integration shards.
- Upstream `45f4b91a3` completed
  [CI run 31727837133](https://github.com/block/buzz/actions/runs/31727837133)
  with 21 successful and 2 failed jobs. Across all check suites attached to the
  commit, 32 checks succeeded, 3 skipped, and the same 2 failed. `Desktop Smoke
  E2E (3)` failed one of 252 tests after the compact link-preview image remained
  unloaded (`naturalWidth == 0`) across the initial run and both retries; the
  aggregate `Desktop` job consequently failed. This is current upstream
  evidence, not a Namleh regression. The related compact-preview commit
  `45f4b91a3` remains a boundary review under OPS-229 and cannot be ported while
  assuming its test suite is green.
- Local review covered all 41 commits, verified the range and conflict results,
  validated dependency/license claims, passed the fork remote contract, parsed
  every changed Markdown file, and passed `git diff --check`. No Docker or
  local service stack was used.

## Active upstream work

Statuses and exact heads were read from GitHub on 2026-08-13. Open or closed
upstream work is reference material only; no draft, blocked, or review-rejected
branch is eligible for a wholesale merge. Future adaptation begins by comparing
the live head to the reviewed SHA and reviewing any additional range.

| Upstream work | Reviewed source | Namleh decision and owner |
|---|---|---|
| [MCP Apps channel tabs #3275](https://github.com/block/buzz/pull/3275) | Open draft at `80092c430f27f5ffb7c8e95d71a01da487da0ec1` | Reuse only the typed channel-surface seam, mounted-tab lifecycle, host-context sanitization, and sandbox review patterns under OPS-199, OPS-200, OPS-202, and OPS-215. Do not import arbitrary endpoints, remotely supplied UI, generic third-party Apps, or a marketplace. Linear and SharePoint remain closed first-party surfaces. |
| [Channel feature registry #3280](https://github.com/block/buzz/issues/3280) | Open RFC issue, updated `2026-07-28T18:36:16Z`; decoded API body SHA-256 `b182b761270e5fe6939883291e4417bff9693b574221a253fc4c3febf9f580e2` (including its final newline) | Adapt the compile-time definition-list and resolver pattern into the closed registry owned by OPS-199 and rendered by OPS-200. No dynamic plugin loader or downstream feature pack. |
| [Structured interactive Canvas RFC #2809](https://github.com/block/buzz/pull/2809) | Open at `ba44f94771fae8bafcc8145da26f5c17149cb131` | Reuse bounded schema validation, stable IDs, accessible fallbacks, and projection limits under OPS-208. Reject its storage boundary: kind `40100` remains Doc and cannot become Board or Design. |
| [Documents preview #4997](https://github.com/block/buzz/pull/4997) | Open at `b629f90c60fb589f78e6132001ab626fec10c92c` | Do not port the global local Markdown vault. It conflicts with the singleton shared Doc and SharePoint as provider source of truth. OPS-223 may independently reuse round-trip and hostile-Markdown test ideas after source-license provenance is resolved; the cited `soapbox-pub/onyx` repository was unavailable through GitHub during this review. |
| [Canvas revision history #3897](https://github.com/block/buzz/pull/3897) | Open at `e045e46352d968b602c7edc523d550e4419197c2` | Adapt the bounded signed-revision query and read-only history behavior only for the kind `40100` Doc transition in OPS-218. Board and Design use their own artifact/revision contracts under OPS-201 and OPS-206. |
| [Live Canvas updates #4827](https://github.com/block/buzz/pull/4827) | Open at `a3d0bc042d5a58049c6700af15a451fb568b65cb` | Adapt the exact-channel subscription and query invalidation pattern for Doc in OPS-218. Do not add kind `40100` to Board or Design. |
| [Structured MCP server configuration #4164](https://github.com/block/buzz/pull/4164) | Closed with changes requested at `637b1cdc5e72adadf5c38afad81cf7ea4a264f29` | Reuse the versioned, bounded, runtime-neutral launch-input concept under OPS-202. Do not cherry-pick the closed branch; reimplement against the project-owned registry, protected environment keys, and centralized approval policy. Every configured environment, header, and argument value—including short secrets—must remain redacted from logs, observer frames, and returned diagnostics. |
| [Project connections #4588](https://github.com/block/buzz/pull/4588) | Open at `6687805dd83574c589b7cc120ac589a2298d567e` | Reuse transactional local secret handling, connection probes, and tool discovery under OPS-202 and OPS-204. Provider connections remain personal and are implemented under OPS-220; shared channel state never contains credentials. |
| [Runtime readiness #2957](https://github.com/block/buzz/pull/2957) | Open at `17ff16a2d7ba2ef4f997f4a2d14ccade4e674bbc` | Adapt the current-process evidence model, explicit unknown/degraded states, bounded tool descriptors, and owner-only readiness UI under OPS-204. It is not a portable trust attestation. |
| [Playwright MCP cache isolation #5347](https://github.com/block/buzz/pull/5347) | Open at `de296b1f22b0ec7b3454d17991230306af50ef17` | Reuse the managed npm-cache and reserved-environment-key isolation pattern for local agent tooling under OPS-203 and OPS-215. It is not the private Cloudflare Browser Run product owned by OPS-212 through OPS-214. |
| [Signed channel panels #3882](https://github.com/block/buzz/pull/3882) | Open at `0065c8b476abef5f153392e140ed8bf8d8a3d371` | Reuse bounded typed projections, source provenance, safe links, and fail-closed parsing under OPS-201 and OPS-215. A projection never becomes a second source of truth and no generic panel type expands the first-preview registry. |
| [Magic Board #5476](https://github.com/block/buzz/pull/5476) | Open draft at `4c3da82224e210ae7ebac5e9d537af270dabb3b4` | Do not port. It re-renders the singleton Markdown Canvas as a Board/Stream mode, while Namleh Board is multi-instance Excalidraw under OPS-205 and chat remains the default channel surface. Its responsive-card product concept is out of scope. |

## Kind `40100`, Doc, Board, and Design

The legacy kind `40100` contract remains the singleton channel Markdown
surface. OPS-218 renames that surface to **Doc** while preserving its event
kind, stored content, CLI behavior, and compatibility aliases.

Board and Design never read or write kind `40100`:

- Board uses the shared artifact foundation in OPS-201 and the Excalidraw
  adapter in OPS-205 through OPS-207.
- Design uses a new explicit schema and renderer in OPS-208 through OPS-211.
- A projection, preview, panel, or tab may reference Doc, Board, or Design, but
  cannot reinterpret or overwrite the referenced source.

## Upstream commit-range classification

`Port before gate` means a dedicated, reviewable sync PR must resolve the item
before OPS-229 can pass. `Boundary review` means compare the exact patch against
the Namleh fork at that gate and either port it in isolation or record why it is
not applicable. `Defer` names the ticket that owns any later adaptation.

| Commit | Classification | Decision |
|---|---|---|
| `538e5e113` Desktop 0.5.9 release | Out of scope | Skip upstream release metadata and artifacts. |
| `7e6e9c547` restore entity-link cards | Important bug fix | Boundary review under OPS-229; preserve Namleh schemes from OPS-197. |
| `be48ce98b` render previews after resolution | Important bug fix | Boundary review under OPS-229. |
| `5e4d0fe92` harden Databricks OAuth cache/callback | Critical security | Port before gate in the isolated OPS-248 sync; include owner-only cache and untrusted callback handling. OPS-215 retains the later comprehensive threat-model boundary. |
| `7eb8cc5a5` YouTube oEmbed previews | Compatible improvement | Out of scope for the first preview; no owning ticket. |
| `83ca595ad` preserve theme while opening communities | Important bug fix | Boundary review under OPS-229 and OPS-242. |
| `240cdd3ea` mesh upgrade/model-selection cleanup | Architecture decision | Defer to OPS-203/OPS-204; do not upgrade the runtime implicitly. |
| `493572449` suppress fresh focus refetches | Important bug fix | Boundary review under OPS-229. |
| `d3ec831e0` preserve fresh channel timelines | Important bug fix | Boundary review under OPS-229. |
| `bba3e0638` macOS attachment-picker lifecycle/inert downloads | Important bug fix | Boundary review under OPS-229; retain Mac-first behavior. |
| `b0795a10e` send thread messages to channel | Product/UI decision | Out of scope; OPS-245 owns native-tool Share-to-chat, not general thread-message sharing. |
| `cd2aa5c12` glass appearance/settings | Product/UI decision | Skip wholesale; OPS-242 permits only bounded token-based branding. |
| `cf03bd7c3` desktop search scoping | Compatible improvement | Defer to OPS-244. |
| `397796c5f` PostgreSQL tracing spans | Compatible improvement | Defer to OPS-238 and the Cloud Hosting Foundation. |
| `e8153f8f2` log HTTP bridge event kind | Compatible improvement | Defer to OPS-238; logs remain payload-free. |
| `d9dc76c0a` bound initial timeline retention | Important bug/performance fix | Boundary review under OPS-229. |
| `16b7ae7ce` stop relay ingest panic for project reactions | Severe correctness fix | Port before gate in the isolated OPS-248 sync. |
| `9203bf60e` coalesce read-state persistence | Compatible performance fix | Boundary review under OPS-229. |
| `f35930104` repair 0.5.9 desktop performance regressions | Important bug fix | Boundary review under OPS-229; select only patches applicable to the 0.5.8 fork baseline. |
| `4b3570671` Desktop 0.5.10 release | Out of scope | Skip upstream release metadata and artifacts. |
| `1ff98fa68` launch Databricks OAuth during discovery | Important bug fix | Evaluate with `5e4d0fe92` under OPS-248; never weaken the hardened callback/cache boundary. |
| `6e0631f6b` include channel description in agent context | Product behavior | Defer to OPS-203 and OPS-215 with explicit prompt provenance and bounds. |
| `c966b862f` remediate `RUSTSEC-2026-0257` | Critical security | Port before gate under OPS-247. The root lockfile is safe, but the Tauri lockfile still pins vulnerable `webbrowser 1.2.1`; current CI scans only the root manifest. Update the affected resolution without replaying unrelated lockfile churn and add a Tauri advisory scan with a narrow, reviewed baseline for pre-existing unmaintained dependencies. |
| `63f961c7e` channel settings/profile refinements | Product/UI decision | Skip for Stage 1; reassess only with an owning product ticket. |
| `63d14a0e9` preserve live channel timelines | Important bug fix | Boundary review under OPS-229. |
| `8a2c9af2d` durable whole-community deletion | Architecture/product decision | Defer to OPS-240; do not import deletion semantics ahead of the approved retention contract. |
| `884ed8a5d` proxy sent link-preview media | Important privacy/correctness fix | Boundary review under OPS-215 and OPS-229. |
| `a8e5c89e2` preserve agent-mention separator | Important bug fix | Boundary review under OPS-229. |
| `dc2dbfe0f` lazy-pool idle re-sleep | Compatible improvement | Defer to OPS-203 and the Cloud Hosting cost boundary. |
| `c3b0ccf38` batch observer publications | Compatible performance fix | Defer to OPS-204. |
| `c6c6e7eca` coalesce thread-activity persistence | Compatible performance fix | Boundary review under OPS-229. |
| `59f613c40` defer foreground-resume work | Compatible performance fix | Boundary review under OPS-229. |
| `72d56e7bd` increase agent output/recovery limits | Product/runtime decision | Defer to OPS-203; limits are not inherited automatically. |
| `c86443c59` persist channel snapshot hash | Compatible performance fix | Boundary review under OPS-229. |
| `7634fe745` settle hydrated mobile threads | Important bug fix | Boundary review under OPS-229. |
| `4749bc7be` report standard adapter usage | Compatible improvement | Defer to OPS-204. |
| `9e0c6b432` Desktop 0.5.11 release | Out of scope | Skip upstream release metadata and artifacts. |
| `a96af8952` harden shared-agent instruction review | Critical security | Port before gate in the isolated OPS-248 sync; preserve literal review, signature verification, bounded text, and review/execution byte identity. OPS-215 retains the later comprehensive threat-model boundary. |
| `8abc2baf0` mobile community invites | Product feature | Out of scope for the Mac-first preview; no owning ticket. |
| `98d3d77b4` mobile composer regression fixes | Important bug fix | Boundary review under OPS-229. |
| `45f4b91a3` compact link-preview cards | Product/UI decision | Boundary review under OPS-229 with the preview fixes; do not overwrite Namleh deep-link handling. |

## Dependency and license boundary

OPS-198 selects no new dependency and imports no third-party source.

- Current Namleh Security CI includes the repository dependency policy and is
  required to pass at the checkpoint, but currently scans only the root
  manifest. A direct Tauri scan detects `RUSTSEC-2026-0257` plus 18 pre-existing
  unmaintained advisories; OPS-247 owns remediation and a bounded fail-closed
  Tauri policy rather than a global ignore.
- `@modelcontextprotocol/ext-apps` and `@modelcontextprotocol/sdk` currently
  report MIT licenses, but their large transitive graph is not selected because
  generic MCP Apps are excluded.
- Excalidraw reports MIT; its exact package version, assets, and notices remain
  the responsibility of OPS-205.
- The Documents proposal pins `notify 8.2.0` under CC0-1.0, but the proposed
  copied Onyx source cannot be reused until its unavailable source repository
  and license provenance are independently resolved.
- Every later port reruns dependency policy and records any lockfile, migration,
  event-kind, API, storage, or license delta in its own PR.

## Conflict and adaptation evidence

A read-only three-way merge comparison used baseline `f8f2ef044`, Namleh
`dev` at `aeda6825e`, and upstream `45f4b91a3`. A wholesale merge would
conflict in:

- root `Cargo.lock`;
- `desktop/src-tauri/tauri.conf.json`, where Namleh's stable application
  identity must win over upstream release metadata;
- `desktop/src/features/messages/ui/useComposerLinkPreviews.tsx`; and
- `desktop/src/shared/lib/useResolvedLinkPreviews.ts`.

That confirms a wholesale merge is not safe. Patch checks against current
Namleh `dev` show `5e4d0fe92`, `16b7ae7ce`, and `a96af8952` apply cleanly as
patches, while `c966b862f` does not because root `Cargo.lock` drift prevents
the two-lockfile patch from applying atomically. The Tauri lockfile remains
unchanged from the baseline and vulnerable. OPS-247 therefore owns a bounded dependency-resolution update rather
than a raw cherry-pick. OPS-248 still reviews the cleanly applying patches in
full before deciding whether to cherry-pick them; a clean patch application is
not approval.

## Verified review procedure

The checkpoint was produced with the fork's push guard active:

```bash
. ./bin/activate-hermit
scripts/configure-namleh-remotes.sh
git fetch upstream main --prune
git fetch origin dev --prune
git log --reverse --oneline f8f2ef044..45f4b91a3
git diff --stat f8f2ef044..45f4b91a3
git cherry aeda6825e 45f4b91a3 f8f2ef044
```

`origin` remained `Namleh-Studios/buzz`; upstream fetch remained
`block/buzz`; upstream push remained `/dev/null`. The review found no reason to
merge `upstream/main`. Selected security or correctness work must use a fresh
branch from `origin/dev`, exact commits or bounded manual adaptations, and its
own compatibility evidence. `git cherry` reported `+` for all 41 commits, so
none is patch-equivalent to a commit already in Namleh `dev`; independently
implemented behavior such as the root-lockfile advisory remediation is still
classified by current state rather than inferred from patch identity.
