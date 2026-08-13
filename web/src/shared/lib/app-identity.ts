const NAMLEH_DEEP_LINK_SCHEMES = new Set([
  "namleh-buzz-dev",
  "namleh-buzz-staging",
  "namleh-buzz",
]);

export function resolveAppDeepLinkScheme(
  configuredScheme: string | undefined,
  hostname: string,
): string {
  const configured = configuredScheme?.trim();
  const hostedScheme =
    hostname === "buzz-staging.namlehstudios.com"
      ? "namleh-buzz-staging"
      : hostname === "buzz.namlehstudios.com"
        ? "namleh-buzz"
        : undefined;
  if (configured) {
    if (!NAMLEH_DEEP_LINK_SCHEMES.has(configured)) {
      throw new Error(`Invalid VITE_NAMLEH_DEEP_LINK_SCHEME: ${configured}`);
    }
    if (hostedScheme && configured !== hostedScheme) {
      throw new Error(
        `Namleh Buzz identity does not match web host: ${hostname}`,
      );
    }
    return configured;
  }
  if (hostedScheme) return hostedScheme;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "namleh-buzz-dev";
  }
  throw new Error(
    `Cannot resolve Namleh Buzz identity for web host: ${hostname}`,
  );
}

export const APP_DEEP_LINK_SCHEME = resolveAppDeepLinkScheme(
  import.meta.env.VITE_NAMLEH_DEEP_LINK_SCHEME,
  window.location.hostname,
);

export function appDeepLink(pathAndQuery: string): string {
  return `${APP_DEEP_LINK_SCHEME}://${pathAndQuery}`;
}
