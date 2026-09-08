#!/usr/bin/env node
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(root, "assets", "raw", "cerebel-scroll");
const outputRoot = path.join(root, "public", "media", "cerebel-scroll");
const desktopDirectory = path.join(outputRoot, "desktop");
const mobileDirectory = path.join(outputRoot, "mobile");
const logicalFrameCount = 520;
const desktopWidth = 1600;
const desktopHeight = 900;
const mobileWidth = 960;
const mobileHeight = 540;

const expectedNames = Array.from(
  { length: logicalFrameCount },
  (_, index) => `frame_${String(index + 1).padStart(4, "0")}.webp`,
);

const sourceNames = new Set(await readdir(sourceDirectory));
const missing = expectedNames.filter((name) => !sourceNames.has(name));
if (missing.length) {
  throw new Error(`Missing ${missing.length} source frame(s): ${missing.slice(0, 8).join(", ")}`);
}

await rm(outputRoot, { recursive: true, force: true });
await Promise.all([
  mkdir(desktopDirectory, { recursive: true }),
  mkdir(mobileDirectory, { recursive: true }),
]);

const desktopPaths = [];
const mobilePaths = [];
const concurrency = Math.max(2, Math.min(8, Number(process.env.CEREBEL_ASSET_WORKERS) || 6));
let cursor = 0;

async function worker() {
  while (cursor < expectedNames.length) {
    const index = cursor;
    cursor += 1;
    const name = expectedNames[index];
    const input = path.join(sourceDirectory, name);
    const desktopOutput = path.join(desktopDirectory, name);

    await sharp(input)
      .resize(desktopWidth, desktopHeight, { fit: "fill", withoutEnlargement: true })
      .webp({ quality: 83, effort: 4 })
      .toFile(desktopOutput);

    desktopPaths[index] = `/media/cerebel-scroll/desktop/${name}`;

    if (index % 2 === 0) {
      const mobileOutput = path.join(mobileDirectory, name);
      await sharp(input)
        .resize(mobileWidth, mobileHeight, { fit: "fill", withoutEnlargement: true })
        .webp({ quality: 74, effort: 4 })
        .toFile(mobileOutput);
      mobilePaths.push(`/media/cerebel-scroll/mobile/${name}`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

async function directoryBytes(directory) {
  const names = await readdir(directory);
  const sizes = await Promise.all(names.map(async (name) => (await stat(path.join(directory, name))).size));
  return sizes.reduce((sum, value) => sum + value, 0);
}

const [desktopBytes, mobileBytes] = await Promise.all([
  directoryBytes(desktopDirectory),
  directoryBytes(mobileDirectory),
]);

const manifest = {
  format: "cerebel-scroll-sequence-v1",
  logicalFrameCount,
  posterFrame: 1,
  reducedMotionFrame: 360,
  phaseBoundaries: [1, 121, 261, 361, 520],
  desktop: {
    width: desktopWidth,
    height: desktopHeight,
    paths: desktopPaths,
    totalBytes: desktopBytes,
  },
  mobile: {
    width: mobileWidth,
    height: mobileHeight,
    logicalStep: 2,
    paths: mobilePaths,
    totalBytes: mobileBytes,
  },
};

await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  logicalFrames: logicalFrameCount,
  desktopFrames: desktopPaths.length,
  mobileFrames: mobilePaths.length,
  desktopBytes,
  mobileBytes,
}, null, 2));
