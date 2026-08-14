export type NamlehAppEnvironment = "development" | "staging" | "production";

const ENVIRONMENT_IDENTITIES: Record<
  NamlehAppEnvironment,
  { bundleIdentifier: string; deepLinkScheme: string; productName: string }
> = {
  development: {
    bundleIdentifier: "com.namlehstudios.buzz.dev",
    deepLinkScheme: "namleh-buzz-dev",
    productName: "Namleh Buzz Dev",
  },
  staging: {
    bundleIdentifier: "com.namlehstudios.buzz.staging",
    deepLinkScheme: "namleh-buzz-staging",
    productName: "Namleh Buzz Staging",
  },
  production: {
    bundleIdentifier: "com.namlehstudios.buzz",
    deepLinkScheme: "namleh-buzz",
    productName: "Namleh Buzz",
  },
};

const configuredEnvironment =
  import.meta.env?.VITE_NAMLEH_APP_ENV ?? "development";
if (!Object.hasOwn(ENVIRONMENT_IDENTITIES, configuredEnvironment)) {
  throw new Error(`Invalid VITE_NAMLEH_APP_ENV: ${configuredEnvironment}`);
}

export const NAMLEH_APP_ENVIRONMENT =
  configuredEnvironment as NamlehAppEnvironment;
const identity = ENVIRONMENT_IDENTITIES[NAMLEH_APP_ENVIRONMENT];
export const APP_PRODUCT_NAME = identity.productName;
export const APP_BUNDLE_IDENTIFIER = identity.bundleIdentifier;
export const APP_DEEP_LINK_SCHEME = identity.deepLinkScheme;
export const APP_DEEP_LINK_PROTOCOL = `${APP_DEEP_LINK_SCHEME}:`;
const appIconEnvironment =
  NAMLEH_APP_ENVIRONMENT === "staging" ? "staging" : "production";
export const APP_ICON_SRC =
  `/namleh-${appIconEnvironment}-app-icon@2x.png` as const;
export const APP_ICON_SRC_SET =
  `/namleh-${appIconEnvironment}-app-icon@2x.png 2x, /namleh-${appIconEnvironment}-app-icon@3x.png 3x` as const;
export const LEGACY_BUZZ_DEEP_LINK_PROTOCOL = "buzz:";

const configuredScheme = import.meta.env?.VITE_NAMLEH_DEEP_LINK_SCHEME;
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
