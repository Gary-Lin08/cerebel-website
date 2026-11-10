import type { Page } from "@playwright/test";

export const live = Boolean(process.env.BASE_URL);

export const BACKER_RPC = "**/rest/v1/rpc/join_backer_list";
export const DEMO_RPC = "**/rest/v1/rpc/submit_demo_request";

/**
 * On the local preview the production endpoints are faked the way the Supabase functions behave:
 * a PostgREST 204 on success and a 400 with `message` when the function raises. Visitor pings to the
 * Playground are swallowed. On a deployment nothing is faked.
 */
export async function fakeApi(page: Page, calls: Array<{ url: string; body: unknown }>) {
  if (live) return;
  const seen = new Set<string>();
  await page.route("**/playground/api/**", (route) => route.fulfill({ status: 204 }));
  await page.route(BACKER_RPC, async (route) => {
    const body = route.request().postDataJSON?.()?.p ?? {};
    calls.push({ url: new URL(route.request().url()).pathname, body });
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return route.fulfill({ status: 400, json: { message: "Enter a valid email address." } });
    seen.add(email);
    return route.fulfill({ status: 204 });
  });
  await page.route(DEMO_RPC, async (route) => {
    const body = route.request().postDataJSON?.()?.p ?? {};
    calls.push({ url: new URL(route.request().url()).pathname, body });
    const required = ["name", "email", "organization", "interest", "message"];
    if (required.some((field) => !String(body[field] ?? "").trim())) {
      return route.fulfill({ status: 400, json: { message: "Name, work email, organization, area of interest, and message are all required." } });
    }
    return route.fulfill({ status: 204 });
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
    if (response.status() >= 400 && !url.includes("/playground") && !url.includes("supabase.co")) failed.push(`${response.status()} ${url}`);
  });
  return { errors, failed };
}

export async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(600);
}
