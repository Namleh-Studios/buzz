import { NAMLEH_APP_ENVIRONMENT } from "@/shared/appIdentity";

export function StagingIndicator({
  environment = NAMLEH_APP_ENVIRONMENT,
}: {
  environment?: string;
}) {
  if (environment !== "staging") return null;
  return (
    <div
      className="pointer-events-none fixed top-[4px] left-1/2 z-[100] -translate-x-1/2 rounded-full border border-black/30 bg-[var(--namleh-staging-background)] px-3 py-[2px] font-semibold text-[var(--namleh-staging-foreground)] text-xs leading-none shadow-md"
      data-testid="staging-indicator"
    >
      STAGING
    </div>
  );
}
