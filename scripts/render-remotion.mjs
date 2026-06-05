// Standalone Remotion render — runs as a CHILD PROCESS spawned by
// src/server/videoRenderer.ts (never imported by Next). Bundles the composition
// (cached by a content hash of its source surface) and renders it to an mp4,
// streaming progress on stdout as "PROGRESS <0..1>" lines.
//
// Usage: node scripts/render-remotion.mjs <inputProps.json> <out.mp4>

import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const [, , inJson, outPath] = process.argv;
const bundleOnly = inJson === "--bundle-only";
if (!bundleOnly && (!inJson || !outPath)) {
  console.error(
    "usage: render-remotion.mjs <inputProps.json> <out.mp4>  (or --bundle-only)",
  );
  process.exit(2);
}

const root = process.cwd();
const inputProps = bundleOnly ? {} : JSON.parse(readFileSync(inJson, "utf8"));

// ---- bundle cache: re-bundle only when the composition's sources change ----
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    out.push(...(statSync(p).isDirectory() ? walk(p) : [p]));
  }
  return out;
}
function hashSurface() {
  const files = [
    ...walk(path.join(root, "src/remotion")),
    path.join(root, "src/lib/storage.ts"),
    path.join(root, "src/lib/types.ts"),
    path.join(root, "package.json"),
  ].sort();
  const h = createHash("sha1");
  for (const f of files) {
    try {
      h.update(f);
      h.update(readFileSync(f));
    } catch {
      /* ignore unreadable */
    }
  }
  return h.digest("hex");
}

const bundleDir = path.join(root, ".data", "remotion-bundle");
const hashFile = path.join(bundleDir, ".hash");
const hash = hashSurface();

let serveUrl = bundleDir;
const cached =
  existsSync(path.join(bundleDir, "index.html")) &&
  existsSync(hashFile) &&
  readFileSync(hashFile, "utf8").trim() === hash;

if (!cached) {
  serveUrl = await bundle({
    entryPoint: path.join(root, "src", "remotion", "index.ts"),
    outDir: bundleDir,
    // Resolve the "@/..." alias the composition uses.
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...(config.resolve?.alias ?? {}),
          "@": path.join(root, "src"),
        },
      },
    }),
  });
  writeFileSync(hashFile, hash);
}

if (bundleOnly) {
  process.stdout.write(`BUNDLE_OK ${serveUrl}\n`);
  process.exit(0);
}

// Download the headless browser on first run (slow; before frames render).
await ensureBrowser();

const composition = await selectComposition({
  serveUrl,
  id: "storyflow",
  inputProps,
});

await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation: outPath,
  inputProps,
  onProgress: ({ progress }) => process.stdout.write(`PROGRESS ${progress}\n`),
});

process.stdout.write("RENDER_OK\n");
process.exit(0);
