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
  if (configured) {
    if (!NAMLEH_DEEP_LINK_SCHEMES.has(configured)) {
      throw new Error(`Invalid VITE_NAMLEH_DEEP_LINK_SCHEME: ${configured}`);
    }
    return configured;
  }
  if (hostname === "buzz-staging.namlehstudios.com") {
    return "namleh-buzz-staging";
  }
  if (hostname === "buzz.namlehstudios.com") return "namleh-buzz";
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
