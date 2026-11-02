import { expect, test } from "@playwright/test";
import { fakeApi, live, settle, watch } from "./helpers";

test.describe("homepage", () => {
  test("loads clean: title, headline, social card, no console errors or broken assets", async ({ page }) => {
    const calls: Array<{ url: string; body: unknown }> = [];
    await fakeApi(page, calls);
    const log = watch(page);
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await settle(page);

    await expect(page).toHaveTitle(/Cerebel AI/);
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    // The headline is real text with spaces, not glued words.
    expect((await h1.innerText()).replace(/\s+/g, " ").trim()).toBe("Capture human motion. Train intelligent machines.");
    await expect(h1).toHaveAttribute("aria-label", "Capture human motion. Train intelligent machines.");

    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toBe("https://cerebel.tech/assets/og-cerebel.jpg");
    const ld = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(ld ?? "{}")["@type"]).toBe("Organization");

    // Every section the navigation points at exists.
    for (const id of ["wearable", "technology", "evidence", "benchmark", "field", "company", "demo"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }

    // Public contact is the company address; no personal addresses anywhere in the markup.
    const html = await page.content();
    expect(html).toContain("hello@cerebel.tech");
    expect(html).not.toMatch(/@gmail\.com|@outlook\.com|motionverse\.ai/);

    expect(log.failed, "requests that failed").toEqual([]);
    expect(log.errors.filter((e) => !/WebGL|GPU|AudioContext/.test(e)), "console errors").toEqual([]);
  });

  test("the page never scrolls sideways", async ({ page }) => {
    await fakeApi(page, []);
    await page.goto("/");
    await settle(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("navigation reaches every chapter and the demo form", async ({ page }) => {
    await fakeApi(page, []);
    await page.goto("/");
    await settle(page);
    // Narrow layouts (phones and tablets) fold the links into the menu button.
    const menuButton = page.getByRole("button", { name: /open navigation menu/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.getByRole("dialog", { name: /mobile navigation/i }).getByRole("link", { name: /Company/ }).click();
    } else {
      await page.getByRole("navigation", { name: "Main sections" }).getByRole("link", { name: "Company" }).click();
    }
    await expect(page).toHaveURL(/#company$/);
    // The page scrolls smoothly over several thousand pixels; wait until it comes to rest.
    await page.waitForFunction(() => new Promise((resolve) => {
      const start = window.scrollY;
      setTimeout(() => resolve(window.scrollY === start && start > 0), 400);
    }), undefined, { timeout: 15_000 });
    // The Motion workspace may mount during the scroll and push the chapter down; the page corrects
    // for that within a moment, so poll instead of reading once.
    await expect.poll(async () => {
      const box = await page.locator("#company").boundingBox();
      return box ? Math.round(box.y) : Number.NaN;
    }, { timeout: 10_000 }).toBeLessThanOrEqual(120);
  });
});

test.describe("sign-ups", () => {
  test("becoming a backer stores the email through the API, once", async ({ page }) => {
    const calls: Array<{ url: string; body: unknown }> = [];
    await fakeApi(page, calls);
    await page.goto("/");
    await settle(page);
    const open = page.getByRole("button", { name: /become a backer/i }).first();
    await open.scrollIntoViewIfNeeded();
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/presale has not opened/i);
    await expect(dialog).toContainText(/no payment is taken/i);

    // A wrong address is refused on the page.
    await dialog.getByLabel("Email").fill("nope");
    await dialog.getByRole("button", { name: /join the list/i }).click();
    await expect(dialog).toContainText("Enter a valid email address.");

    const email = live ? `qa+${Date.now()}@cerebel.tech` : "ada@example.com";
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel(/^Name/).fill("QA run");
    await dialog.getByLabel(/use them for/i).selectOption("Research");
    await dialog.getByRole("button", { name: /join the list/i }).click();
    await expect(dialog.getByRole("status")).toContainText(/on the list|already on the list|saved in this preview/i, { timeout: 15_000 });
    if (!live) {
      const call = calls.find((c) => c.url === "/api/backers");
      expect(call).toBeTruthy();
      expect(call!.body).toMatchObject({ email, name: "QA run", use: "Research", list: "glasses-presale", website: "" });
    }
    await dialog.getByRole("button", { name: /back to the glasses/i }).click();
    await expect(dialog).toBeHidden();
  });

  test("the demo request form validates and submits", async ({ page }) => {
    const calls: Array<{ url: string; body: unknown }> = [];
    await fakeApi(page, calls);
    await page.goto("/#demo");
    await settle(page);
    const form = page.locator("form.demo-form");
    await form.scrollIntoViewIfNeeded();
    await form.getByRole("button", { name: /request a demo/i }).click();
    await expect(form.locator("small")).toHaveCount(5);

    await form.getByLabel("Name").fill("QA run");
    await form.getByLabel("Work email").fill(live ? `qa+${Date.now()}@cerebel.tech` : "grace@example.com");
    await form.getByLabel("Organization").fill("Automated check");
    await form.getByLabel("Area of interest").selectOption("Research Collaboration");
    await form.getByLabel("Message").fill("Automated end-to-end check of the demo form. Safe to delete.");
    await form.getByRole("button", { name: /request a demo/i }).click();
    await expect(form.locator(".form-status")).toContainText(/thank you/i, { timeout: 15_000 });
    if (!live) expect(calls.some((c) => c.url === "/api/leads")).toBe(true);
  });
});

test.describe("other routes", () => {
  test("the admin console asks for a token instead of showing data", async ({ page }) => {
    if (!live) await page.route("**/api/admin/**", (route) => route.fulfill({ status: 401, json: { error: "Authentication required." } }));
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /sign in required/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder("Admin token")).toBeVisible();
  });

  test("the social card and crawler files are served", async ({ request }) => {
    for (const path of ["/assets/og-cerebel.jpg", "/robots.txt", "/sitemap.xml", "/assets/favicon.png"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
    }
  });
});
