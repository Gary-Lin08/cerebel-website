import { defineConfig } from "vite";

// Standalone build of the scroll experience, for hosting it on its own (a preview link, a static host).
// Everything resolves relative to the page; links into the main site go to cerebel.tech.
export default defineConfig({
  base: "./",
  publicDir: false,
  define: { "import.meta.env.VITE_SITE_ORIGIN": JSON.stringify("https://cerebel.tech") },
  build: {
    outDir: "dist-experience",
    emptyOutDir: true,
    // Fonts go inline as data URIs, so the page needs no font files of its own.
    assetsInlineLimit: 4_000_000,
    rollupOptions: { input: { index: "experience.html" } },
  },
});
