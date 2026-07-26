import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import {
  CalendarIcon,
  ChartIcon,
  ChevronRightIcon,
  ClockIcon,
  DotsIcon,
  FolderIcon,
  GridIcon,
  HistoryIcon,
  MountainIcon,
  NoteIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from "./icons";
import { InstallPrompt } from "./InstallPrompt";
import { OfflineBanner } from "./OfflineBanner";
import { UndoToast } from "./UndoToast";

const mainLinks = [
  { to: "/", label: "Home", Icon: SunIcon },
  { to: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { to: "/categories", label: "Areas", Icon: GridIcon },
  { to: "/follow-ups", label: "Threads", Icon: ClockIcon },
];

const moreLinks = [
  { to: "/deadlines", label: "Event prep", Icon: MountainIcon },
  { to: "/folders", label: "All folders", Icon: FolderIcon },
  { to: "/search", label: "Search", Icon: SearchIcon },
  { to: "/notes", label: "Notes", Icon: NoteIcon },
  { to: "/history", label: "History", Icon: HistoryIcon },
  { to: "/insights", label: "Insights", Icon: ChartIcon },
  { to: "/settings", label: "Settings", Icon: SettingsIcon },
];

export function Layout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="app-shell mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="glass-panel app-header sticky top-0 z-40 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-zinc-200 text-sm font-semibold tracking-tight">
            mApp
          </span>
          <button
            type="button"
            onClick={() => navigate("/search")}
            className="text-zinc-500 hover:text-zinc-300 rounded-md p-2 transition-colors"
            aria-label="Search"
          >
            <SearchIcon className="h-5 w-5" />
          </button>
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
          className="bg-black/70 fixed inset-0 z-50 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="modal-sheet absolute right-0 bottom-0 left-0 max-h-[70dvh] overflow-y-auto rounded-t-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-accent-bar rounded-t-3xl" />
            <div className="p-5 pt-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-zinc-100 text-lg font-semibold">More</h2>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="bg-white/5 text-zinc-400 rounded-full px-3 py-1 text-sm"
                >
                  Done
                </button>
              </div>
              <div className="space-y-1.5">
                {moreLinks.map((link) => (
                  <button
                    key={link.to}
                    type="button"
                    onClick={() => {
                      navigate(link.to);
                      setMoreOpen(false);
                    }}
                    className="item-card flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
                  >
                    <link.Icon className="text-zinc-500 h-5 w-5 shrink-0" />
                    <span className="text-zinc-200 flex-1 font-medium">
                      {link.label}
                    </span>
                    <ChevronRightIcon className="text-zinc-600 h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="nav-floating fixed z-40 rounded-2xl">
        <div className="flex justify-around px-0.5 py-2">
          {mainLinks.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? "nav-item-active" : "text-zinc-500"
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
            className="text-zinc-500 flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium"
          >
            <DotsIcon className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
