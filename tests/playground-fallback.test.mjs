import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import middleware, { DOWN_PAGE, config } from "../middleware.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const open = (path = "/playground", init = {}) =>
  new Request(`https://cerebel.tech${path}`, { headers: { accept: "text/html,*/*", "sec-fetch-dest": "document" }, ...init });

function answer(status, body = "upstream") {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(body, { status });
  };
  return calls;
}

test("a working Playground is passed through untouched", async () => {
  const calls = answer(200, "<title>Playground</title>");
  const response = await middleware(open("/playground/app?x=1"));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<title>Playground</title>");
  assert.equal(calls[0].url, "https://cerebel.tech/playground/app?x=1");
  assert.equal(calls[0].options.redirect, "manual");
  // Without this header the project's rule sends the request on to the server, so it can't loop.
  assert.equal(calls[0].options.headers.has("sec-fetch-dest"), false);
});

test("a redirect or a not-found page is the server's own answer", async () => {
  answer(308);
  assert.equal((await middleware(open())).status, 308);
  answer(404);
  assert.equal((await middleware(open("/playground/nope"))).status, 404);
});

test("a 502 or a timeout gets the explanation, never cached", async () => {
  for (const fail of [502, 503, 504]) {
    answer(fail);
    const response = await middleware(open());
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), DOWN_PAGE);
  }
  globalThis.fetch = async () => { throw new DOMException("timed out", "TimeoutError"); };
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
