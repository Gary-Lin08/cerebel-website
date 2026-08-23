import { useEffect } from "react";

const SESSION_KEY = "motionverse_session_id";

export interface AttributionContext {
  sessionId: string;
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

export function getAttribution(): AttributionContext {
  const params = new URLSearchParams(window.location.search);
  return {
    sessionId: sessionId(),
    path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer,
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmContent: params.get("utm_content") || "",
    utmTerm: params.get("utm_term") || "",
  };
}

export async function trackEvent(
  eventType: "page_view" | "cta_click" | "form_start",
  details: { target?: string; label?: string } = {},
) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType, ...details, ...getAttribution() }),
      keepalive: true,
    });
  } catch {
    // Analytics must never interrupt the visitor experience.
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

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}
