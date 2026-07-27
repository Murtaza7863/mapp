import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App.tsx";
import { BootGate } from "./components/BootGate";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BootGate>
        <App />
      </BootGate>
    </ErrorBoundary>
  </StrictMode>,
);
