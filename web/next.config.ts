import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lock turbopack's root to this folder; the repo root has a lockfile from the
  // Discord bot which would otherwise be picked up by mistake.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
