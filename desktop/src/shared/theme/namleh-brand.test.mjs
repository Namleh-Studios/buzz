import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  NAMLEH_DARK_ACCENT,
  NAMLEH_LIGHT_ACCENT,
  namlehAccentForTheme,
} from "./namleh-brand.ts";
import { withAccentPreviewVars } from "./useThemePreviewVars.ts";

function relativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const lighter = Math.max(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  const darker = Math.min(
    relativeLuminance(foreground),
    relativeLuminance(background),
  );
  return (lighter + 0.05) / (darker + 0.05);
}

test("Namleh themes resolve their mode-specific accessible brand accents", () => {
  assert.equal(namlehAccentForTheme("buzz"), NAMLEH_LIGHT_ACCENT);
  assert.equal(namlehAccentForTheme("buzz-dark"), NAMLEH_DARK_ACCENT);
  assert.equal(namlehAccentForTheme("github-light"), null);
  assert.ok(contrast(NAMLEH_LIGHT_ACCENT, "#ffffff") >= 4.5);
  assert.ok(contrast(NAMLEH_DARK_ACCENT, "#05070b") >= 4.5);
});

test("Namleh theme previews use the same brand accent as the runtime", () => {
  const vars = { "--foreground": "0 0% 0%", "--primary": "0 0% 0%" };
  const light = withAccentPreviewVars(vars, "#ff0000", "buzz");
  const dark = withAccentPreviewVars(vars, "#ff0000", "buzz-dark");
  assert.equal(light["--primary"], "219.7 89.52% 51.4%");
  assert.equal(light["--ring"], light["--primary"]);
  assert.equal(dark["--primary"], "206.5 100.00% 61.4%");
  assert.equal(dark["--ring"], dark["--primary"]);
  assert.equal(
    withAccentPreviewVars(vars, "#ff0000", "github-light")["--primary"],
    "0.0 100.00% 50.0%",
  );
});

test("staging treatment remains readable independently of the active theme", () => {
  const css = readFileSync(
    new URL("../styles/globals/theme.css", import.meta.url),
    "utf8",
  );
  const background = css.match(
    /--namleh-staging-background:\s*(#[0-9a-f]{6})/i,
  )?.[1];
  const foreground = css.match(
    /--namleh-staging-foreground:\s*(#[0-9a-f]{6})/i,
  )?.[1];
  assert.ok(background);
  assert.ok(foreground);
  assert.ok(contrast(background, foreground) >= 4.5);
  assert.notEqual(background, NAMLEH_LIGHT_ACCENT);
  assert.notEqual(background, NAMLEH_DARK_ACCENT);
});
