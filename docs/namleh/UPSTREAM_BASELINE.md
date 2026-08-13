# Untouched Upstream Baseline

Recorded for OPS-196 on 2026-08-10 before any Namleh product change.

This file preserves the untouched starting evidence. The current reviewed
upstream range and adaptation decisions live in
[`UPSTREAM_PORT_MAP.md`](UPSTREAM_PORT_MAP.md).

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

The untouched tree also contained a latent push-gateway release-contract
mismatch: the contract expected a removed workflow-dispatch path while the
workflow creates the release tag directly. That path-specific check was not
triggered in the observed upstream check suite. OPS-196 records the bounded
test-only reconciliation in PR #1; runtime release behavior was not changed.

## Released Buzz isolation observation

No installed `Buzz.app` bundle with identifier `xyz.block.buzz.app` was
discoverable before this work, so OPS-196 cannot claim a side-by-side launch
test. Existing upstream application data remained present under
`~/Library/Application Support/xyz.block.buzz.app`,
`~/Library/WebKit/xyz.block.buzz.app`, and
`~/Library/Caches/xyz.block.buzz.app`; OPS-196 did not launch, install, reset,
update, remove, or modify the released application. OPS-197 owns the independent
Namleh application identity and the executable side-by-side proof.

## Compatibility evidence map

OPS-196 changes no runtime code. The hosted matrix and local mock click-through
map to the required surfaces as follows:

| Surface | Baseline evidence | Remaining gap |
|---|---|---|
| Signup/sign-in | Desktop onboarding integration specs and mobile auth/widget tests | Desktop onboarding uses the mock bridge; no explicit live hosted-account signup gate. |
| Communities, channels, chat | Relay-backed `desktop/tests/e2e/integration.spec.ts` and `stream.spec.ts`; mobile provider tests | Mobile has no device-to-relay E2E. |
| Threads and reactions | Relay NIP-10/reaction coverage in `e2e_nostr_interop.rs`; desktop thread/reaction smoke specs | No dedicated two-client relay-backed reaction UI round-trip. |
| Search | Relay NIP-50 relevance/results tests plus desktop/mobile search UI tests | Mobile remains widget-backed. |
| Media | Relay image/video/authorization suites in `e2e_media*.rs`; mobile upload tests | No material protocol gap in the tested formats. |
| Drafts | Desktop channel-switch/send-clear specs and mobile persistence/isolation tests | Desktop process-relaunch persistence is not gated. |
| Reconnect/backfill | Desktop reconnect/backfill specs and mobile replay tests | The real relay-restart spec is skipped unless `BUZZ_E2E_RELAY_RESTART=1`. |
| Agents | Desktop mock-bridge catalog/import specs | No live relay catalog/import round-trip; real agent wake/execution and `e2e_managed_agent.rs` are not in CI. |
| Canvas | SDK builder and desktop placement/unreachable tests | No live Canvas set/get round-trip; the SDK builder test is outside `just test-unit`. |
| Doc/notes | `buzz-cli` note validation/event-shape unit tests | The complete `e2e_long_form.rs` NIP-23 suite is not invoked by CI. |
| Git | Desktop repository/commit/branch UI smoke specs | `e2e_git.rs` live clone/push/fetch/concurrency tests are not invoked. |
| Huddles | Desktop transcription/chat/push-to-talk smoke specs | The bridge and microphone are mocked; no real audio/relay/sidecar round-trip. |
| Settings | Desktop shell/theme/notification specs and mobile theme persistence | OS notification delivery is simulated. |
| Deep links | Tauri parser, desktop reload/invite, and mobile round-trip tests | No OS-level protocol-handler launch gate. |
| CLI | Command inventory, message/thread parsing, and notes unit suites | Live CLI compatibility remains a manual runbook. |
| Mobile | Unit/widget coverage for auth, communities, chat, reactions, search, media, drafts, reconnect, settings, and deep links; Android debug build | No simulator/device live-relay E2E or iOS runtime gate. |

The durable visual evidence is attached to
[Namleh PR #1](https://github.com/Namleh-Studios/buzz/pull/1) and covers Inbox,
channel navigation/chat, search, and Settings/Appearance. Independent review
also passed 700×720 at 130% text zoom without root horizontal overflow. It found
a pre-existing pointer-navigation trap in narrow Settings, tracked as
[OPS-246](https://linear.app/namleh-studios/issue/OPS-246/restore-pointer-navigation-from-narrow-desktop-settings).
No uncovered surface is represented as passed.
