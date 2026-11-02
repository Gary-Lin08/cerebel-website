// Where sign-ups live. On Vercel this is a private Blob store (BLOB_READ_WRITE_TOKEN, created with
// `vercel blob store add`); on a developer's machine without that token it is a folder of JSON files;
// in tests it is memory. Every record is one JSON document under
//   signups/<list>/<createdAt>-<id>.json
// and each list keeps one pointer per email so a second sign-up never creates a second record:
//   signups/<list>/by-email/<sha256(email)>
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const LISTS = new Set(["backers", "leads"]);

export function emailKey(email) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function recordPath(list, record) {
  return `signups/${list}/${record.createdAt}-${record.id}.json`;
}

function pointerPath(list, email) {
  return `signups/${list}/by-email/${emailKey(email)}`;
}

function byNewest(a, b) {
  return b.createdAt.localeCompare(a.createdAt);
}

/** A store over Vercel Blob. `blob` is the @vercel/blob module, injected so tests can fake it. */
export function createBlobStore(blob) {
  const access = "private";
  const read = async (pathname) => {
    const result = await blob.get(pathname, { access, useCache: false });
    if (!result) return null;
    return JSON.parse(await new Response(result.stream).text());
  };
  const write = (pathname, value) =>
    blob.put(pathname, JSON.stringify(value), {
      access,
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  return {
    kind: "blob",
    async find(list, email) {
      const pointer = await read(pointerPath(list, email));
      return pointer ? read(pointer.pathname) : null;
    },
    async add(list, record) {
      const pathname = recordPath(list, record);
      await write(pathname, record);
      await write(pointerPath(list, record.email), { pathname });
      return record;
    },
    async get(list, id) {
      const { blobs } = await blob.list({ prefix: `signups/${list}/`, access, limit: 1000 });
      const match = blobs.find((entry) => entry.pathname.endsWith(`-${id}.json`));
      return match ? read(match.pathname) : null;
    },
    async update(list, id, patch) {
      const record = await this.get(list, id);
      if (!record) return null;
      const next = { ...record, ...patch, updatedAt: new Date().toISOString() };
      await write(recordPath(list, record), next);
      return next;
    },
    async all(list) {
      const records = [];
      let cursor;
      do {
        const page = await blob.list({ prefix: `signups/${list}/`, access, limit: 1000, cursor });
        for (const entry of page.blobs) {
          if (entry.pathname.includes("/by-email/")) continue;
          const record = await read(entry.pathname);
          if (record) records.push(record);
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return records.sort(byNewest);
    },
  };
}

/** A store in a local folder, for `vercel dev` and manual testing without a Blob token. */
export function createFileStore(root) {
  const file = (pathname) => path.join(root, pathname);
  const read = async (pathname) => {
    try {
      return JSON.parse(await readFile(file(pathname), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  };
  const write = async (pathname, value) => {
    await mkdir(path.dirname(file(pathname)), { recursive: true });
    await writeFile(file(pathname), JSON.stringify(value, null, 2));
  };
  const entries = async (list) => {
    try {
      return (await readdir(file(`signups/${list}`))).filter((name) => name.endsWith(".json"));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  };
  return {
    kind: "file",
    root,
    async find(list, email) {
      const pointer = await read(pointerPath(list, email));
      return pointer ? read(pointer.pathname) : null;
    },
    async add(list, record) {
      await write(recordPath(list, record), record);
      await write(pointerPath(list, record.email), { pathname: recordPath(list, record) });
      return record;
    },
    async get(list, id) {
      const name = (await entries(list)).find((entry) => entry.endsWith(`-${id}.json`));
      return name ? read(`signups/${list}/${name}`) : null;
    },
    async update(list, id, patch) {
      const record = await this.get(list, id);
      if (!record) return null;
      const next = { ...record, ...patch, updatedAt: new Date().toISOString() };
      await write(recordPath(list, record), next);
      return next;
    },
    async all(list) {
      const records = [];
      for (const name of await entries(list)) records.push(await read(`signups/${list}/${name}`));
      return records.filter(Boolean).sort(byNewest);
    },
  };
}

/** A store in memory, for tests. */
export function createMemoryStore() {
  const lists = new Map();
  const bucket = (list) => {
    if (!lists.has(list)) lists.set(list, new Map());
    return lists.get(list);
  };
  return {
    kind: "memory",
    async find(list, email) {
      const key = emailKey(email);
      return [...bucket(list).values()].find((record) => emailKey(record.email) === key) ?? null;
    },
    async add(list, record) {
      bucket(list).set(record.id, record);
      return record;
    },
    async get(list, id) {
      return bucket(list).get(id) ?? null;
    },
    async update(list, id, patch) {
      const record = bucket(list).get(id);
      if (!record) return null;
      const next = { ...record, ...patch, updatedAt: new Date().toISOString() };
      bucket(list).set(id, next);
      return next;
    },
    async all(list) {
      return [...bucket(list).values()].sort(byNewest);
    },
  };
}

let shared;
/** The store this deployment uses, decided once per process from the environment. */
export async function defaultStore() {
  if (shared) return shared;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    shared = createBlobStore(await import("@vercel/blob"));
  } else if (process.env.SIGNUPS_DIR) {
    shared = createFileStore(process.env.SIGNUPS_DIR);
  } else if (process.env.VERCEL_ENV !== "production") {
    shared = createFileStore(path.resolve(process.cwd(), ".signups"));
  } else {
    shared = null; // production with no storage: handlers answer 503 and say so
  }
  return shared;
}

export function resetDefaultStore() {
  shared = undefined;
}
