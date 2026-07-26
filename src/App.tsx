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
import { HistoryView } from "./views/HistoryView";
import { InsightsView } from "./views/InsightsView";
import { NotesView } from "./views/NotesView";
import { ProjectsView } from "./views/ProjectsView";
import { SchoolView } from "./views/SchoolView";
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
        <Route path="projects" element={<ProjectsView />} />
        <Route path="projects/:id" element={<ContainerDetailView />} />
        <Route path="school" element={<SchoolView />} />
        <Route path="school/:id" element={<SchoolFolderRedirect />} />
        <Route path="follow-ups" element={<FollowUpsView />} />
        <Route path="deadlines" element={<EventDeadlinesView />} />
        <Route path="climb" element={<Navigate to="/deadlines" replace />} />
        <Route path="search" element={<SearchView />} />
        <Route path="notes" element={<NotesView />} />
        <Route path="history" element={<HistoryView />} />
        <Route path="insights" element={<InsightsView />} />
        <Route path="settings" element={<SettingsView />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <UndoProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </UndoProvider>
    </ToastProvider>
  );
}
