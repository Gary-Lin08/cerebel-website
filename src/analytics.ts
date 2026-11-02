import { useEffect } from "react";

const SESSION_KEY = "motionverse_session_id";
// The same random browser ID the Playground uses, so one visitor counts once across both.
const VISITOR_KEY = "cerebel_visitor_v1";
// Reached through the project's /playground proxy. If that server is down, nothing here may bother the visitor.
const endpoint = (import.meta.env.VITE_EVENTS_ENDPOINT ?? "/playground/api/site/ping").trim();
const HEARTBEAT_MS = 30_000;
const MAX_FAILURES = 3;

export interface AttributionContext {
  sessionId: string;
  visitor: string;
  path: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}

function sessionId() {
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

function visitorId() {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return sessionId();
  }
}

export function getAttribution(): AttributionContext {
  const params = new URLSearchParams(window.location.search);
  return {
    sessionId: sessionId(),
    visitor: visitorId(),
    path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer,
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmContent: params.get("utm_content") || "",
    utmTerm: params.get("utm_term") || "",
  };
}

let failures = 0;

export async function trackEvent(
  eventType: "page_view" | "cta_click" | "form_start" | "heartbeat",
  details: { target?: string; label?: string } = {},
) {
  if (failures >= MAX_FAILURES) return;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType,
        site: "main",
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        ...details,
        ...getAttribution(),
      }),
      keepalive: true,
    });
    failures = response.ok ? 0 : failures + 1;
  } catch {
    // Analytics must never interrupt the visitor experience.
    failures += 1;
  }
}

export function useAnalytics() {
  useEffect(() => {
    void trackEvent("page_view");

    const onClick = (event: MouseEvent) => {
      const element = (event.target as HTMLElement).closest<HTMLElement>("a, button");
      if (!element || element.closest(".demo-form")) return;
      const target =
        element instanceof HTMLAnchorElement
          ? element.getAttribute("href") || ""
          : element.getAttribute("data-analytics-target") || element.id;
      const label = element.textContent?.replace(/\s+/g, " ").trim().slice(0, 160) || "";
      void trackEvent("cta_click", { target, label });
    };

    const beat = () => {
      if (document.visibilityState === "visible") void trackEvent("heartbeat");
    };
    const timer = window.setInterval(beat, HEARTBEAT_MS);

    document.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
}
