import { format } from "date-fns";

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  showDate?: boolean;
}

export function PageHeader({ title, subtitle, action, showDate }: Props) {
  return (
    <header className="mb-1 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {showDate && (
          <p className="text-zinc-500 mb-1 text-xs">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex min-h-6 items-center justify-between gap-2">
      <h2 className="text-zinc-500 text-xs font-medium tracking-wide uppercase">
        {title}
        {count !== undefined && (
          <span className="text-zinc-600 ml-1.5 tracking-normal normal-case tabular-nums">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="empty-state rounded-lg px-5 py-10 text-center">
      {icon && (
        <div className="text-zinc-600 border-white/[0.06] bg-white/[0.02] mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-md border">
          {icon}
        </div>
      )}
      <p className="text-zinc-300 text-sm font-medium">{title}</p>
      {description && (
        <p className="text-zinc-600 mt-1 text-xs leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-2.5 py-1.5 text-xs font-medium ${active ? "filter-pill-active" : "filter-pill"}`}
    >
      {children}
    </button>
  );
}
