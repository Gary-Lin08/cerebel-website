import type { Page } from "@playwright/test";

export const live = Boolean(process.env.BASE_URL);

/** On the local preview there is no API; answer like api/_lib/handlers.js so the UI flows can be checked. */
export async function fakeApi(page: Page, calls: Array<{ url: string; body: unknown }>) {
  if (live) return;
  const seen = new Set<string>();
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postDataJSON?.() ?? null;
    calls.push({ url: url.pathname, body });
    if (url.pathname === "/api/events") return route.fulfill({ status: 204 });
    if (url.pathname === "/api/backers" && request.method() === "POST") {
      const email = String(body?.email ?? "").toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return route.fulfill({ status: 400, json: { error: "Enter a valid email address." } });
      const status = seen.has(email) ? "already" : "listed";
      seen.add(email);
      return route.fulfill({ status: status === "listed" ? 201 : 200, json: { ok: true, status } });
    }
    if (url.pathname === "/api/leads" && request.method() === "POST") {
      const required = ["name", "email", "organization", "interest", "message"];
      if (required.some((field) => !String(body?.[field] ?? "").trim())) return route.fulfill({ status: 400, json: { error: "Every field is required." } });
      return route.fulfill({ status: 201, json: { ok: true, status: "received" } });
    }
    return route.fulfill({ status: 404, json: { error: "Not found." } });
  });
}

/** Console errors and failed requests, excluding what the page cannot control. */
export function watch(page: Page) {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400 && !url.includes("/api/") && !url.includes("/playground")) failed.push(`${response.status()} ${url}`);
  });
  return { errors, failed };
}

export async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(600);
}
