import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "../worker/index.js";

function createD1() {
  const sqlite = new DatabaseSync(":memory:");
  const migration = readFileSync(
    new URL("../drizzle/0000_panoramic_mockingbird.sql", import.meta.url),
    "utf8",
  ).replaceAll("--> statement-breakpoint", "");
  sqlite.exec(migration);

  const prepare = (sql) => ({
    bind: (...values) => {
      const statement = sqlite.prepare(sql);
      return {
        run: async () => {
          const result = statement.run(...values);
          return { meta: { changes: Number(result.changes) } };
        },
        all: async () => ({ results: statement.all(...values) }),
        first: async () => statement.get(...values) || null,
      };
    },
    run: async () => {
      const result = sqlite.prepare(sql).run();
      return { meta: { changes: Number(result.changes) } };
    },
    all: async () => ({ results: sqlite.prepare(sql).all() }),
    first: async () => sqlite.prepare(sql).get() || null,
  });

  return {
    prepare,
    batch: async (statements) => Promise.all(statements.map((statement) => statement.run())),
  };
}

function request(path, init = {}, cf = {}) {
  const result = new Request(`https://motionverse.test${path}`, init);
  Object.defineProperty(result, "cf", {
    value: {
      country: "CN",
      region: "Shanghai",
      city: "Shanghai",
      timezone: "Asia/Shanghai",
      ...cf,
    },
  });
  return result;
}

const attribution = {
  sessionId: "session-test",
  path: "/?utm_source=linkedin",
  referrer: "https://linkedin.com/",
  utmSource: "linkedin",
  utmMedium: "social",
  utmCampaign: "robotics",
};

test("captures analytics and lead records with raw IP", async () => {
  const DB = createD1();
  const headers = {
    "content-type": "application/json",
    "cf-connecting-ip": "203.0.113.42",
    origin: "https://motionverse.test",
    "user-agent": "Mozilla/5.0 Chrome/140 Mobile",
  };

  const eventResponse = await worker.fetch(
    request("/api/events", {
      method: "POST",
      headers,
      body: JSON.stringify({ eventType: "page_view", ...attribution }),
    }),
    { DB },
  );
  assert.equal(eventResponse.status, 201);

  const leadResponse = await worker.fetch(
    request("/api/leads", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Test Lead",
        email: "lead@example.com",
        organization: "Example Robotics",
        interest: "Robotics",
        message: "We want to evaluate the platform.",
        ...attribution,
      }),
    }),
    { DB },
  );
  assert.equal(leadResponse.status, 201);

  const leads = await DB.prepare("SELECT * FROM leads").all();
  assert.equal(leads.results.length, 1);
  assert.equal(leads.results[0].ip_address, "203.0.113.42");
  assert.equal(leads.results[0].ip_masked, "203.***.***.42");
  assert.equal(leads.results[0].country, "CN");
  assert.equal(leads.results[0].utm_source, "linkedin");

  const events = await DB.prepare("SELECT * FROM events ORDER BY created_at").all();
  assert.equal(events.results.length, 2);
  assert.deepEqual(events.results.map((row) => row.event_type), ["page_view", "form_submit"]);
});

test("protects admin data and supports lead management", async () => {
  const DB = createD1();
  const unauthorized = await worker.fetch(request("/api/admin/summary"), { DB });
  assert.equal(unauthorized.status, 401);

  const authHeaders = { "oai-authenticated-user-email": "lin@motionverse.ai" };
  const summary = await worker.fetch(request("/api/admin/summary", { headers: authHeaders }), { DB });
  assert.equal(summary.status, 200);

  const wrongAccount = await worker.fetch(
    request("/api/admin/leads", {
      headers: { "oai-authenticated-user-email": "other@example.com" },
    }),
    { DB },
  );
  assert.equal(wrongAccount.status, 403);
});
