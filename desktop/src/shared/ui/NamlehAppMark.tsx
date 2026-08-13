import {
  APP_ICON_SRC,
  APP_ICON_SRC_SET,
  APP_PRODUCT_NAME,
} from "@/shared/appIdentity";
import { cn } from "@/shared/lib/cn";

export function NamlehAppMark({
  className,
  decorative = true,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      alt={decorative ? "" : `${APP_PRODUCT_NAME} icon`}
      className={cn("select-none", className)}
      draggable={false}
      src={APP_ICON_SRC}
      srcSet={APP_ICON_SRC_SET}
    />
  );
}
