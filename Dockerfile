FROM node:24-bookworm-slim

WORKDIR /workspace

ENV DATABASE_URL=postgresql://devbattle:devbattle@db:5432/devbattle?schema=public
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY . .

RUN corepack enable && corepack pnpm install --frozen-lockfile

EXPOSE 3000 3001

CMD ["corepack", "pnpm", "dev"]