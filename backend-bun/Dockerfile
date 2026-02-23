FROM oven/bun:1.3.1-alpine
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src
COPY config ./config
RUN mkdir -p logs

ENV NODE_ENV=production \
    PORT=5000 \
    BACKEND_BUN_ROOT_DIR=/app \
    BACKEND_BUN_CONFIG_PATH=/app/config/config.yml \
    BACKEND_BUN_LOGS_DIR=/app/logs \
    BACKEND_BUN_DB_PATH=/app/config/plexscan.db

EXPOSE 5000

CMD ["bun", "run", "start"]
