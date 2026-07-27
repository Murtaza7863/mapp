import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { APP_NAME } from "../config";
import { useCommandShortcuts } from "../hooks/useCommandShortcuts";
import { useItems } from "../hooks/useItems";
import {
  buildEventDeadlineEntries,
  deadlineUrgency,
} from "../lib/event-deadlines";
import { countNeedsChase } from "../lib/pipeline";
import { AppLogo } from "./AppLogo";
import {
  CalendarIcon,
  ChartIcon,
  ChevronRightIcon,
  DotsIcon,
  FolderIcon,
  GridIcon,
  HistoryIcon,
  NoteIcon,
  ReplyIcon,
  SearchIcon,
  SettingsIcon,
  SparkIcon,
  SunIcon,
} from "./icons";
import { InstallPrompt } from "./InstallPrompt";
import { OfflineBanner } from "./OfflineBanner";
import { UndoToast } from "./UndoToast";

const mainLinks = [
  { to: "/", label: "Home", Icon: SunIcon },
  { to: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { to: "/categories", label: "Areas", Icon: GridIcon },
];

const moreLinks = [
  { to: "/guide", label: "How it works", Icon: SparkIcon },
  {
    to: "/follow-ups",
    label: "Follow-ups",
    Icon: ReplyIcon,
    badgeKey: "followups" as const,
  },
  {
    to: "/deadlines",
    label: "Event prep",
    Icon: CalendarIcon,
    badgeKey: "prep" as const,
  },
  { to: "/folders", label: "All folders", Icon: FolderIcon },
  { to: "/search", label: "Search", Icon: SearchIcon },
  { to: "/notes", label: "Notes", Icon: NoteIcon },
  { to: "/history", label: "History", Icon: HistoryIcon },
  { to: "/insights", label: "Insights", Icon: ChartIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="nav-badge"
      aria-label={`${count} ${count === 1 ? "item needs" : "items need"} attention`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function Layout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const { items } = useItems();
  useCommandShortcuts();

  const nudgeCount = useMemo(() => countNeedsChase(items), [items]);

  const urgentPrepCount = useMemo(
    () =>
      buildEventDeadlineEntries(items).filter(
        (e) => deadlineUrgency(e.daysUntilPrep) === "high",
      ).length,
    [items],
  );

  const moreBadgeCount = nudgeCount + urgentPrepCount;

  const badgeFor = (key?: "followups" | "prep") => {
    if (key === "followups") return nudgeCount;
    if (key === "prep") return urgentPrepCount;
    return 0;
  };

  const todayLabel = format(new Date(), "EEE, MMM d");

  return (
    <div className="app-shell mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="glass-panel app-header sticky top-0 z-40 px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label={`${APP_NAME} home`}>
            <AppLogo size="sm" />
          </Link>
          <div className="flex items-center gap-1">
            <span className="text-muted hidden text-xs sm:inline">
              {todayLabel}
            </span>
            <button
              type="button"
              onClick={() => navigate("/search")}
              className="text-muted hover:text-primary rounded-md p-2 transition-colors"
              aria-label="Search"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main flex-1 overflow-y-auto px-4 pt-3 pb-2">
        <OfflineBanner />
        <InstallPrompt />
        <Outlet />
      </main>

      <UndoToast />

      {moreOpen && (
        <div
          className="bg-overlay fixed inset-0 z-50"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="modal-sheet absolute right-0 bottom-0 left-0 max-h-[70dvh] overflow-y-auto rounded-t-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-accent-bar rounded-t-xl" />
            <div className="p-5 pt-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-primary text-lg font-semibold">More</h2>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="text-muted text-sm font-medium"
                >
                  Done
                </button>
              </div>
              <div className="space-y-1.5">
                {moreLinks.map((link) => {
                  const count = badgeFor(link.badgeKey);
                  return (
                    <button
                      key={link.to}
                      type="button"
                      onClick={() => {
                        navigate(link.to);
                        setMoreOpen(false);
                      }}
                      className="item-card flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-left"
                    >
                      <link.Icon className="text-muted h-5 w-5 shrink-0" />
                      <span className="text-primary flex-1 font-medium">
                        {link.label}
                      </span>
                      <NavBadge count={count} />
                      <ChevronRightIcon className="text-muted/60 h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="nav-floating fixed z-40">
        <div className="mx-auto flex max-w-lg justify-around px-0.5 py-1.5">
          {mainLinks.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors ${
                  isActive ? "nav-item-active" : "text-muted"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="text-muted relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium"
          >
            <span className="relative">
              <DotsIcon className="h-5 w-5" />
              <NavBadge count={moreBadgeCount} />
            </span>
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
