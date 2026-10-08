# DevBattle_Proyecto_Tec_Web
Plataforma web de retos de programación, en donde desarrolladores de todo el mundo pueden participar en retos de programación y ver quién es el mejor

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend (`apps/web`, :3000) | Next.js 16 + React 19 + Tailwind CSS 4 + TanStack Query |
| Backend (`apps/api`, :3001) | Next.js 16 (route handlers) + tRPC 11 + Zod + superjson |
| Base de datos (`packages/db`) | PostgreSQL 16 (Docker) + Prisma 7 (`@prisma/adapter-pg`) |

Monorepo con pnpm workspaces. El frontend importa **solo el tipo** `AppRouter` del backend
(`@devbattle/api/router`), lo que da tipado end-to-end sin compartir código de servidor.

## Requisitos

- Node.js >= 20.19
- pnpm >= 10
- Docker (para PostgreSQL)

## Puesta en marcha

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Scripts Útiles

| Script | Descripción |
| --- | --- |
| `pnpm dev` / `dev:web` / `dev:api` | Desarrollo |
| `pnpm build` | Genera Prisma y compila ambas apps |
| `pnpm lint` / `pnpm typecheck` | Calidad |
| `pnpm db:up` / `db:down` | Postgres en Docker |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:deploy` | `prisma migrate deploy` (producción) |
| `pnpm db:generate` / `db:seed` / `db:studio` | Cliente, seed, Prisma Studio |

## Estructura

```
apps/
  web/   # Next.js + Tailwind (cliente tRPC con TanStack Query)
  api/   # Next.js + tRPC (src/server/routers, /api/trpc)
packages/
  db/    # schema.prisma, migraciones, seed y cliente Prisma
```

Para agregar un endpoint: crear un router en `apps/api/src/server/routers/` y registrarlo en `_app.ts`.
