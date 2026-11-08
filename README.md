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

Con Docker Desktop iniciado y desde la raíz del repositorio, copia el archivo de entorno y levanta todos los servicios:

```bash
cp .env.example .env
docker compose up --build
```

En PowerShell, usa `Copy-Item .env.example .env` en lugar de `cp`. Compose inicia PostgreSQL, ejecuta las migraciones y el seed, y después levanta la API y la web. Abre http://localhost:3000; la API queda disponible en http://localhost:3001.

Para detener los servicios, pulsa `Ctrl+C`; para eliminarlos, ejecuta `docker compose down`. Los datos de PostgreSQL permanecen en un volumen de Docker.

## Autenticación (API)

- Registro: mutation tRPC `auth.register` con `{ name, email, password }`. El nombre admite 2–80 caracteres y la contraseña 8–72. El email se normaliza a minúsculas; se guarda un hash bcrypt, nunca la contraseña.
- Login: Auth.js Credentials en `POST /api/auth/callback/credentials`. Primero solicita el token CSRF con `GET /api/auth/csrf`; envía `csrfToken`, `email`, `password`, `callbackUrl` y `json=true` como formulario, manteniendo `credentials: "include"` para guardar la cookie de sesión.
- Sesión: `GET /api/auth/session` devuelve el usuario autenticado. La mutation `auth.me` de tRPC es privada y responde `UNAUTHORIZED` si no se envía una sesión válida.

Configura `AUTH_SECRET` en `.env` para despliegues; Compose usa un valor de desarrollo local si no está definido.

## Cambiar contraseña por correo

La sección de seguridad del modal de perfil envía un código de un solo uso mediante Resend.
Para habilitarla, configura `RESEND_API_KEY` y `RESEND_FROM_EMAIL` en `.env`. La dirección
remitente debe pertenecer a un dominio verificado en Resend. El correo de destino se obtiene
de la cuenta autenticada; no se acepta desde el navegador.

Los códigos expiran en 10 minutos, se almacenan como HMAC (no en texto plano), aceptan como
máximo cinco intentos y solo puede solicitarse un código por minuto. El cambio de contraseña
se guarda con bcrypt. Después de agregar la tabla, ejecuta las migraciones (`pnpm db:deploy`
o reinicia Docker Compose con la migración incluida).

## Scripts Útiles

| Comando | Descripción |
| --- | --- |
| `docker compose up --build` | Inicia DB, migraciones, API y web |
| `docker compose down` | Detiene y elimina los contenedores |
| `docker compose logs -f web api` | Muestra los logs de la aplicación |
| `docker compose down -v` | También elimina los datos de PostgreSQL |

## Estructura

```
apps/
  web/   # Next.js + Tailwind (cliente tRPC con TanStack Query)
  api/   # Next.js + tRPC (src/server/routers, /api/trpc)
packages/
  db/    # schema.prisma, migraciones, seed y cliente Prisma
```

Para agregar un endpoint: crear un router en `apps/api/src/server/routers/` y registrarlo en `_app.ts`.
