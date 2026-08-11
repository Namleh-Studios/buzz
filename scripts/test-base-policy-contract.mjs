import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  isLockedPolicyPath,
  policyPathsFromFiles,
  signoffEmails,
  validateApiCompleteness,
  validateDco,
  validateDefaultBranch,
  validateEventMatchesPullRequest,
  validatePolicyChanges,
  validateSource,
  validateStablePullRequestSnapshot,
} from "./check-base-policy.mjs";

const workflow = readFileSync(new URL("../.github/workflows/base-policy.yml", import.meta.url), "utf8");
assert.match(workflow, /^\s*pull_request_target:\s*$/m);
assert.match(workflow, /types: \[opened, synchronize, reopened, ready_for_review, edited\]/);
assert.match(workflow, /ref: \$\{\{ github\.workflow_sha \}\}/);
assert.match(workflow, /persist-credentials: false/);
assert.match(workflow, /run: node scripts\/check-base-policy\.mjs/);
assert.doesNotMatch(workflow, /pull_request\.head\.sha[^\n]*ref:/);

assert.equal(isLockedPolicyPath(".github/workflows/ci.yml"), true);
assert.equal(isLockedPolicyPath(".github/workflows/spoof.yaml"), true);
assert.equal(isLockedPolicyPath(".github/actions/local/action.yml"), true);
assert.equal(isLockedPolicyPath("scripts/check-base-policy.mjs"), true);
assert.equal(isLockedPolicyPath("AGENTS.md"), true);
assert.equal(isLockedPolicyPath(".github/CODEOWNERS"), true);
assert.equal(isLockedPolicyPath("scripts/configure-namleh-remotes.sh"), true);
assert.equal(isLockedPolicyPath("scripts/resolve-github-origin-repo.sh"), true);
assert.equal(isLockedPolicyPath("desktop/src/main.tsx"), false);

validateDefaultBranch("dev");
assert.throws(() => validateDefaultBranch("main"), /default branch must be dev/);

const eventPullRequest = {
  base: { ref: "dev", sha: "base" },
  head: {
    ref: "feature",
    sha: "abc",
    repo: { full_name: "Namleh-Studios/buzz" },
  },
};
validateEventMatchesPullRequest({
  pullRequest: eventPullRequest,
  baseRef: "dev",
  baseSha: "base",
  headRef: "feature",
  headRepository: "Namleh-Studios/buzz",
  headSha: "abc",
});
for (const mismatch of [
  { baseRef: "main", baseSha: "base", headRef: "feature", headRepository: "Namleh-Studios/buzz", headSha: "abc" },
  { baseRef: "dev", baseSha: "other", headRef: "feature", headRepository: "Namleh-Studios/buzz", headSha: "abc" },
  { baseRef: "dev", baseSha: "base", headRef: "renamed", headRepository: "Namleh-Studios/buzz", headSha: "abc" },
  { baseRef: "dev", baseSha: "base", headRef: "feature", headRepository: "external/buzz", headSha: "abc" },
  { baseRef: "dev", baseSha: "base", headRef: "feature", headRepository: "Namleh-Studios/buzz", headSha: "new" },
]) {
  assert.throws(
    () => validateEventMatchesPullRequest({ pullRequest: eventPullRequest, ...mismatch }),
    /fresh event/,
  );
}

validateStablePullRequestSnapshot({ before: eventPullRequest, after: structuredClone(eventPullRequest) });
for (const after of [
  { ...eventPullRequest, base: { ref: "main" } },
  { ...eventPullRequest, base: { ...eventPullRequest.base, sha: "other" } },
  { ...eventPullRequest, head: { ...eventPullRequest.head, ref: "renamed" } },
  {
    ...eventPullRequest,
    head: { ...eventPullRequest.head, repo: { full_name: "external/buzz" } },
  },
  { ...eventPullRequest, head: { ...eventPullRequest.head, sha: "new" } },
  { ...eventPullRequest, commits: 2 },
  { ...eventPullRequest, changed_files: 2 },
]) {
  assert.throws(
    () => validateStablePullRequestSnapshot({ before: eventPullRequest, after }),
    /changed while policy data was loading/,
  );
}

validateSource({
  baseRef: "dev",
  headRef: "feature",
  headRepository: "external/buzz",
  repository: "Namleh-Studios/buzz",
});
validateSource({
  baseRef: "main",
  headRef: "dev",
  headRepository: "Namleh-Studios/buzz",
  repository: "Namleh-Studios/buzz",
});
assert.throws(
  () =>
    validateSource({
      baseRef: "main",
      headRef: "dev",
      headRepository: "external/buzz",
      repository: "Namleh-Studios/buzz",
    }),
  /main accepts only/,
);

const signedCommit = {
  sha: "signed",
  commit: {
    author: { email: "author@example.com" },
    committer: { email: "committer@example.com" },
    message: "Subject\n\nSigned-off-by: Author <AUTHOR@example.com>",
  },
};
validateDco([signedCommit]);
assert.deepEqual(signoffEmails(signedCommit.commit.message), ["author@example.com"]);
assert.deepEqual(
  signoffEmails("Subject\n\nSigned-off-by: Author <author@example.com>\n\nBody after the supposed trailer"),
  [],
);
assert.throws(
  () =>
    validateDco([
      {
        ...signedCommit,
        sha: "unsigned",
        commit: { ...signedCommit.commit, message: "Subject" },
      },
    ]),
  /unsigned/,
);
assert.throws(
  () =>
    validateDco([
      {
        ...signedCommit,
        sha: "body-signoff",
        commit: {
          ...signedCommit.commit,
          message: "Subject\n\nSigned-off-by: Author <author@example.com>\n\nBody after the supposed trailer",
        },
      },
    ]),
  /body-signoff/,
);

validatePolicyChanges({ paths: ["desktop/src/main.tsx"], approvedHeadSha: "", headSha: "abc" });
validatePolicyChanges({ paths: [".github/workflows/ci.yml"], approvedHeadSha: "abc", headSha: "abc" });
assert.throws(
  () =>
    validatePolicyChanges({
      paths: [".github/workflows/ci.yml"],
      approvedHeadSha: "stale",
      headSha: "abc",
    }),
  /NAMLEH_POLICY_CHANGE_HEAD_SHA=abc/,
);

assert.deepEqual(
  policyPathsFromFiles([
    {
      filename: "docs/renamed.yml",
      previous_filename: ".github/workflows/base-policy.yml",
      status: "renamed",
    },
  ]),
  ["docs/renamed.yml", ".github/workflows/base-policy.yml"],
);
assert.throws(
  () => policyPathsFromFiles([{ filename: "docs/renamed.yml", status: "renamed" }]),
  /omitted previous_filename/,
);
assert.throws(() => policyPathsFromFiles([{ status: "modified" }]), /valid filename/);
assert.throws(
  () =>
    validatePolicyChanges({
      paths: policyPathsFromFiles([
        {
          filename: "docs/renamed.yml",
          previous_filename: ".github/workflows/base-policy.yml",
          status: "renamed",
        },
      ]),
      approvedHeadSha: "",
      headSha: "abc",
    }),
  /base-policy\.yml/,
);

validateApiCompleteness({
  pullRequest: { commits: 1, changed_files: 1 },
  commits: [signedCommit],
  files: [{ filename: "README.md", status: "modified" }],
});
assert.throws(
  () => validateApiCompleteness({ pullRequest: { commits: 250, changed_files: 1 }, commits: [], files: [{}] }),
  /250 or more commits/,
);
assert.throws(
  () => validateApiCompleteness({ pullRequest: { commits: 1, changed_files: 3000 }, commits: [], files: [] }),
  /3000 or more changed files/,
);
assert.throws(
  () => validateApiCompleteness({ pullRequest: { commits: 2, changed_files: 1 }, commits: [signedCommit], files: [{}] }),
  /commit list is incomplete/,
);
assert.throws(
  () => validateApiCompleteness({ pullRequest: { commits: 1, changed_files: 2 }, commits: [signedCommit], files: [{}] }),
  /file list is incomplete/,
);

console.log("Base Policy Gate contract passed.");
