import { expect, test } from "@playwright/test";
import { live } from "./helpers";

// The real functions, only on a deployment. Locally `vite preview` has no API, so this is skipped.
test.describe("sign-up API", () => {
  test.skip(!live, "needs a deployment");

  test("backers: validation, storage state, dedupe", async ({ request, baseURL }) => {
    const bad = await request.post("/api/backers", { data: { email: "nope" }, headers: { origin: baseURL! } });
    expect(bad.status()).toBe(400);
    const email = `qa+api-${Date.now()}@cerebel.tech`;
    const first = await request.post("/api/backers", { data: { email, name: "API check", use: "Research" }, headers: { origin: baseURL! } });
    expect([201, 503]).toContain(first.status());
    if (first.status() === 503) {
      expect((await first.json()).error).toContain("hello@cerebel.tech");
      return; // storage not provisioned yet; the UI tells people the same thing
    }
    const again = await request.post("/api/backers", { data: { email }, headers: { origin: baseURL! } });
    expect(again.status()).toBe(200);
    expect((await again.json()).status).toBe("already");
  });

  test("cross-origin posts are refused and events are dropped", async ({ request }) => {
    const foreign = await request.post("/api/backers", { data: { email: "a@b.co" }, headers: { origin: "https://evil.example" } });
    expect(foreign.status()).toBe(403);
    const event = await request.post("/api/events", { data: { eventType: "page_view" } });
    expect(event.status()).toBe(204);
    const method = await request.get("/api/leads");
    expect(method.status()).toBe(405);
  });

  test("admin routes are closed without the token", async ({ request }) => {
    for (const path of ["/api/admin/summary", "/api/admin/leads", "/api/admin/export?list=backers", "/api/admin/leads/export.csv"]) {
      const response = await request.get(path);
      expect([401, 503], path).toContain(response.status());
    }
  });
});
