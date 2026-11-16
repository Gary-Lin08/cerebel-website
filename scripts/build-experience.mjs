// Builds the experience as a self-contained folder: the page, its code and only the files it loads.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "dist-experience");
execSync("npx vite build --config vite.experience.config.mjs", { cwd: root, stdio: "inherit" });
const html = fs.readFileSync(path.join(out, "experience.html"), "utf8")
  .replace('href="/assets/favicon.png"', 'href="./assets/favicon.png"')
  .replace(", viewport-fit=cover", "");
fs.writeFileSync(path.join(out, "index.html"), html);
fs.rmSync(path.join(out, "experience.html"));
const files = [
  "assets/cerebel-cerebellum-points.bin",
  "assets/cerebel-kinetic-human-points.bin",
  "assets/cerebel-wordmark.png",
  "assets/favicon.png",
  "assets/nvidia-inception-program-badge.svg",
  "assets/affiliations/usc-marshall-white.svg",
  "assets/founders/founder-team-sm.jpg",
  "viewer-data/golf-1872/swing-analysis.json",
  "viewer-data/golf-1872/swing-mesh.bin",
  "viewer-data/golf-1872/soma-faces.bin",
  "viewer-data/golf-1872/opensim/rajagopal-bones.glb",
  "viewer-data/golf-1872/opensim/rajagopal-bones-grip.glb",
];
for (const f of files) {
  const from = path.join(root, "public", f);
  const binary = /\.(bin|glb)$/.test(f);
  const to = path.join(out, binary ? `${f}.json` : f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  // Binary files travel as a base64 JSON string; `loadBinary` in src/experience/paths.ts unwraps them.
  if (binary) fs.writeFileSync(to, JSON.stringify(fs.readFileSync(from).toString("base64")));
  else fs.copyFileSync(from, to);
}
console.log(`Standalone experience in ${path.relative(root, out)}/`);
