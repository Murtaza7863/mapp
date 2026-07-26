import { Navigate } from "react-router-dom";

import { useCategories } from "../hooks/useCategories";
import { findSchoolCategory } from "../lib/school";

/** @deprecated School is now managed under Areas */
export function SchoolView() {
  const { categories } = useCategories();
  const school = findSchoolCategory(categories);
  return (
    <Navigate
      to="/categories"
      state={school ? { areaId: school.id } : undefined}
      replace
    />
  );
}
