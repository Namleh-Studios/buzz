# Untouched Upstream Baseline

Recorded for OPS-196 on 2026-08-10 before any Namleh product change.

## Source identity

- Fork: `Namleh-Studios/buzz`
- Upstream: `block/buzz`
- Starting commit: `f8f2ef0440e7a074223ec04dc3b32d817b8b9d9b`
- `main`, `origin/main`, `origin/dev`, and `upstream/main` matched at the
  starting commit when `dev` was created.
- The fork retained the full Git history and GitHub identifies it as a fork of
  `block/buzz`.
- `LICENSE` remained Apache-2.0 with SHA-256
  `108cb15997e51b75a8d18b0c1e2c52bd3879d051ab02118973387df1e4aab584`.
- No dependency, dependency license, migration, event-kind, API, persistence,
  or product behavior change is part of OPS-196.

Upstream commit evidence:
<https://github.com/block/buzz/commit/f8f2ef0440e7a074223ec04dc3b32d817b8b9d9b>

## Upstream CI evidence

GitHub reported the upstream commit's check suite successful, including
Rust lint and unit tests, backend integration, relay E2E, desktop core and
build, desktop smoke and integration shards, web, mobile, and security.

## Local no-infrastructure evidence

The untouched checkout was verified with the repository Hermit toolchain:

| Check | Result | Notes |
|---|---|---|
| `just ci` | Incomplete locally: disk exhaustion | Formatting, clippy, desktop lint and 4,584 JS tests, desktop and web builds, Tauri check, and mobile analyze completed before the combined command failed during the Tauri test link step. After removing 6.1 GiB of disposable root build output, the remaining official recipes below passed independently. Hosted PR CI supplies the complete matrix. |
| `just desktop-tauri-test` | Passed | 2,383 desktop library tests passed; 14 OS-keychain tests ignored by their upstream contract. Desktop terminal suites also passed; the native performance gate remained intentionally ignored. |
| `just web-build` | Passed | Production web build completed with the upstream chunk-size warning. |
| `just mobile-test` | Passed | 1,261 Flutter tests passed. |
| `scripts/run-tests.sh all` unit phase | Passed | All no-infrastructure Rust suites completed before the integration phase requested local services. |
| `just desktop-e2e-smoke` | Not executed locally | The e2e build passed, but the pinned Playwright browser was not installed. The run was stopped rather than downloading another browser or consuming local resources. Hosted PR CI and the in-app-browser click-through supply visual evidence. |
| Docker-backed integration phase | Not run locally | Local Docker and service-stack execution is prohibited for this workspace. Hosted PR CI owns this evidence. |

Expected upstream warnings were preserved as baseline evidence rather than
silenced: four desktop Biome warnings, Vite chunk-size/dynamic-import warnings,
and Flutter's available-but-incompatible package update notice.

## Released Buzz isolation observation

No installed `Buzz.app` bundle with identifier `xyz.block.buzz.app` was
discoverable before this work, so OPS-196 cannot claim a side-by-side launch
test. Existing upstream application data remained present under
`~/Library/Application Support/xyz.block.buzz.app`,
`~/Library/WebKit/xyz.block.buzz.app`, and
`~/Library/Caches/xyz.block.buzz.app`; OPS-196 did not launch, install, reset,
update, remove, or modify the released application. OPS-197 owns the independent
Namleh application identity and the executable side-by-side proof.

## Compatibility surface requiring evidence

OPS-196 changes no runtime code. The automated upstream check suite supplies
the broad regression baseline, while the local mock click-through currently
covers Inbox, channel navigation/chat, search, and Settings/Appearance. The
remaining required surfaces—signup/sign-in, communities, threads, reactions,
media, drafts, reconnect/backfill, agents, Canvas/Doc, Git, Huddles, and deep
links—still require an explicit test-or-smoke evidence mapping before this
ticket can be completed. No uncovered surface is represented as passed.
