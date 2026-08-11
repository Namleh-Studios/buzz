import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  isLockedPolicyPath,
  validateDco,
  validatePolicyChanges,
  validateSource,
} from "./check-base-policy.mjs";

const workflow = readFileSync(new URL("../.github/workflows/base-policy.yml", import.meta.url), "utf8");
assert.match(workflow, /^\s*pull_request_target:\s*$/m);
assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
assert.match(workflow, /persist-credentials: false/);
assert.match(workflow, /run: node scripts\/check-base-policy\.mjs/);
assert.doesNotMatch(workflow, /pull_request\.head\.sha[^\n]*ref:/);

assert.equal(isLockedPolicyPath(".github/workflows/ci.yml"), true);
assert.equal(isLockedPolicyPath(".github/workflows/spoof.yaml"), true);
assert.equal(isLockedPolicyPath(".github/actions/local/action.yml"), true);
assert.equal(isLockedPolicyPath("scripts/check-base-policy.mjs"), true);
assert.equal(isLockedPolicyPath("desktop/src/main.tsx"), false);

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

console.log("Base Policy Gate contract passed.");
