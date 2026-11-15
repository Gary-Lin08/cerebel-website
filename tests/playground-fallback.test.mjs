import assert from "node:assert/strict";
import { test } from "node:test";
import middleware, { DOWN_PAGE, config } from "../middleware.js";

const SITE = "https://cerebel.tech";

const open = (path = "/playground", init = {}) =>
  new Request(`${SITE}${path}`, {
    headers: { accept: "text/html,*/*", "sec-fetch-dest": "document" },
    ...init,
  });

test("middleware never blocks Playground traffic (vercel.json rewrites)", async () => {
  assert.equal(await middleware(open("/playground")), undefined);
  assert.equal(
    await middleware(open("/playground/api/health", { headers: { accept: "application/json" } })),
    undefined,
  );
  assert.equal(
    await middleware(open("/playground/app.js", { headers: { accept: "*/*", "sec-fetch-dest": "script" } })),
    undefined,
  );
});

test("offline copy is retained for a future gate, and only /playground is matched", () => {
  assert.doesNotMatch(DOWN_PAGE, /safe|minutes/i);
  assert.match(DOWN_PAGE, /Playground is offline/);
  assert.deepEqual(config.matcher, ["/playground", "/playground/:path*"]);
});
