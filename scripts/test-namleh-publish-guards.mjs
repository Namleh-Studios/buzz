import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const guardedJobs = {
  ".github/workflows/auto-tag-on-release-pr-merge.yml": ["auto-tag"],
  ".github/workflows/docker.yml": ["build", "merge", "push-gateway-build", "push-gateway-merge"],
  ".github/workflows/helm-chart.yml": ["publish"],
  ".github/workflows/mobile-release-candidate.yml": ["publish"],
  ".github/workflows/promote-oss-desktop-release.yml": ["promote"],
  ".github/workflows/push-gateway-helm-chart.yml": ["publish"],
  ".github/workflows/release.yml": [
    "setup",
    "release",
    "release-macos-x64",
    "release-linux",
    "release-windows",
    "assemble-manifest",
  ],
  ".github/workflows/sprig-image.yml": ["build", "merge"],
  ".github/workflows/sprig.yml": ["publish", "publish-tag"],
};

const forkExclusiveJobs = {
  ".github/workflows/docker.yml": ["build", "push-gateway-build"],
  ".github/workflows/sprig-image.yml": ["build"],
};

for (const [file, jobs] of Object.entries(guardedJobs)) {
  const workflow = readFileSync(resolve(root, file), "utf8");
  for (const job of jobs) {
    const start = workflow.search(new RegExp(`^  ${job}:\\s*$`, "m"));
    if (start < 0) throw new Error(`${file}: missing ${job} job`);
    const remainder = workflow.slice(start + 1);
    const next = remainder.search(/^  [A-Za-z0-9_-]+:\s*$/m);
    const block = next < 0 ? remainder : remainder.slice(0, next);
    if (!block.includes("github.repository == 'block/buzz'")) {
      throw new Error(`${file}: ${job} is not fork-gated to block/buzz`);
    }
  }
}

for (const [file, jobs] of Object.entries(forkExclusiveJobs)) {
  const workflow = readFileSync(resolve(root, file), "utf8");
  for (const job of jobs) {
    const start = workflow.search(new RegExp(`^  ${job}:\\s*$`, "m"));
    const remainder = workflow.slice(start + 1);
    const next = remainder.search(/^  [A-Za-z0-9_-]+:\s*$/m);
    const block = next < 0 ? remainder : remainder.slice(0, next);
    const condition = block.match(/^    if: (.+)$/m)?.[1];
    if (condition !== "github.repository == 'block/buzz'") {
      throw new Error(`${file}: ${job} must be disabled entirely outside block/buzz`);
    }
  }
}

console.log("All inherited publication jobs are fork-gated.");
