import type { Category } from "../types";

import {
  CATEGORY_ICON_MAP,
  resolveCategoryIconKey,
  type CategoryIconKey,
} from "./icons";

interface Props {
  category?: Pick<Category, "icon" | "color">;
  iconKey?: CategoryIconKey;
  className?: string;
}

export function CategoryIcon({
  category,
  iconKey,
  className = "h-3.5 w-3.5",
}: Props) {
  const key = iconKey ?? resolveCategoryIconKey(category?.icon);
  const Icon = CATEGORY_ICON_MAP[key];
  return (
    <Icon
      className={className}
      style={category?.color ? { color: category.color } : undefined}
    />
  );
}
