const NAMLEH_DEEP_LINK_SCHEMES = new Set([
  "namleh-buzz-dev",
  "namleh-buzz-staging",
  "namleh-buzz",
]);

const configuredScheme = import.meta.env.VITE_NAMLEH_DEEP_LINK_SCHEME?.trim();
export const APP_DEEP_LINK_SCHEME = configuredScheme || "namleh-buzz";

if (!NAMLEH_DEEP_LINK_SCHEMES.has(APP_DEEP_LINK_SCHEME)) {
  throw new Error(
    `Invalid VITE_NAMLEH_DEEP_LINK_SCHEME: ${APP_DEEP_LINK_SCHEME}`,
  );
}

export function appDeepLink(pathAndQuery: string): string {
  return `${APP_DEEP_LINK_SCHEME}://${pathAndQuery}`;
}
