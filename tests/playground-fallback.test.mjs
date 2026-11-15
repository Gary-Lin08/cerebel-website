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

test("a healthy Playground falls through to the vercel.json rewrite", async () => {
  const calls = answer((href) => {
    if (href.startsWith(SITE)) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(new Response("site", { status: 200 })), 50);
      });
    }
    assert.match(href, /\/api\/health$/);
    return 200;
  });
  assert.equal(await middleware(open("/playground/app?x=1")), undefined);
  assert.ok(calls.some((c) => c.url === `${ORIGIN}/playground/api/health`));
  assert.equal(calls.every((c) => c.url.endsWith("/playground/api/health")), true);
  assert.equal(calls[0].options.headers.get("user-agent"), "cerebel-playground-middleware");
  assert.equal(calls[0].options.headers.has("sec-fetch-dest"), false);
});

test("same-host health fallback works when the GPU origin is down", async () => {
  const calls = answer((href) => {
    if (href.startsWith(ORIGIN)) throw new TypeError("origin unreachable");
    return 200;
  });
  assert.equal(await middleware(open("/playground")), undefined);
  assert.ok(calls.some((c) => c.url === `${ORIGIN}/playground/api/health`));
  assert.ok(calls.some((c) => c.url === `${SITE}/playground/api/health`));
});

test("a bad health check gets the explanation, never cached", async () => {
  for (const fail of [502, 503, 504]) {
    answer(fail);
    const response = await middleware(open());
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), DOWN_PAGE);
  }
  answer(() => { throw new DOMException("timed out", "TimeoutError"); });
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
