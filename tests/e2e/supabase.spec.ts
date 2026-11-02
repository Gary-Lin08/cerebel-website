import { expect, test } from "@playwright/test";

// The real sign-up functions, straight at Supabase: validation answers and that the tables stay closed.
// Nothing here writes a row. Runs everywhere, since the functions do not depend on a deployment.
const base = "https://zmwcglopxlsbewvegoyw.supabase.co";
const apikey = "sb_publishable_S21fJaJ1EVKxDJp6V65oIA_C3zEQFNP";

test.describe("Supabase sign-up functions", () => {
  test("a bad email is refused with the function's own message", async ({ request }) => {
    const backer = await request.post(`${base}/rest/v1/rpc/join_backer_list`, { headers: { apikey }, data: { p: { email: "nope" } } });
    expect(backer.status()).toBe(400);
    expect((await backer.json()).message).toBe("Enter a valid email address.");
    const demo = await request.post(`${base}/rest/v1/rpc/submit_demo_request`, { headers: { apikey }, data: { p: { name: "x", email: "nope", organization: "x", interest: "x", message: "x" } } });
    // Until deploy/supabase-demo-requests.sql has been run, the function does not exist yet.
    test.skip(demo.status() === 404, "submit_demo_request is not created yet: run deploy/supabase-demo-requests.sql");
    expect(demo.status()).toBe(400);
    expect((await demo.json()).message).toBe("Please enter a valid work email.");
    const missing = await request.post(`${base}/rest/v1/rpc/submit_demo_request`, { headers: { apikey }, data: { p: { email: "a@b.co" } } });
    expect(missing.status()).toBe(400);
  });

  test("the lists cannot be read with the publishable key", async ({ request }) => {
    for (const table of ["backers", "demo_requests"]) {
      const response = await request.get(`${base}/rest/v1/${table}?select=*`, { headers: { apikey } });
      expect([401, 403, 404], table).toContain(response.status());
    }
    for (const fn of ["admin_list_backers", "admin_list_demo_requests"]) {
      const response = await request.post(`${base}/rest/v1/rpc/${fn}`, { headers: { apikey }, data: { token: "wrong" } });
      expect([401, 403, 404], fn).toContain(response.status());
    }
  });
});
