import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const workflowDirectory = resolve(root, ".github/workflows");
const permissionPattern = /permissions:\s*write-all|(?:contents|packages|id-token|attestations):\s*write|permission-contents:\s*write/;
const dangerousPattern = /permissions:\s*write-all|(?:contents|packages|id-token|attestations):\s*write|permission-contents:\s*write|docker\/build-push-action|\bhelm push\b|\bgh release (?:create|edit|upload)\b|\bgit push\b/;

function jobBlocks(file, workflow) {
  const jobsStart = workflow.indexOf("\njobs:\n");
  if (jobsStart < 0) return [];

  const jobs = workflow.slice(jobsStart);
  for (const line of jobs.split("\n")) {
    if (/^  \S/.test(line) && !/^  #/.test(line) && !/^  [A-Za-z0-9_-]+:\s*$/.test(line)) {
      throw new Error(`${file}: noncanonical job key is not allowed: ${line.trim()}`);
    }
  }

  const matches = [...jobs.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)];
  return matches.map((match, index) => ({
    id: match[1],
    text: jobs.slice(match.index, matches[index + 1]?.index ?? jobs.length),
  }));
}

function conditionFor(block) {
  const lines = block.split("\n");
  const index = lines.findIndex((line) => /^    if:/.test(line));
  if (index < 0) return null;

  const first = lines[index].replace(/^    if:\s*/, "");
  if (first !== ">" && first !== "|") return first.trim();

  const continuation = [];
  for (const line of lines.slice(index + 1)) {
    if (/^    \S/.test(line)) break;
    if (/^      \S/.test(line)) continuation.push(line.trim());
  }
  return continuation.join(" ");
}

function isWrapped(expression) {
  if (!expression.startsWith("(") || !expression.endsWith(")")) return false;
  let depth = 0;
  for (let index = 0; index < expression.length; index += 1) {
    if (expression[index] === "(") depth += 1;
    if (expression[index] === ")") depth -= 1;
    if (depth === 0 && index < expression.length - 1) return false;
  }
  return depth === 0;
}

function hasExclusiveUpstreamGuard(condition) {
  const guard = "github.repository == 'block/buzz'";
  if (condition === guard) return true;
  if (!condition?.startsWith(`${guard} && `)) return false;

  const remainder = condition.slice(`${guard} && `.length).trim();
  return !remainder.includes("||") || isWrapped(remainder);
}

let guardedCount = 0;
for (const name of readdirSync(workflowDirectory).filter((file) => /\.ya?ml$/.test(file)).sort()) {
  const file = `.github/workflows/${name}`;
  const workflow = readFileSync(resolve(root, file), "utf8");
  const jobsStart = workflow.indexOf("\njobs:\n");
  const workflowHasWritePermissions = jobsStart >= 0 && permissionPattern.test(workflow.slice(0, jobsStart));
  for (const job of jobBlocks(file, workflow)) {
    if (!workflowHasWritePermissions && !dangerousPattern.test(job.text)) continue;
    const condition = conditionFor(job.text);
    if (!hasExclusiveUpstreamGuard(condition)) {
      throw new Error(`${file}: write-capable job ${job.id} is not exclusively fork-gated to block/buzz`);
    }
    guardedCount += 1;
  }
}

if (guardedCount === 0) throw new Error("no write-capable publication jobs were discovered");
console.log(`All ${guardedCount} inherited write-capable jobs are fork-gated.`);
