// Walks the scroll experience and saves a screenshot at each stop.
// Usage: node scripts/experience-shots.mjs [baseUrl] [outDir] [width] [height] [stops...]
import { chromium } from "@playwright/test";
import fs from "node:fs";

const [base = "http://localhost:5173", out = "/tmp/shots", w = "1440", h = "900", ...stops] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector(".xp.is-ready", { timeout: 60000 });
await page.waitForTimeout(1500);
const list = stops.length ? stops.map(Number) : [0, 0.8, 1.6, 2.4, 2.8, 3.4, 4.6, 5.9, 7.0, 8.2, 9.3, 9.9, 10.6, 11.6, 12.4, 13.0, 13.9, 14.8, 15.7, 16.7, 17.6, 18.8, 19.9, 20.6];
for (const u of list) {
  await page.evaluate((v) => window.scrollTo(0, v * window.innerHeight), u);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/u${String(u.toFixed(1)).padStart(4, "0")}.jpg`, quality: 72, type: "jpeg" });
}
console.log(errors.length ? `errors:\n${errors.slice(0, 12).join("\n")}` : "no console errors");
await browser.close();
