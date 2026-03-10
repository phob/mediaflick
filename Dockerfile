FROM oven/bun:1.3.1-alpine AS frontend-deps
WORKDIR /build/frontend-solid

COPY frontend-solid/package.json frontend-solid/bun.lock ./
RUN bun install --frozen-lockfile

FROM frontend-deps AS frontend-build

COPY frontend-solid/ ./
RUN bun run build

FROM oven/bun:1.3.1-alpine AS backend-deps
WORKDIR /build/backend-bun

COPY backend-bun/package.json backend-bun/bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.1-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    FRONTEND_PORT=3867 \
    BACKEND_PORT=5000 \
    BACKEND_BUN_ROOT_DIR=/app/backend-bun \
    BACKEND_BUN_CONFIG_PATH=/app/backend-bun/config/config.yml \
    BACKEND_BUN_LOGS_DIR=/app/backend-bun/logs \
    BACKEND_BUN_DB_PATH=/app/backend-bun/config/plexscan.db

COPY --from=backend-deps /build/backend-bun/node_modules /app/backend-bun/node_modules
COPY backend-bun/tsconfig.json /app/backend-bun/tsconfig.json
COPY backend-bun/src /app/backend-bun/src
COPY backend-bun/config /app/backend-bun/config
RUN mkdir -p /app/backend-bun/logs /app/frontend-solid

COPY docker-entrypoint.sh /usr/local/bin/mediaflick-entrypoint
RUN chmod +x /usr/local/bin/mediaflick-entrypoint

COPY frontend-solid/server.ts /app/frontend-solid/server.ts
COPY --from=frontend-build /build/frontend-solid/dist /app/frontend-solid/dist

EXPOSE 3867 5000

ENTRYPOINT ["/usr/local/bin/mediaflick-entrypoint"]
