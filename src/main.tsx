import "./state/sheetSync";
import "./global-theme.css";
import "./index.css";

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CockpitPage from "./dashboard/CockpitPage";
import BrandBar from "./BrandBar";
import { TaskProvider } from "./TaskSystems";
import { installLabelDriftDetector } from "./dev/labelDrift";

installLabelDriftDetector();

// Lightweight user-gesture latch so keystroke fetches don’t trigger the overlay.
declare global { interface Window { __lastSubmitAt?: number } }

(function setSubmitLatch() {
  const mark = () => { (window as any).__lastSubmitAt = performance.now(); };
  window.addEventListener("submit", mark, true);
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter") mark();
    },
    true
  );
  window.addEventListener(
    "click",
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest(
        "button, input[type=submit], [role='button'], a"
      ) as HTMLElement | null;
      if (!el) return;
      const isSubmitType =
        (el instanceof HTMLButtonElement && el.type === "submit") ||
        (el instanceof HTMLInputElement && el.type === "submit");
      const txt = (el.textContent || "").toLowerCase();
      const looksLikeSubmit = /submit|calculate/.test(txt);
      if (isSubmitType || looksLikeSubmit) mark();
    },
    true
  );
})();

const RootRouter = () =>
  window.location.pathname.startsWith("/cockpit") ? <CockpitPage /> : <App />;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TaskProvider
      // Narrow SSE to your actual progress stream (adjust if your route differs).
      sseMatch={(url: string) => {
        try {
          const u = new URL(url, window.location.origin);
          return u.pathname === "/api/cockpit/progress";
        } catch {
          return /\/api\/cockpit\/progress\b/i.test(url);
        }
      }}
      autoTitle="Calculating"
      autoMessage="Initializing Cockpit"
    >
      <BrandBar />
      <RootRouter />
    </TaskProvider>
  </React.StrictMode>
);
