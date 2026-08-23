import fs from "node:fs";
import path from "node:path";

const [, , inputPath, outputPath, startArg, endArg] = process.argv;

if (!inputPath || !outputPath || startArg === undefined || endArg === undefined) {
  console.error(
    "Usage: node scripts/trim-glb-animation.mjs <input.glb> <output.glb> <start-sec> <end-sec>",
  );
  process.exit(1);
}

const startTime = Number(startArg);
const endTime = Number(endArg);

if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || endTime <= startTime) {
  throw new Error("The animation time range is invalid.");
}

const COMPONENT_BYTES = new Map([
  [5120, 1],
  [5121, 1],
  [5122, 2],
  [5123, 2],
  [5125, 4],
  [5126, 4],
]);

const TYPE_COMPONENTS = new Map([
  ["SCALAR", 1],
  ["VEC2", 2],
  ["VEC3", 3],
  ["VEC4", 4],
  ["MAT2", 4],
  ["MAT3", 9],
  ["MAT4", 16],
]);

function readExactly(fileDescriptor, length, position) {
  const buffer = Buffer.allocUnsafe(length);
  let offset = 0;

  while (offset < length) {
    const bytesRead = fs.readSync(
      fileDescriptor,
      buffer,
      offset,
      length - offset,
      position + offset,
    );

    if (bytesRead === 0) {
      throw new Error(`Unexpected end of file at byte ${position + offset}.`);
    }

    offset += bytesRead;
  }

  return buffer;
}

function elementByteLength(accessor) {
  const componentBytes = COMPONENT_BYTES.get(accessor.componentType);
  const componentCount = TYPE_COMPONENTS.get(accessor.type);

  if (!componentBytes || !componentCount) {
    throw new Error(
      `Unsupported accessor layout: componentType=${accessor.componentType}, type=${accessor.type}`,
    );
  }

  return componentBytes * componentCount;
}

function align4(value) {
  return (value + 3) & ~3;
}

const fileDescriptor = fs.openSync(inputPath, "r");

try {
  const header = readExactly(fileDescriptor, 20, 0);
  const magic = header.toString("ascii", 0, 4);
  const version = header.readUInt32LE(4);
  const jsonLength = header.readUInt32LE(12);
  const jsonType = header.toString("ascii", 16, 20);

  if (magic !== "glTF" || version !== 2 || jsonType !== "JSON") {
    throw new Error("Input is not a supported GLB 2.0 file.");
  }

  const jsonBuffer = readExactly(fileDescriptor, jsonLength, 20);
  const gltf = JSON.parse(jsonBuffer.toString("utf8").trim());
  const binHeaderOffset = 20 + jsonLength;
  const binHeader = readExactly(fileDescriptor, 8, binHeaderOffset);
  const binLength = binHeader.readUInt32LE(0);
  const binType = binHeader.toString("ascii", 4, 8);

  if (binType !== "BIN\u0000") {
    throw new Error("GLB does not contain the expected BIN chunk.");
  }

  const binDataOffset = binHeaderOffset + 8;
  const animation = gltf.animations?.[0];

  if (!animation) {
    throw new Error("GLB does not contain an animation.");
  }

  const animationAccessorIds = new Set();
  const inputAccessorIds = new Set();
  const outputAccessorIds = new Set();

  for (const sampler of animation.samplers) {
    animationAccessorIds.add(sampler.input);
    animationAccessorIds.add(sampler.output);
    inputAccessorIds.add(sampler.input);
    outputAccessorIds.add(sampler.output);
  }

  const animationBufferViewIds = new Set(
    [...animationAccessorIds].map((accessorId) => gltf.accessors[accessorId].bufferView),
  );

  for (let accessorId = 0; accessorId < gltf.accessors.length; accessorId += 1) {
    const accessor = gltf.accessors[accessorId];
    if (
      animationBufferViewIds.has(accessor.bufferView) &&
      !animationAccessorIds.has(accessorId)
    ) {
      throw new Error(
        `Animation bufferView ${accessor.bufferView} is shared by non-animation accessor ${accessorId}.`,
      );
    }
  }

  const trimSpecs = new Map();

  for (const inputAccessorId of inputAccessorIds) {
    const accessor = gltf.accessors[inputAccessorId];
    const bufferView = gltf.bufferViews[accessor.bufferView];

    if (accessor.componentType !== 5126 || accessor.type !== "SCALAR") {
      throw new Error(`Animation input accessor ${inputAccessorId} is not FLOAT SCALAR.`);
    }

    const stride = bufferView.byteStride ?? 4;
    const accessorOffset = accessor.byteOffset ?? 0;
    const source = readExactly(
      fileDescriptor,
      accessor.count * stride,
      binDataOffset + bufferView.byteOffset + accessorOffset,
    );

    let firstIndex = 0;
    while (firstIndex < accessor.count && source.readFloatLE(firstIndex * stride) < startTime) {
      firstIndex += 1;
    }

    let lastIndex = accessor.count - 1;
    while (lastIndex >= firstIndex && source.readFloatLE(lastIndex * stride) > endTime) {
      lastIndex -= 1;
    }

    if (firstIndex > lastIndex) {
      throw new Error(
        `Time range ${startTime}-${endTime}s contains no keys in accessor ${inputAccessorId}.`,
      );
    }

    trimSpecs.set(inputAccessorId, {
      firstIndex,
      lastIndex,
      originalCount: accessor.count,
      baseTime: source.readFloatLE(firstIndex * stride),
      finalTime: source.readFloatLE(lastIndex * stride),
      isTime: true,
    });
  }

  for (const sampler of animation.samplers) {
    const inputSpec = trimSpecs.get(sampler.input);
    const outputAccessor = gltf.accessors[sampler.output];
    const inputAccessor = gltf.accessors[sampler.input];
    const multiplier = outputAccessor.count / inputAccessor.count;

    if (!Number.isInteger(multiplier) || multiplier < 1) {
      throw new Error(
        `Animation output accessor ${sampler.output} has an unsupported key ratio.`,
      );
    }

    const existingSpec = trimSpecs.get(sampler.output);
    const nextSpec = {
      firstIndex: inputSpec.firstIndex * multiplier,
      lastIndex: (inputSpec.lastIndex + 1) * multiplier - 1,
      originalCount: outputAccessor.count,
      isTime: false,
    };

    if (
      existingSpec &&
      (existingSpec.firstIndex !== nextSpec.firstIndex ||
        existingSpec.lastIndex !== nextSpec.lastIndex)
    ) {
      throw new Error(`Animation output accessor ${sampler.output} has conflicting ranges.`);
    }

    trimSpecs.set(sampler.output, nextSpec);
  }

  const newBufferViews = [];
  const binaryChunks = [];
  const oldToNewBufferView = new Map();
  let binaryByteLength = 0;

  function appendChunk(data, bufferViewTemplate = {}) {
    const alignedOffset = align4(binaryByteLength);
    if (alignedOffset > binaryByteLength) {
      binaryChunks.push(Buffer.alloc(alignedOffset - binaryByteLength));
      binaryByteLength = alignedOffset;
    }

    const newBufferViewId = newBufferViews.length;
    const { byteOffset: _oldOffset, byteLength: _oldLength, byteStride: _oldStride, ...rest } =
      bufferViewTemplate;

    newBufferViews.push({
      ...rest,
      buffer: 0,
      byteOffset: binaryByteLength,
      byteLength: data.length,
    });
    binaryChunks.push(data);
    binaryByteLength += data.length;
    return newBufferViewId;
  }

  for (let bufferViewId = 0; bufferViewId < gltf.bufferViews.length; bufferViewId += 1) {
    if (animationBufferViewIds.has(bufferViewId)) {
      continue;
    }

    const bufferView = gltf.bufferViews[bufferViewId];
    const data = readExactly(
      fileDescriptor,
      bufferView.byteLength,
      binDataOffset + (bufferView.byteOffset ?? 0),
    );
    oldToNewBufferView.set(bufferViewId, appendChunk(data, bufferView));
  }

  for (let accessorId = 0; accessorId < gltf.accessors.length; accessorId += 1) {
    const accessor = gltf.accessors[accessorId];

    if (!animationAccessorIds.has(accessorId)) {
      if (accessor.bufferView !== undefined) {
        accessor.bufferView = oldToNewBufferView.get(accessor.bufferView);
      }
      continue;
    }

    const spec = trimSpecs.get(accessorId);
    const oldBufferView = gltf.bufferViews[accessor.bufferView];
    const elementLength = elementByteLength(accessor);
    const stride = oldBufferView.byteStride ?? elementLength;
    const accessorOffset = accessor.byteOffset ?? 0;
    const count = spec.lastIndex - spec.firstIndex + 1;
    const source = readExactly(
      fileDescriptor,
      count * stride,
      binDataOffset +
        (oldBufferView.byteOffset ?? 0) +
        accessorOffset +
        spec.firstIndex * stride,
    );
    let data;

    if (stride === elementLength) {
      data = Buffer.from(source);
    } else {
      data = Buffer.allocUnsafe(count * elementLength);
      for (let index = 0; index < count; index += 1) {
        source.copy(
          data,
          index * elementLength,
          index * stride,
          index * stride + elementLength,
        );
      }
    }

    if (spec.isTime) {
      for (let index = 0; index < count; index += 1) {
        data.writeFloatLE(data.readFloatLE(index * 4) - spec.baseTime, index * 4);
      }
      accessor.min = [0];
      accessor.max = [spec.finalTime - spec.baseTime];
    }

    accessor.bufferView = appendChunk(data, oldBufferView);
    accessor.byteOffset = 0;
    accessor.count = count;
  }

  if (gltf.images) {
    for (const image of gltf.images) {
      if (image.bufferView !== undefined) {
        image.bufferView = oldToNewBufferView.get(image.bufferView);
      }
    }
  }

  gltf.bufferViews = newBufferViews;
  gltf.buffers[0].byteLength = align4(binaryByteLength);
  animation.name = `${animation.name ?? "animation"}_${startTime.toFixed(2)}-${endTime.toFixed(2)}s`;

  const outputJson = Buffer.from(JSON.stringify(gltf));
  const paddedJsonLength = align4(outputJson.length);
  const paddedJson = Buffer.alloc(paddedJsonLength, 0x20);
  outputJson.copy(paddedJson);

  const paddedBinLength = align4(binaryByteLength);
  if (paddedBinLength > binaryByteLength) {
    binaryChunks.push(Buffer.alloc(paddedBinLength - binaryByteLength));
  }
  const outputBin = Buffer.concat(binaryChunks, paddedBinLength);
  const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinLength;
  const outputHeader = Buffer.alloc(12);
  outputHeader.write("glTF", 0, 4, "ascii");
  outputHeader.writeUInt32LE(2, 4);
  outputHeader.writeUInt32LE(totalLength, 8);

  const outputJsonHeader = Buffer.alloc(8);
  outputJsonHeader.writeUInt32LE(paddedJsonLength, 0);
  outputJsonHeader.write("JSON", 4, 4, "ascii");

  const outputBinHeader = Buffer.alloc(8);
  outputBinHeader.writeUInt32LE(paddedBinLength, 0);
  outputBinHeader.write("BIN\u0000", 4, 4, "ascii");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    Buffer.concat([
      outputHeader,
      outputJsonHeader,
      paddedJson,
      outputBinHeader,
      outputBin,
    ]),
  );

  console.log(
    JSON.stringify(
      {
        input: inputPath,
        output: outputPath,
        requestedRangeSeconds: [startTime, endTime],
        animationRangeSeconds: [0, Number((endTime - startTime).toFixed(3))],
        originalBinBytes: binLength,
        outputBytes: totalLength,
      },
      null,
      2,
    ),
  );
} finally {
  fs.closeSync(fileDescriptor);
}
