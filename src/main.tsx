import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./refinements.css";
import "./polish.css";

const ViewerApp = lazy(() =>
  import("./viewer/ViewerApp").then((module) => ({ default: module.ViewerApp })),
);
// The admin console is never part of a public visit, so it stays out of the homepage bundle.
const AdminApp = lazy(() =>
  import("./admin/AdminApp").then((module) => ({ default: module.AdminApp })),
);

const isAdmin =
  window.location.pathname.startsWith("/admin")
  || new URLSearchParams(window.location.search).get("admin") === "1";
const isViewer = window.location.pathname.startsWith("/viewer");
const RootApp = isAdmin ? AdminApp : isViewer ? ViewerApp : App;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={isViewer ? <div className="viewer-boot" role="status">Loading Motion Lab</div> : null}>
      <RootApp />
    </Suspense>
  </React.StrictMode>,
);
