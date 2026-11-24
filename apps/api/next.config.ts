import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Carga el .env de la raíz del monorepo 
loadEnvConfig(
  path.resolve(process.cwd(), "../.."),
  process.env.NODE_ENV !== "production",
  console,
  true,
);

function parseAllowedDevOrigins(origins?: string): string[] {
  if (!origins) return [];
  return origins
    .split(",")
    .map((origin) =>
      origin
        .trim()
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        .split(":")[0],
    )
    .filter(Boolean);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    ...parseAllowedDevOrigins(process.env.ALLOWED_DEV_ORIGINS),
  ],
  transpilePackages: ["@devbattle/db"],
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
