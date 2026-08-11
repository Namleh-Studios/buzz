import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const jobsStart = workflow.indexOf("\njobs:\n");
if (jobsStart < 0) throw new Error("jobs section is missing");

const jobs = workflow.slice(jobsStart);
const jobIds = [...jobs.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)].map((match) => match[1]);
const gateStart = jobs.indexOf("\n  ci-gate:\n");
if (gateStart < 0) throw new Error("ci-gate job is missing");

const gate = jobs.slice(gateStart);
const needsMatch = gate.match(/\n    needs:\n((?:      - [A-Za-z0-9_-]+\n)+)/);
if (!needsMatch) throw new Error("ci-gate.needs is missing");

const needs = [...needsMatch[1].matchAll(/^      - ([A-Za-z0-9_-]+)$/gm)].map((match) => match[1]);
const expected = jobIds.filter((job) => job !== "ci-gate").sort();
const actual = [...needs].sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`ci-gate.needs mismatch\nexpected: ${expected.join(", ")}\nactual: ${actual.join(", ")}`);
}

console.log(`CI Gate covers all ${expected.length} other jobs.`);
