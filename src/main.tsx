import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

const ViewerApp = lazy(() =>
  import("./viewer/ViewerApp").then((module) => ({ default: module.ViewerApp })),
);
// The admin console is never part of a public visit, so it stays out of the homepage bundle.
const AdminApp = lazy(() =>
  import("./admin/AdminApp").then((module) => ({ default: module.AdminApp })),
);

// The scroll experience owns "/". The previous homepage stays reachable at /classic.
const classicStyles = () =>
  Promise.all([
    import("./styles.css"),
    import("./refinements.css"),
    import("./polish.css"),
    import("./quiet-labels.css"),
  ]);
const ClassicApp = lazy(() => import("./App").then((module) => ({ default: module.App })));

const path = window.location.pathname;
const isAdmin = path.startsWith("/admin") || new URLSearchParams(window.location.search).get("admin") === "1";
const isViewer = path.startsWith("/viewer");
const isClassic = path.startsWith("/classic") || path === "/logo";
const rootElement = document.getElementById("root")!;

if (!isAdmin && !isViewer && !isClassic) {
  void import("./experience").then(({ mountExperience }) => mountExperience(rootElement));
} else {
  const RootApp = isAdmin ? AdminApp : isViewer ? ViewerApp : ClassicApp;
  void classicStyles().then(() => {
    createRoot(rootElement).render(
      <React.StrictMode>
        <Suspense fallback={isViewer ? <div className="viewer-boot" role="status">Loading Motion Lab</div> : null}>
          <RootApp />
        </Suspense>
      </React.StrictMode>,
    );
  });
}
