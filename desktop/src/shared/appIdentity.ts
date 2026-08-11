export type NamlehAppEnvironment = "development" | "staging" | "production";

const ENVIRONMENT_SCHEMES: Record<NamlehAppEnvironment, string> = {
  development: "namleh-buzz-dev",
  staging: "namleh-buzz-staging",
  production: "namleh-buzz",
};

const viteEnvironment = (
  import.meta as ImportMeta & {
    env?: Record<string, string | boolean | undefined>;
  }
).env;

const configuredEnvironment =
  viteEnvironment?.VITE_NAMLEH_APP_ENV ?? "development";
if (!(configuredEnvironment in ENVIRONMENT_SCHEMES)) {
  throw new Error(`Invalid VITE_NAMLEH_APP_ENV: ${configuredEnvironment}`);
}

export const NAMLEH_APP_ENVIRONMENT =
  configuredEnvironment as NamlehAppEnvironment;
export const APP_DEEP_LINK_SCHEME = ENVIRONMENT_SCHEMES[NAMLEH_APP_ENVIRONMENT];
export const APP_DEEP_LINK_PROTOCOL = `${APP_DEEP_LINK_SCHEME}:`;
export const LEGACY_BUZZ_DEEP_LINK_PROTOCOL = "buzz:";

const configuredScheme = viteEnvironment?.VITE_NAMLEH_DEEP_LINK_SCHEME;
if (configuredScheme && configuredScheme !== APP_DEEP_LINK_SCHEME) {
  throw new Error(
    `VITE_NAMLEH_DEEP_LINK_SCHEME ${configuredScheme} does not match ${NAMLEH_APP_ENVIRONMENT}`,
  );
}

export function isSupportedBuzzDeepLinkProtocol(protocol: string): boolean {
  return (
    protocol === APP_DEEP_LINK_PROTOCOL ||
    protocol === LEGACY_BUZZ_DEEP_LINK_PROTOCOL
  );
}

export function isBuzzEntityDeepLink(href: string): boolean {
  try {
    const parsed = new URL(href);
    return (
      isSupportedBuzzDeepLinkProtocol(parsed.protocol) &&
      ["pr", "issue", "repo"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}
