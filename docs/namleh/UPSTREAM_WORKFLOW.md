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

`dev` is the repository default and staging source. `main` is the production source. Both branches
are protected against direct and force pushes. Production promotion or release
requires explicit founder approval. OPS-196 establishes these source and
approval boundaries; later fork-baseline tickets establish and prove the
independent staging build, deployment, and production release wiring. OPS-253
adds the unsigned, SHA-bound staging identity artifact used by the Stage 1
gate; OPS-217 owns the first Developer ID-signed and notarized preview.

The repository follows the same lightweight PR contract as other Namleh
projects:

- `dev` and `main` require a pull request, resolved conversations, linear
  history, and administrator enforcement; branch deletion and force push are
  disabled. Applicable CI must be green before Codex merges, but Buzz does not
  add custom required-check aggregation, DCO, or base-policy workflows.
  The solo-founder workflow does not require a peer approval in GitHub. Owner
  authorization, independent agent review and testing, and hosted CI
  are the review contract. GitHub Actions cannot approve pull requests.
- The `staging` environment accepts only `dev`.
- The `production` environment accepts only `main` and requires Steven's
  explicit approval. Steven may approve a deployment he requested because he
  is the sole founder in this workflow; administrators cannot bypass the
  environment gate.
- Pull requests to `main` must come from `dev`; this remains an owner-controlled
  promotion step rather than a custom CI policy job.
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

The last reviewed checkpoint and proposal-level adaptation boundaries are
recorded in [`UPSTREAM_PORT_MAP.md`](UPSTREAM_PORT_MAP.md). Update that record
at every completed stage boundary, including a no-change review.

```bash
scripts/configure-namleh-remotes.sh
git fetch upstream main
git fetch origin dev
old=<last-reviewed-upstream>
new=$(git rev-parse upstream/main)
if ! git merge-base --is-ancestor "$old" "$new"; then
  echo "upstream checkpoint is not an ancestor of the fetched head" >&2
  exit 1
fi
git log --oneline --decorate "$old..$new"
git diff --stat "$old..$new"
git cherry origin/dev "$new" "$old"
git switch -c codex/upstream-<yyyy-mm-dd> origin/dev
```

Review the complete range before applying changes. Classify each relevant
commit as:

- critical security fix;
- important bug fix;
- compatible reusable improvement;
- product, UI, or architecture decision requiring explicit approval; or
- out of scope.

Record the exact `old` and `new` SHAs and the `git cherry` result. A `-` entry
is patch-equivalent to Namleh `dev`; a `+` entry is not. Patch equivalence does
not replace behavioral or security-state verification.

For an open proposal branch, compare its live head to the reviewed proposal
SHA recorded in the port map. If the reviewed SHA is not an ancestor after a
force-push or rebase, inspect both complete patch sets or use `git range-diff`;
never assume `reviewed..live` is an additive range.

Port only the approved commits, using `git cherry-pick -x` when a commit can be
accepted intact and a bounded manual adaptation otherwise. Do not merge draft,
blocked, experimental, marketplace, remotely
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
