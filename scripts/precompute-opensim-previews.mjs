import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sessionsRoot = path.resolve("public/viewers/kinetic/sessions");
const sessionIds = await readdir(sessionsRoot);

for (const sessionId of sessionIds) {
  const modelDirectory = path.join(sessionsRoot, sessionId, "assets/model");
  const sourcePath = path.join(modelDirectory, "opensim-motion.json");
  let source;

  try {
    source = JSON.parse(await readFile(sourcePath, "utf8"));
  } catch {
    continue;
  }

  const firstFrame = source.frames?.[0];
  if (!firstFrame?.bodies || !Array.isArray(source.bodyNames)) continue;

  const preview = {
    format: "cerebel-opensim-preview-v1",
    bodyNames: source.bodyNames,
    bodies: firstFrame.bodies,
  };

  const outputPath = path.join(modelDirectory, "opensim-preview.json");
  await writeFile(outputPath, JSON.stringify(preview));
  console.log(`wrote ${path.relative(process.cwd(), outputPath)}`);
}
