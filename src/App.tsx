import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";

import { Layout } from "./components/Layout";
import { useAppLifecycle } from "./hooks/useAppLifecycle";
import { ToastProvider } from "./hooks/useToast";
import { UndoProvider } from "./hooks/useUndo";
import { CalendarView } from "./views/CalendarView";
import { CategoryView } from "./views/CategoryView";
import { ContainerDetailView } from "./views/ContainerDetailView";
import { EventDeadlinesView } from "./views/EventDeadlinesView";
import { FollowUpsView } from "./views/FollowUpsView";
import { GuideView } from "./views/GuideView";
import { HistoryView } from "./views/HistoryView";
import { InsightsView } from "./views/InsightsView";
import { NotesView } from "./views/NotesView";
import { ProjectsView } from "./views/ProjectsView";
import { SearchView } from "./views/SearchView";
import { SettingsView } from "./views/SettingsView";
import { TodayView } from "./views/TodayView";

function SchoolFolderRedirect() {
  const { id } = useParams();
  return <Navigate to={`/folders/${id}`} replace />;
}

function AppRoutes() {
  useAppLifecycle();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TodayView />} />
        <Route path="calendar" element={<CalendarView />} />
        <Route path="categories" element={<CategoryView />} />
        <Route path="folders" element={<ProjectsView />} />
        <Route path="folders/:id" element={<ContainerDetailView />} />
        {/* Legacy routes — kept for existing bookmarks */}
        <Route path="projects" element={<ProjectsView />} />
        <Route path="projects/:id" element={<ContainerDetailView />} />
        <Route path="school" element={<Navigate to="/categories" replace />} />
        <Route path="school/:id" element={<SchoolFolderRedirect />} />
        <Route path="follow-ups" element={<FollowUpsView />} />
        <Route path="deadlines" element={<EventDeadlinesView />} />
        <Route path="climb" element={<Navigate to="/deadlines" replace />} />
        <Route path="search" element={<SearchView />} />
        <Route path="notes" element={<NotesView />} />
        <Route path="history" element={<HistoryView />} />
        <Route path="insights" element={<InsightsView />} />
        <Route path="guide" element={<GuideView />} />
        <Route path="settings" element={<SettingsView />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const basename =
    import.meta.env.BASE_URL === "/"
      ? undefined
      : import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <ToastProvider>
      <UndoProvider>
        <BrowserRouter basename={basename}>
          <AppRoutes />
        </BrowserRouter>
      </UndoProvider>
    </ToastProvider>
  );
}
