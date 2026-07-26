import { CATEGORY_ICON_MAP, type CategoryIconKey } from "./icons";

const ICON_KEYS = Object.keys(CATEGORY_ICON_MAP) as CategoryIconKey[];

interface Props {
  value: string;
  onChange: (icon: CategoryIconKey) => void;
}

export function IconPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {ICON_KEYS.map((key) => {
        const Icon = CATEGORY_ICON_MAP[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
              active
                ? "border-sky-400/50 bg-sky-400/10 text-sky-300"
                : "border-white/5 bg-white/3 text-zinc-500"
            }`}
            aria-label={key}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
