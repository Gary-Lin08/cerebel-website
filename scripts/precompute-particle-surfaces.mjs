import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = path.join(projectRoot, "public", "assets");
const sampleCount = 28_000;

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

async function loadGlb(file) {
  const bytes = await fs.readFile(file);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(arrayBuffer, `${path.dirname(file)}/`, resolve, reject);
  });
}

function sampleSurface(object, extent, seed) {
  object.updateMatrixWorld(true);
  const surfaces = [];
  let totalWeight = 0;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry.getAttribute("position")) return;
    const position = child.geometry.getAttribute("position");
    const weight = Math.max(1, child.geometry.index ? child.geometry.index.count / 3 : position.count / 3);
    surfaces.push({ mesh: child, sampler: new MeshSurfaceSampler(child).build(), weight });
    totalWeight += weight;
  });

  if (!surfaces.length) throw new Error("The GLB does not contain a drawable mesh surface.");

  const random = seededRandom(seed);
  const originalRandom = Math.random;
  Math.random = random;
  const points = new Float32Array(sampleCount * 3);
  const sampled = new THREE.Vector3();
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  try {
    for (let index = 0; index < sampleCount; index += 1) {
      let cursor = random() * totalWeight;
      let selected = surfaces[surfaces.length - 1];
      for (const surface of surfaces) {
        cursor -= surface.weight;
        if (cursor <= 0) {
          selected = surface;
          break;
        }
      }
      selected.sampler.sample(sampled);
      sampled.applyMatrix4(selected.mesh.matrixWorld);
      min.min(sampled);
      max.max(sampled);
      const offset = index * 3;
      points[offset] = sampled.x;
      points[offset + 1] = sampled.y;
      points[offset + 2] = sampled.z;
    }
  } finally {
    Math.random = originalRandom;
  }

  const center = min.clone().add(max).multiplyScalar(0.5);
  const size = max.clone().sub(min);
  const scale = extent / Math.max(size.x, size.y, size.z, 0.0001);
  for (let index = 0; index < sampleCount; index += 1) {
    const offset = index * 3;
    points[offset] = (points[offset] - center.x) * scale;
    points[offset + 1] = (points[offset + 1] - center.y) * scale;
    points[offset + 2] = (points[offset + 2] - center.z) * scale;
  }
  return points;
}

async function writeSurface(source, destination, extent, seed) {
  const gltf = await loadGlb(path.join(assetRoot, source));
  const points = sampleSurface(gltf.scene, extent, seed);
  await fs.writeFile(path.join(assetRoot, destination), Buffer.from(points.buffer));
  console.log(`${destination}: ${sampleCount.toLocaleString()} points`);
}

await writeSurface("cerebel-cerebellum.glb", "cerebel-cerebellum-points.bin", 3.8, 0xce7ebe1);
await writeSurface("cerebel-kinetic-human.glb", "cerebel-kinetic-human-points.bin", 4.55, 0xc0ffee);
