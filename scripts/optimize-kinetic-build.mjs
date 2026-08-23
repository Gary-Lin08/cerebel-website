import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const bundlePath = path.resolve("public/viewers/kinetic/assets/index-DYjcaryz.js");
const source = await readFile(bundlePath, "utf8");
const eagerVideo = 'preload:"auto"';
const metadataVideo = 'preload:"metadata"';

if (source.includes(eagerVideo)) {
  await writeFile(bundlePath, source.replaceAll(eagerVideo, metadataVideo));
  console.log("Kinetic Lens video preload changed to metadata.");
} else if (source.includes(metadataVideo)) {
  console.log("Kinetic Lens video preload is already optimized.");
} else {
  throw new Error("Expected Kinetic Lens video preload marker was not found.");
}
