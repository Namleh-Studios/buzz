import { createHash } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const desktopDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalSourcePath = resolve(
  desktopDirectory,
  "src-tauri/icons/namleh/source/namleh-icon.svg",
);
const sourcePath = resolve(process.argv[2] ?? canonicalSourcePath);
const source = readFileSync(sourcePath, "utf8");
const expectedSourceSha256 =
  "1086d6ed3aacc7e2940abbfbce653308ec8baf7263eb9d77cf9f1d743f15e511";
const sourceSha256 = createHash("sha256").update(source).digest("hex");

if (sourceSha256 !== expectedSourceSha256) {
  throw new Error(
    `Namleh source icon does not match the approved asset: ${sourceSha256}`,
  );
}

if (sourcePath !== canonicalSourcePath) {
  mkdirSync(dirname(canonicalSourcePath), { recursive: true });
  cpSync(sourcePath, canonicalSourcePath);
}

const menuTemplatePath = resolve(
  desktopDirectory,
  "src-tauri/icons/namleh/source/namleh-menu-template.png",
);
const menuResult = spawnSync(
  "rsvg-convert",
  [
    "--width",
    "64",
    "--height",
    "64",
    "--output",
    menuTemplatePath,
    canonicalSourcePath,
  ],
  { encoding: "utf8" },
);
if (menuResult.status !== 0) {
  throw new Error(
    menuResult.stderr || menuResult.stdout || "Menu template generation failed",
  );
}

const inner = source
  .replace(/^<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .trim();

function iconSvg(environment) {
  const staging = environment === "staging";
  const outerFill = staging ? "#f5a524" : "url(#namleh-app-background)";
  const innerSurface = staging ? "#ffffff" : "transparent";
  const innerInset = staging ? 102 : 64;
  const markInset = staging ? 138 : 92;
  const markSize = 1024 - markInset * 2;
  const stagingBadge = staging
    ? `<circle cx="824" cy="200" r="82" fill="#111827"/>
  <text x="824" y="252" text-anchor="middle" font-family="Arial, sans-serif" font-size="142" font-weight="800" fill="#ffffff">S</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="namleh-app-background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#e8f3ff"/>
    </linearGradient>
  </defs>
  <rect x="48" y="48" width="928" height="928" rx="220" fill="${outerFill}"/>
  <rect x="${innerInset}" y="${innerInset}" width="${1024 - innerInset * 2}" height="${1024 - innerInset * 2}" rx="${staging ? 174 : 196}" fill="${innerSurface}"/>
  <svg x="${markInset}" y="${markInset}" width="${markSize}" height="${markSize}" viewBox="0 0 2048 2048">
${inner}
  </svg>
  ${stagingBadge}
</svg>
`;
}

function dmgSvg(environment) {
  const staging = environment === "staging";
  const productName = staging ? "Namleh Buzz Staging" : "Namleh Buzz";
  const markX = 510;
  const markY = 80;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1320 1064">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${staging ? "#fff7e8" : "#edf5ff"}"/>
      <stop offset="1" stop-color="${staging ? "#ffe0a3" : "#d7e3f2"}"/>
    </linearGradient>
  </defs>
  <rect width="1320" height="1064" fill="url(#background)"/>
  <svg x="${markX}" y="${markY}" width="300" height="300" viewBox="0 0 2048 2048">
${inner}
  </svg>
  <text x="660" y="438" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="#071225">${productName}</text>
  <text x="660" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#29415f">Drag the app into Applications</text>
  ${staging ? '<rect x="540" y="530" width="240" height="66" rx="33" fill="#f5a524"/><text x="660" y="575" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#111827">STAGING</text>' : ""}
</svg>
`;
}

const tempDirectory = mkdtempSync(resolve(tmpdir(), "namleh-macos-icons-"));

try {
  for (const environment of ["production", "staging"]) {
    const svgPath = resolve(tempDirectory, `${environment}.svg`);
    const generatedDirectory = resolve(tempDirectory, environment);
    const destinationDirectory = resolve(
      desktopDirectory,
      `src-tauri/icons/namleh/${environment}`,
    );
    writeFileSync(svgPath, iconSvg(environment));
    const result = spawnSync(
      resolve(desktopDirectory, "node_modules/.bin/tauri"),
      ["icon", "--output", generatedDirectory, svgPath],
      { cwd: desktopDirectory, encoding: "utf8" },
    );
    if (result.status !== 0) {
      throw new Error(
        result.stderr || result.stdout || "Tauri icon generation failed",
      );
    }

    mkdirSync(destinationDirectory, { recursive: true });
    for (const filename of [
      "32x32.png",
      "128x128.png",
      "128x128@2x.png",
      "icon.icns",
    ]) {
      cpSync(
        resolve(generatedDirectory, filename),
        resolve(destinationDirectory, filename),
      );
    }
    writeFileSync(
      resolve(destinationDirectory, "source.svg"),
      iconSvg(environment),
    );
    for (const [density, size] of [
      ["2x", 224],
      ["3x", 336],
    ]) {
      const publicResult = spawnSync(
        "rsvg-convert",
        [
          "--width",
          String(size),
          "--height",
          String(size),
          "--output",
          resolve(
            desktopDirectory,
            `public/namleh-${environment}-app-icon@${density}.png`,
          ),
          resolve(destinationDirectory, "source.svg"),
        ],
        { encoding: "utf8" },
      );
      if (publicResult.status !== 0) {
        throw new Error(
          publicResult.stderr ||
            publicResult.stdout ||
            "Public app icon generation failed",
        );
      }
    }

    const dmgSourcePath = resolve(destinationDirectory, "dmg-background.svg");
    const dmgPath = resolve(destinationDirectory, "dmg-background.png");
    writeFileSync(dmgSourcePath, dmgSvg(environment));
    const dmgResult = spawnSync(
      "rsvg-convert",
      [
        "--width",
        "1320",
        "--height",
        "1064",
        "--output",
        dmgPath,
        dmgSourcePath,
      ],
      { encoding: "utf8" },
    );
    if (dmgResult.status !== 0) {
      throw new Error(
        dmgResult.stderr ||
          dmgResult.stdout ||
          "DMG background generation failed",
      );
    }
  }
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}

console.log("Generated Namleh production and staging macOS icons");
