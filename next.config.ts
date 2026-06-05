import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native/heavy modules out of the server bundle. Remotion's render
  // toolchain runs in a spawned child process (scripts/render-remotion.mjs), so
  // Next never imports it — these are belt-and-suspenders in case a type import
  // leaks, and keep their native binaries resolving from node_modules.
  serverExternalPackages: [
    "better-sqlite3",
    "@remotion/bundler",
    "@remotion/renderer",
    "esbuild",
  ],
};

export default nextConfig;
