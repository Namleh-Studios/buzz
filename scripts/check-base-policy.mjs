const lockedPrefixes = [".github/workflows/", ".github/actions/"];
const lockedFiles = new Set([
  "scripts/check-base-policy.mjs",
  "scripts/check-branch-source-policy.sh",
  "scripts/check-dco.sh",
  "scripts/test-base-policy-contract.mjs",
  "scripts/test-ci-gate-contract.mjs",
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
    const signoffs = [...(commit.message ?? "").matchAll(/^Signed-off-by:\s*.+<([^<>]+)>\s*$/gim)].map(
      (match) => match[1].toLowerCase(),
    );
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

async function listGithub(path, token) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`https://api.github.com${path}${separator}per_page=100&page=${page}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
    const batch = await response.json();
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
    "HEAD_REF",
    "HEAD_REPOSITORY",
    "HEAD_SHA",
  ];
  for (const name of required) {
    if (!env[name]) throw new Error(`${name} is required`);
  }

  validateSource({
    baseRef: env.BASE_REF,
    headRef: env.HEAD_REF,
    headRepository: env.HEAD_REPOSITORY,
    repository: env.REPOSITORY,
  });

  const root = `/repos/${env.REPOSITORY}/pulls/${env.PR_NUMBER}`;
  const [commits, files] = await Promise.all([
    listGithub(`${root}/commits`, env.GITHUB_TOKEN),
    listGithub(`${root}/files`, env.GITHUB_TOKEN),
  ]);
  validateDco(commits);
  validatePolicyChanges({
    paths: files.map((file) => file.filename),
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
