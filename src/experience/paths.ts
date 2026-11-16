// Where the experience finds its files and the rest of the site. A normal build serves both from the
// same origin, so these are plain absolute paths. The standalone build (`npm run build:experience`)
// is hosted on its own: files are relative to the page, binary files are shipped wrapped as base64 JSON
// (some static hosts refuse .bin and .glb), and site links point at cerebel.tech.
const base = import.meta.env.BASE_URL;
const site = (import.meta.env.VITE_SITE_ORIGIN as string | undefined) ?? "";
const standalone = base !== "/";

/** A file the experience ships with, given as its path under public/ (for example "/assets/x.png"). */
export const asset = (path: string) => (standalone ? base + path.replace(/^\//, "") : path);
/** A page of the main site, such as "/playground". */
export const page = (path: string) => site + path;

/** Fetch a binary file (.bin, .glb) as bytes, from wherever this build keeps it. */
export async function loadBinary(path: string): Promise<ArrayBuffer> {
  if (!standalone) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.arrayBuffer();
  }
  const response = await fetch(`${asset(path)}.json`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  const text: string = await response.json();
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}
