import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AdminApp } from "./admin/AdminApp";
import "./styles.css";

const ViewerApp = lazy(() =>
  import("./viewer/ViewerApp").then((module) => ({ default: module.ViewerApp })),
);

const isAdmin =
  window.location.pathname.startsWith("/admin")
  || new URLSearchParams(window.location.search).get("admin") === "1";
const isViewer = window.location.pathname.startsWith("/viewer");
const RootApp = isAdmin ? AdminApp : isViewer ? ViewerApp : App;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="viewer-boot" role="status">Loading Motion Lab</div>}>
      <RootApp />
    </Suspense>
  </React.StrictMode>,
);
