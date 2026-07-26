import { Navigate } from "react-router-dom";

/** @deprecated Legacy route — areas are managed under /categories */
export function SchoolView() {
  return <Navigate to="/categories" replace />;
}
