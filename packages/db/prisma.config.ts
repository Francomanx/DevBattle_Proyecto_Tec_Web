import path from "node:path";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma 7 ya no carga .env automáticamente: usamos el .env de la raíz del monorepo.
config({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
