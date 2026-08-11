# Namleh Buzz Fork Workflow

`Namleh-Studios/buzz` is the working fork. `block/buzz` is an upstream source,
not a delivery remote.

## Clone and remote contract

```bash
git clone https://github.com/Namleh-Studios/buzz.git
cd buzz
scripts/configure-namleh-remotes.sh
git remote -v
```

The resulting contract is:

| Remote | Fetch | Push |
|---|---|---|
| `origin` | `https://github.com/Namleh-Studios/buzz.git` | `https://github.com/Namleh-Studios/buzz.git` |
| `upstream` | `https://github.com/block/buzz.git` | disabled |

Feature work branches from `origin/dev` and returns to `dev` through a pull
request:

```bash
git fetch origin dev
git switch -c codex/<ticket>-<slug> origin/dev
```

`dev` is the staging source. `main` is the production source. Both branches
are protected against direct and force pushes. Production promotion or release
requires explicit founder approval. OPS-196 establishes these source and
approval boundaries; later fork-baseline tickets establish and prove the
independent staging build, deployment, and production release wiring.

GitHub enforces the source contract:

- `dev` and `main` require GitHub Actions-owned `CI Gate` and `DCO Check`
  results, one CODEOWNER approval from someone other than the last pusher,
  resolved conversations, linear history, and administrator enforcement;
  branch deletion and force push are disabled. GitHub Actions cannot approve
  pull requests.
- The `staging` environment accepts only `dev`.
- The `production` environment accepts only `main` and requires approval from
  Steven or Tim. The deployment requester cannot self-approve, and
  administrators cannot bypass the environment gate.
- Pull requests to `main` must come from `dev`; a checked-in source-policy job
  enforces the staging-to-production route.
- Squash is the only enabled merge method, and merged feature branches are
  deleted automatically.

These policies do not themselves deploy or package an application. A workflow
must explicitly reference the correct GitHub environment after the owning
environment ticket establishes that build or deployment.
Inherited upstream publication jobs are fork-gated to `block/buzz`, so enabling
them in the Namleh fork cannot publish a relay image, Helm chart, Sprig image,
tag, or release around the Namleh environment contract.

## Selective upstream sync

Never merge `upstream/main` wholesale into `dev` or `main`.

```bash
scripts/configure-namleh-remotes.sh
git fetch upstream main
git fetch origin dev
git log --oneline --decorate <last-reviewed-upstream>..upstream/main
git diff --stat <last-reviewed-upstream>..upstream/main
git switch -c codex/upstream-<yyyy-mm-dd> origin/dev
```

Review the complete range before applying changes. Classify each relevant
commit as:

- critical security fix;
- important bug fix;
- compatible reusable improvement;
- product, UI, or architecture decision requiring explicit approval; or
- out of scope.

Port only the approved commits, using `git cherry-pick -x --signoff` when a
commit can be accepted intact and a bounded, signed-off manual adaptation
otherwise. Do not merge draft, blocked, experimental, marketplace, remotely
supplied UI, or generic app-host branches wholesale.

Open the result as a pull request to `dev` using the upstream-sync template:

```bash
git push -u origin HEAD
gh pr create --base dev --draft --template upstream-sync.md
```

The pull request records:

- the previous and new upstream checkpoints;
- every accepted and skipped commit with its classification and rationale;
- conflicts and adaptations;
- dependency and license changes;
- migrations and protocol implications; and
- local no-infrastructure checks, remote integration checks, and targeted
  compatibility evidence.

After staging validation, record the new last-reviewed upstream commit in the
owning Linear ticket even when no change is accepted. Ordinary upstream work
waits for a stage boundary. Only a critical security or severe correctness fix
may interrupt active stage work, in a dedicated PR with no unrelated ports.

## Local and remote validation

This Mac does not run the repository's Docker Compose development stack.

Run locally:

```bash
. ./bin/activate-hermit
scripts/test-namleh-fork-contract.sh
git diff --check
actionlint .github/workflows/ci.yml
```

Add only the no-infrastructure component checks relevant to the files changed.
Do not use the monolithic `just ci` recipe as the default gate on this Mac; the
hosted pull-request workflow supplies that complete matrix without consuming
local disk for every platform build. Run desktop visual checks through the e2e
mock build and Codex in-app browser; do not install an additional Playwright
browser locally solely for baseline capture. Pull-request CI owns relay,
database, auth, media, reconnect, and full Playwright integration coverage on
disposable hosted runners. Managed staging owns runtime smoke testing after the
environment-specific deployment tickets are complete.

No failed, skipped, or unavailable lane may be reported as passed. Record the
reason and the remote or managed environment that supplies the missing
evidence.
