import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Database } from "@phosphor-icons/react/Database";
import { Plus } from "@phosphor-icons/react/Plus";
import { UploadSimple } from "@phosphor-icons/react/UploadSimple";
import { X } from "@phosphor-icons/react/X";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { OpenSimPreview } from "./OpenSimPreview";
import { SomaSequenceViewer } from "./SomaSequenceViewer";
import type {
  IframeViewerDefinition,
  ViewerDefinition,
  ViewerKey,
  ViewerSession,
} from "./types";

const REGISTRY_URL = "/viewer-data/sessions.json";
const LOCAL_SESSIONS_KEY = "cerebel.viewer.sessions.v1";

const viewerCopy = {
  soma: {
    index: "01",
    title: "Surface",
  },
  kinetic: {
    index: "02",
    title: "Joint motion",
  },
} as const;

function isSafeUrl(value: string): boolean {
  try {
    const parsed = new URL(value, window.location.href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isViewerDefinition(value: unknown): value is ViewerDefinition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ViewerDefinition>;
  if (candidate.kind === "iframe") {
    return typeof candidate.url === "string" && isSafeUrl(candidate.url);
  }
  return (
    candidate.kind === "mesh-sequence"
    && typeof candidate.metadataUrl === "string"
    && isSafeUrl(candidate.metadataUrl)
  );
}

function isViewerSession(value: unknown): value is ViewerSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ViewerSession>;
  const viewers = candidate.viewers as ViewerSession["viewers"] | undefined;
  const hasViewer = Boolean(
    (viewers?.soma && isViewerDefinition(viewers.soma))
    || (viewers?.kinetic && isViewerDefinition(viewers.kinetic)),
  );
  return (
    typeof candidate.id === "string"
    && typeof candidate.label === "string"
    && typeof candidate.description === "string"
    && typeof candidate.fps === "number"
    && typeof candidate.frameCount === "number"
    && (candidate.status === "qualitative" || candidate.status === "development")
    && typeof candidate.source === "string"
    && hasViewer
  );
}

function readSavedSessions(): ViewerSession[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LOCAL_SESSIONS_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isViewerSession) : [];
  } catch {
    return [];
  }
}

function mergeSessions(...groups: ViewerSession[][]): ViewerSession[] {
  const merged = new Map<string, ViewerSession>();
  groups.flat().forEach((session) => merged.set(session.id, session));
  return [...merged.values()];
}

function firstViewer(session: ViewerSession): ViewerKey {
  return session.viewers.soma ? "soma" : "kinetic";
}

export function ViewerApp() {
  return <MotionViewerWorkspace />;
}

export function MotionViewerWorkspace({ embedded = false }: { embedded?: boolean }) {
  const reduceMotion = useReducedMotion();
  const workspaceRef = useRef<HTMLElement>(null);
  const [sessions, setSessions] = useState<ViewerSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [activeViewer, setActiveViewer] = useState<ViewerKey>("soma");
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [warmKinetic, setWarmKinetic] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(REGISTRY_URL, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session registry unavailable.");
        const value: unknown = await response.json();
        if (!Array.isArray(value)) throw new Error("Session registry is not an array.");
        const registrySessions = value.filter(isViewerSession);
        if (!registrySessions.length) throw new Error("No valid viewer sessions found.");
        const merged = mergeSessions(registrySessions, readSavedSessions());
        setSessions(merged);
        setActiveSessionId((current) => current || merged[0].id);
        setActiveViewer(firstViewer(merged[0]));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const saved = readSavedSessions();
        setSessions(saved);
        setActiveSessionId(saved[0]?.id ?? "");
        if (saved[0]) setActiveViewer(firstViewer(saved[0]));
        setNotice(error instanceof Error ? error.message : "Session registry unavailable.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (embedded) return;
    document.title = "Motion Lab — Cerebel AI";
    return () => {
      document.title = "Cerebel AI — Wearable Motion Intelligence";
    };
  }, [embedded]);

  useEffect(() => {
    document.body.dataset.viewerDrawer = addOpen ? "true" : "false";
    return () => {
      delete document.body.dataset.viewerDrawer;
    };
  }, [addOpen]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  );
  const activeDefinition = activeSession?.viewers[activeViewer];
  const somaDefinition = activeSession?.viewers.soma;
  const kineticDefinition = activeSession?.viewers.kinetic;

  useEffect(() => {
    setWarmKinetic(activeViewer === "kinetic");
    if (!kineticDefinition || !workspaceRef.current) return;

    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean };
    }).connection;
    if (connection?.saveData) return;

    let primeTimer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      primeTimer = window.setTimeout(() => setWarmKinetic(true), coarsePointer ? 1200 : 350);
    }, { rootMargin: "900px 0px" });
    observer.observe(workspaceRef.current);

    return () => {
      observer.disconnect();
      window.clearTimeout(primeTimer);
    };
  }, [activeSession?.id, kineticDefinition]);

  const selectSession = (id: string) => {
    const session = sessions.find((entry) => entry.id === id);
    if (!session) return;
    setActiveSessionId(id);
    setWarmKinetic(activeViewer === "kinetic");
    if (!session.viewers[activeViewer]) setActiveViewer(firstViewer(session));
  };

  const addSessions = (incoming: ViewerSession[]) => {
    const savedIds = new Set(readSavedSessions().map((session) => session.id));
    const nextSaved = mergeSessions(
      readSavedSessions(),
      incoming.filter((session) => !sessions.some((existing) => existing.id === session.id) || savedIds.has(session.id)),
    );
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(nextSaved));
    setSessions((current) => mergeSessions(current, incoming));
    setActiveSessionId(incoming[0].id);
    setActiveViewer(firstViewer(incoming[0]));
    setNotice(`${incoming.length} session${incoming.length === 1 ? "" : "s"} added to this browser.`);
    setAddOpen(false);
  };

  const sessionSelectId = embedded ? "technology-viewer-session" : "viewer-session";

  const workspace = (
        <section ref={workspaceRef} className={`viewer-workspace${embedded ? " viewer-workspace--embedded" : ""}`} aria-label="Motion viewer workspace">
          <div className="viewer-sessionbar">
            <label htmlFor={sessionSelectId}>Session</label>
            <select
              id={sessionSelectId}
              value={activeSession?.id ?? ""}
              onChange={(event) => selectSession(event.target.value)}
              disabled={!sessions.length}
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>{session.label}</option>
              ))}
            </select>
            <dl>
              <div><dt>Frames</dt><dd>{activeSession?.frameCount || "—"}</dd></div>
              <div><dt>Rate</dt><dd>{activeSession?.fps ? `${activeSession.fps} fps` : "—"}</dd></div>
            </dl>
          </div>

          <div className="viewer-switcher" role="tablist" aria-label="Viewer mode">
            {(Object.keys(viewerCopy) as ViewerKey[]).map((key) => {
              const item = viewerCopy[key];
              const available = Boolean(activeSession?.viewers[key]);
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activeViewer === key}
                  aria-controls={`viewer-panel-${key}`}
                  className={activeViewer === key ? "is-active" : ""}
                  disabled={!available}
                  onClick={() => {
                    if (key === "kinetic") setWarmKinetic(true);
                    setActiveViewer(key);
                  }}
                >
                  <span>{item.index}</span>
                  <div><strong>{item.title}</strong></div>
                  <i aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div
            className="viewer-panel"
            id={`viewer-panel-${activeViewer}`}
            role="tabpanel"
            aria-label={viewerCopy[activeViewer].title}
          >
            {!embedded && activeDefinition?.kind === "iframe" ? (
              <header className="viewer-panel__head">
                <strong>{activeSession?.label ?? "Motion viewer"}</strong>
                <a href={activeDefinition.url} target="_blank" rel="noreferrer">
                  Open viewer <ArrowUpRight aria-hidden="true" />
                </a>
              </header>
            ) : null}

            <div className="viewer-mode-stack">
              <div
                className={`viewer-mode-layer${activeViewer === "soma" ? " is-active" : ""}`}
                aria-hidden={activeViewer !== "soma"}
              >
                {somaDefinition?.kind === "mesh-sequence" ? (
                  <SomaSequenceViewer
                    metadataUrl={somaDefinition.metadataUrl}
                    active={activeViewer === "soma"}
                  />
                ) : null}
                {somaDefinition?.kind === "iframe" ? (
                  <ViewerFrame
                    definition={somaDefinition}
                    title={viewerCopy.soma.title}
                    active={activeViewer === "soma"}
                  />
                ) : null}
              </div>
              <div
                className={`viewer-mode-layer${activeViewer === "kinetic" ? " is-active" : ""}`}
                aria-hidden={activeViewer !== "kinetic"}
              >
                {warmKinetic && kineticDefinition ? (
                  <ViewerFrame
                    definition={kineticDefinition}
                    title={viewerCopy.kinetic.title}
                    active={activeViewer === "kinetic"}
                  />
                ) : null}
              </div>
            </div>
            {!activeDefinition ? (
              <div className="viewer-empty">
                <Database aria-hidden="true" />
                <h2>No data connected.</h2>
                <p>Add a manifest or connect a hosted viewer endpoint.</p>
                <button type="button" onClick={() => setAddOpen(true)}>Add session data</button>
              </div>
            ) : null}
          </div>

          <footer className="viewer-workspace__note">
            <p>Qualitative inspection only. Not a benchmark.</p>
          </footer>
        </section>
  );

  const overlays = (
    <>
      <AnimatePresence>
        {addOpen ? (
          <SessionDrawer
            key="session-drawer"
            onClose={() => setAddOpen(false)}
            onAdd={addSessions}
            reduceMotion={Boolean(reduceMotion)}
          />
        ) : null}
      </AnimatePresence>

      <div className="viewer-notice" aria-live="polite">
        {notice ? <><CheckCircle aria-hidden="true" /> {notice}</> : null}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="viewer-embedded">
        {workspace}
        {overlays}
      </div>
    );
  }

  return (
    <div className="viewer-shell">
      <header className="viewer-nav">
        <a className="viewer-nav__brand" href="/" aria-label="Cerebel AI home">
          <img src="/assets/cerebel-wordmark.png" alt="Cerebel" width="595" height="194" />
        </a>
        <div className="viewer-nav__chapter" aria-label="Current chapter">
          <span>PRODUCT WINDOW</span>
          <strong>MOTION LAB / 01</strong>
        </div>
        <a className="viewer-nav__back" href="/">
          <ArrowLeft aria-hidden="true" />
          <span>Back to site</span>
        </a>
      </header>

      <main className="viewer-main">
        <section className="viewer-intro">
          <motion.div
            initial={reduceMotion ? false : { y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="viewer-kicker"><i /> Recovered motion, made inspectable</p>
            <h1>Motion,<br />under inspection.</h1>
          </motion.div>
          <motion.aside
            initial={reduceMotion ? false : { y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.72, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <p>
              Surface motion and joint motion, synchronized to the same action.
            </p>
            <button type="button" onClick={() => setAddOpen(true)}>
              <Plus aria-hidden="true" /> Add session data
            </button>
          </motion.aside>
        </section>

        {workspace}
      </main>

      {overlays}
    </div>
  );
}

function ViewerFrame({
  definition,
  title,
  active,
}: {
  definition: IframeViewerDefinition;
  title: string;
  active: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const isBundledKinetic = definition.url.startsWith("/viewers/kinetic/sessions/");

  useEffect(() => {
    setReady(false);
  }, [definition.url]);

  const handleLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let attempts = 0;
    const inspect = () => {
      attempts += 1;
      try {
        const document = iframe.contentDocument;
        const appShell = document?.querySelector(".app-shell");
        const geometryIsLoading = appShell?.textContent?.includes("Loading body geometry");
        if ((appShell && !geometryIsLoading) || document?.querySelector(".load-screen h1")?.textContent?.includes("could not")) {
          setReady(true);
          return;
        }
      } catch {
        setReady(true);
        return;
      }
      if (attempts < 300) window.setTimeout(inspect, 100);
      else setReady(true);
    };
    inspect();
  };

  return (
    <div className={`viewer-frame${ready ? " is-ready" : " is-warming"}`}>
      {isBundledKinetic && !ready ? <OpenSimPreview viewerUrl={definition.url} /> : null}
      <iframe
        ref={iframeRef}
        key={definition.url}
        src={definition.url}
        title={`${title} interactive viewer`}
        allow="fullscreen"
        allowFullScreen
        loading="eager"
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        tabIndex={active ? 0 : -1}
      />
    </div>
  );
}

function SessionDrawer({
  onClose,
  onAdd,
  reduceMotion,
}: {
  onClose: () => void;
  onAdd: (sessions: ViewerSession[]) => void;
  reduceMotion: boolean;
}) {
  const [label, setLabel] = useState("");
  const [somaUrl, setSomaUrl] = useState("");
  const [kineticUrl, setKineticUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submitConnection = (event: FormEvent) => {
    event.preventDefault();
    const normalizedSoma = somaUrl.trim();
    const normalizedKinetic = kineticUrl.trim();
    if (!label.trim()) {
      setError("Give this session a short name.");
      return;
    }
    if (!normalizedSoma && !normalizedKinetic) {
      setError("Add at least one viewer URL.");
      return;
    }
    if (
      (normalizedSoma && !isSafeUrl(normalizedSoma))
      || (normalizedKinetic && !isSafeUrl(normalizedKinetic))
    ) {
      setError("Viewer URLs must use HTTP or HTTPS.");
      return;
    }

    const id = `connected-${crypto.randomUUID()}`;
    onAdd([
      {
        id,
        label: label.trim(),
        description: "Connected development viewer session.",
        capturedAt: null,
        fps: 0,
        frameCount: 0,
        status: "development",
        source: "User-connected viewer endpoint",
        viewers: {
          ...(normalizedSoma
            ? { soma: { kind: "iframe", url: normalizedSoma } as const }
            : {}),
          ...(normalizedKinetic
            ? { kinetic: { kind: "iframe", url: normalizedKinetic } as const }
            : {}),
        },
      },
    ]);
  };

  const loadManifest = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const value: unknown = JSON.parse(await file.text());
      const candidates = Array.isArray(value) ? value : [value];
      const valid = candidates.filter(isViewerSession);
      if (!valid.length || valid.length !== candidates.length) {
        throw new Error("The manifest does not match the Cerebel viewer session schema.");
      }
      onAdd(valid);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Manifest could not be read.");
    }
  };

  return (
    <motion.div
      className="viewer-drawer__backdrop"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
    >
      <motion.aside
        className="viewer-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewer-drawer-title"
        initial={reduceMotion ? false : { x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      >
        <header>
          <div><span>SESSION INTERFACE</span><h2 id="viewer-drawer-title">Add motion data.</h2></div>
          <button type="button" onClick={onClose} aria-label="Close add session panel" autoFocus>
            <X aria-hidden="true" />
          </button>
        </header>

        <section className="viewer-drawer__manifest">
          <span>Option 01 / Manifest</span>
          <h3>Load a session definition</h3>
          <p>
            Choose a JSON manifest that points to uploaded mesh assets or hosted
            viewer endpoints. The file is read locally and stays in this browser.
          </p>
          <label>
            <UploadSimple aria-hidden="true" />
            Choose manifest
            <input type="file" accept=".json,application/json" onChange={loadManifest} />
          </label>
          <details>
            <summary>Manifest contract</summary>
            <pre>{`{
  "id": "session-id",
  "label": "Session label",
  "description": "Qualitative capture",
  "capturedAt": null,
  "fps": 24,
  "frameCount": 120,
  "status": "development",
  "source": "In-house capture",
  "viewers": {
    "soma": {
      "kind": "mesh-sequence",
      "metadataUrl": "/viewer-data/session/soma-metadata.json"
    },
    "kinetic": { "kind": "iframe", "url": "https://…" }
  }
}`}</pre>
          </details>
        </section>

        <form className="viewer-drawer__connect" onSubmit={submitConnection}>
          <span>Option 02 / Live service</span>
          <h3>Connect viewer endpoints</h3>
          <p>Use this for an already-hosted motion viewer.</p>
          <label>
            Session name
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Development capture 02" />
          </label>
          <label>
            SOMA / Viser URL
            <input value={somaUrl} onChange={(event) => setSomaUrl(event.target.value)} placeholder="https://viewer.example/soma" inputMode="url" />
          </label>
          <label>
            Motion viewer URL
            <input value={kineticUrl} onChange={(event) => setKineticUrl(event.target.value)} placeholder="https://viewer.example/kinetic" inputMode="url" />
          </label>
          <button type="submit">Connect session <ArrowUpRight aria-hidden="true" /></button>
        </form>

        <p className="viewer-drawer__error" aria-live="polite">{error}</p>
      </motion.aside>
    </motion.div>
  );
}
