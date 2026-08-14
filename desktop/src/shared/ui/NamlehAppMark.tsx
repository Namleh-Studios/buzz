import {
  APP_ICON_SRC,
  APP_ICON_SRC_SET,
  APP_PRODUCT_NAME,
} from "@/shared/appIdentity";
import { cn } from "@/shared/lib/cn";

export function NamlehAppMark({
  className,
  decorative = true,
  label = `${APP_PRODUCT_NAME} icon`,
}: {
  className?: string;
  decorative?: boolean;
  label?: string;
}) {
  return (
    <img
      alt={decorative ? "" : label}
      className={cn("select-none", className)}
      data-testid="namleh-app-mark"
      draggable={false}
      src={APP_ICON_SRC}
      srcSet={APP_ICON_SRC_SET}
    />
  );
}
