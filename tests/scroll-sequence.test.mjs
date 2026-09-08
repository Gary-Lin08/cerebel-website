import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const publicRoot = new URL("../public/", import.meta.url);

test("ships a complete desktop sequence and a stepped mobile sequence", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("media/cerebel-scroll/manifest.json", publicRoot), "utf8"),
  );

  assert.equal(manifest.logicalFrameCount, 520);
  assert.deepEqual(manifest.phaseBoundaries, [1, 121, 261, 361, 520]);
  assert.equal(manifest.desktop.paths.length, 520);
  assert.equal(manifest.mobile.paths.length, 260);
  assert.equal(manifest.mobile.logicalStep, 2);

  await Promise.all([
    access(new URL(`public${manifest.desktop.paths.at(0)}`, root)),
    access(new URL(`public${manifest.desktop.paths.at(-1)}`, root)),
    access(new URL(`public${manifest.mobile.paths.at(0)}`, root)),
    access(new URL(`public${manifest.mobile.paths.at(-1)}`, root)),
  ]);
});
