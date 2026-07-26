import type { Category } from "../types";

import { CategoryIcon } from "./CategoryIcon";

interface Props {
  category?: Category;
  size?: "sm" | "md";
}

export function CategoryBadge({ category, size = "sm" }: Props) {
  if (!category) {
    return (
      <span className="border-white/8 bg-white/5 text-muted inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
        Uncategorized
      </span>
    );
  }

  const textSize = size === "sm" ? "text-[11px]" : "text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium ${textSize}`}
      style={{
        backgroundColor: `${category.color}18`,
        borderColor: `${category.color}33`,
        color: category.color,
      }}
    >
      <CategoryIcon category={category} className="h-3 w-3" />
      {category.name}
    </span>
  );
}
