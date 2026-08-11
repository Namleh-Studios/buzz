import { execFileSync } from "node:child_process";

const lockedPrefixes = [".github/workflows/", ".github/actions/"];
const lockedFiles = new Set([
  ".github/CODEOWNERS",
  "AGENTS.md",
  "docs/namleh/UPSTREAM_WORKFLOW.md",
  "scripts/check-base-policy.mjs",
  "scripts/check-branch-source-policy.sh",
  "scripts/check-dco.sh",
  "scripts/configure-namleh-remotes.sh",
  "scripts/resolve-github-origin-repo.sh",
  "scripts/test-base-policy-contract.mjs",
  "scripts/test-branch-source-policy.sh",
  "scripts/test-ci-gate-contract.mjs",
  "scripts/test-dco-contract.sh",
  "scripts/test-github-origin-repo.sh",
  "scripts/test-namleh-fork-contract.sh",
  "scripts/test-namleh-publish-guards.rb",
]);

export function isLockedPolicyPath(path) {
  return lockedFiles.has(path) || lockedPrefixes.some((prefix) => path.startsWith(prefix));
}

export function validateSource({ baseRef, headRef, headRepository, repository }) {
  if (baseRef === "main" && (headRef !== "dev" || headRepository !== repository)) {
    throw new Error(`main accepts only ${repository}:dev; received ${headRepository}:${headRef}`);
  }
}

export function validateDefaultBranch(defaultBranch) {
  if (defaultBranch !== "dev") throw new Error(`repository default branch must be dev; received ${defaultBranch}`);
}

export function validateEventMatchesPullRequest({
  pullRequest,
  baseRef,
  baseSha,
  headRef,
  headRepository,
  headSha,
}) {
  const actualHeadRepository = pullRequest.head?.repo?.full_name;
  if (
    pullRequest.base?.ref !== baseRef ||
    pullRequest.base?.sha !== baseSha ||
    pullRequest.head?.ref !== headRef ||
    actualHeadRepository !== headRepository ||
    pullRequest.head?.sha !== headSha
  ) {
    throw new Error("pull request changed after this policy event; a fresh event must validate the current state");
  }
}

export function validateStablePullRequestSnapshot({ before, after }) {
  const fields = [
    ["base ref", before.base?.ref, after.base?.ref],
    ["base SHA", before.base?.sha, after.base?.sha],
    ["head ref", before.head?.ref, after.head?.ref],
    ["head repository", before.head?.repo?.full_name, after.head?.repo?.full_name],
    ["head SHA", before.head?.sha, after.head?.sha],
    ["commit count", before.commits, after.commits],
    ["changed file count", before.changed_files, after.changed_files],
  ];
  const changed = fields.filter(([, first, second]) => first !== second).map(([name]) => name);
  if (changed.length > 0) {
    throw new Error(`pull request changed while policy data was loading: ${changed.join(", ")}`);
  }
}

export function signoffEmails(message) {
  const trailers = execFileSync("git", ["interpret-trailers", "--parse"], {
    input: message,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return [...trailers.matchAll(/^Signed-off-by:\s*.+<([^<>]+)>\s*$/gim)].map((match) =>
    match[1].toLowerCase(),
  );
}

export function validateDco(commits) {
  if (commits.length === 0) throw new Error("pull request contains no commits");

  const failures = [];
  for (const entry of commits) {
    const commit = entry.commit ?? {};
    const emails = new Set(
      [commit.author?.email, commit.committer?.email]
        .filter(Boolean)
        .map((email) => email.toLowerCase()),
    );
    const signoffs = signoffEmails(commit.message ?? "");
    if (!signoffs.some((email) => emails.has(email))) failures.push(entry.sha ?? "unknown commit");
  }

  if (failures.length > 0) {
    throw new Error(`commits missing a matching Signed-off-by trailer: ${failures.join(", ")}`);
  }
}

export function validatePolicyChanges({ paths, approvedHeadSha, headSha }) {
  const lockedChanges = paths.filter(isLockedPolicyPath);
  if (lockedChanges.length > 0 && approvedHeadSha !== headSha) {
    throw new Error(
      `protected automation changes require NAMLEH_POLICY_CHANGE_HEAD_SHA=${headSha}: ${lockedChanges.join(", ")}`,
    );
  }
}

export function policyPathsFromFiles(files) {
  const paths = [];
  for (const file of files) {
    if (typeof file.filename !== "string" || file.filename.length === 0) {
      throw new Error("GitHub returned a file without a valid filename");
    }
    paths.push(file.filename);

    if (file.previous_filename !== undefined) {
      if (typeof file.previous_filename !== "string" || file.previous_filename.length === 0) {
        throw new Error(`GitHub returned an invalid previous_filename for ${file.filename}`);
      }
      paths.push(file.previous_filename);
    } else if (file.status === "renamed") {
      throw new Error(`GitHub omitted previous_filename for renamed file ${file.filename}`);
    }
  }
  return paths;
}

export function validateApiCompleteness({ pullRequest, commits, files }) {
  const commitCount = pullRequest.commits;
  const fileCount = pullRequest.changed_files;
  if (!Number.isInteger(commitCount) || commitCount < 1) {
    throw new Error("GitHub returned an invalid pull request commit count");
  }
  if (!Number.isInteger(fileCount) || fileCount < 0) {
    throw new Error("GitHub returned an invalid pull request file count");
  }
  if (commitCount >= 250) {
    throw new Error("pull requests with 250 or more commits exceed the trusted API review bound");
  }
  if (fileCount >= 3000) {
    throw new Error("pull requests with 3000 or more changed files exceed the trusted API review bound");
  }
  if (commits.length !== commitCount) {
    throw new Error(`GitHub commit list is incomplete: expected ${commitCount}, received ${commits.length}`);
  }
  if (files.length !== fileCount) {
    throw new Error(`GitHub file list is incomplete: expected ${fileCount}, received ${files.length}`);
  }
}

async function githubJson(path, token) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

async function listGithub(path, token) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const batch = await githubJson(`${path}${separator}per_page=100&page=${page}`, token);
    if (!Array.isArray(batch)) throw new Error("GitHub API did not return a list");
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

async function main() {
  const env = process.env;
  const required = [
    "GITHUB_TOKEN",
    "REPOSITORY",
    "PR_NUMBER",
    "BASE_REF",
    "BASE_SHA",
    "HEAD_REF",
    "HEAD_REPOSITORY",
    "HEAD_SHA",
    "DEFAULT_BRANCH",
  ];
  for (const name of required) {
    if (!env[name]) throw new Error(`${name} is required`);
  }

  validateDefaultBranch(env.DEFAULT_BRANCH);
  validateSource({
    baseRef: env.BASE_REF,
    headRef: env.HEAD_REF,
    headRepository: env.HEAD_REPOSITORY,
    repository: env.REPOSITORY,
  });

  const root = `/repos/${env.REPOSITORY}/pulls/${env.PR_NUMBER}`;
  const pullRequestBefore = await githubJson(root, env.GITHUB_TOKEN);
  validateEventMatchesPullRequest({
    pullRequest: pullRequestBefore,
    baseRef: env.BASE_REF,
    baseSha: env.BASE_SHA,
    headRef: env.HEAD_REF,
    headRepository: env.HEAD_REPOSITORY,
    headSha: env.HEAD_SHA,
  });

  const [commits, files] = await Promise.all([
    listGithub(`${root}/commits`, env.GITHUB_TOKEN),
    listGithub(`${root}/files`, env.GITHUB_TOKEN),
  ]);
  const pullRequestAfter = await githubJson(root, env.GITHUB_TOKEN);
  validateEventMatchesPullRequest({
    pullRequest: pullRequestAfter,
    baseRef: env.BASE_REF,
    baseSha: env.BASE_SHA,
    headRef: env.HEAD_REF,
    headRepository: env.HEAD_REPOSITORY,
    headSha: env.HEAD_SHA,
  });
  validateStablePullRequestSnapshot({ before: pullRequestBefore, after: pullRequestAfter });
  validateApiCompleteness({ pullRequest: pullRequestAfter, commits, files });
  validateDco(commits);
  validatePolicyChanges({
    paths: policyPathsFromFiles(files),
    approvedHeadSha: env.APPROVED_POLICY_HEAD_SHA ?? "",
    headSha: env.HEAD_SHA,
  });
  console.log(`Base Policy Gate accepted ${commits.length} commits and ${files.length} changed files.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
