import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import middleware, { DOWN_PAGE, config } from "../middleware.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const ORIGIN = "https://0i5-79nucyondu7h6sp1a-cdhea2bq-custom.service.onethingrobot.com";
const SITE = "https://cerebel.tech";

const open = (path = "/playground", init = {}) =>
  new Request(`${SITE}${path}`, { headers: { accept: "text/html,*/*", "sec-fetch-dest": "document" }, ...init });

function answer(plan) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const href = String(url);
    calls.push({ url: href, options });
    const reply = typeof plan === "function" ? plan(href, options, calls) : plan[calls.length - 1];
    if (reply instanceof Error) throw reply;
    if (typeof reply === "number") return new Response(reply >= 500 ? "upstream" : "ok", { status: reply });
    return reply;
  };
  return calls;
}

test("a working Playground is passed through from the GPU origin", async () => {
  const calls = answer((href) => {
    // Prefer origin; make the same-host candidate slower so Promise.any picks origin.
    if (href.startsWith(SITE)) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(new Response("site", { status: 200 })), 50);
      });
    }
    if (href.includes("/api/health")) return 200;
    return new Response("<title>Playground</title>", { status: 200 });
  });
  const response = await middleware(open("/playground/app?x=1"));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<title>Playground</title>");
  assert.ok(calls.some((c) => c.url === `${ORIGIN}/playground/api/health`));
  assert.ok(calls.some((c) => c.url === `${ORIGIN}/playground/app?x=1`));
  const pageCall = calls.find((c) => c.url === `${ORIGIN}/playground/app?x=1`);
  assert.equal(pageCall.options.redirect, "manual");
  assert.equal(pageCall.options.headers.get("user-agent"), "cerebel-playground-middleware");
  assert.equal(pageCall.options.headers.has("sec-fetch-dest"), false);
});

test("same-host fallback is used when the GPU origin is down", async () => {
  const calls = answer((href) => {
    if (href.startsWith(ORIGIN)) throw new TypeError("origin unreachable");
    if (href.includes("/api/health")) return 200;
    return new Response("<title>via rewrite</title>", { status: 200 });
  });
  const response = await middleware(open("/playground"));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<title>via rewrite</title>");
  assert.ok(calls.some((c) => c.url === `${ORIGIN}/playground/api/health`));
  assert.ok(calls.some((c) => c.url === `${SITE}/playground/api/health`));
  assert.ok(calls.some((c) => c.url === `${SITE}/playground`));
});

test("a redirect or a not-found page is the server's own answer", async () => {
  answer((href) => (href.includes("/api/health") ? 200 : 308));
  assert.equal((await middleware(open())).status, 308);
  answer((href) => (href.includes("/api/health") ? 200 : 404));
  assert.equal((await middleware(open("/playground/nope"))).status, 404);
});

test("a bad health check or a page 502 gets the explanation, never cached", async () => {
  for (const fail of [502, 503, 504]) {
    answer(fail);
    const response = await middleware(open());
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), DOWN_PAGE);
  }
  answer(() => { throw new DOMException("timed out", "TimeoutError"); });
  assert.equal((await middleware(open())).status, 503);

  // Health up but page transfer fails → still the waiting page.
  answer((href) => (href.includes("/api/health") ? 200 : 502));
  assert.equal((await middleware(open())).status, 503);
});

test("anything but a page open is left alone", async () => {
  const calls = answer(502);
  const skipped = [
    open("/playground/api/health", { headers: { accept: "application/json" } }),
    open("/playground/app.js", { headers: { accept: "*/*", "sec-fetch-dest": "script" } }),
    open("/playground", { headers: { accept: "text/html" } }),
    open("/playground/api/upload", { method: "POST" }),
    open("/playground", { method: "HEAD" }),
  ];
  for (const request of skipped) assert.equal(await middleware(request), undefined, request.url);
  assert.equal(calls.length, 0);
});

test("the page promises nothing we can't back, and only /playground is matched", () => {
  assert.doesNotMatch(DOWN_PAGE, /safe|minutes/i);
  assert.deepEqual(config.matcher, ["/playground", "/playground/:path*"]);
});
