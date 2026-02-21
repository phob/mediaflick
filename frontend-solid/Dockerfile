FROM oven/bun:1.3.1-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.3.1-alpine AS runtime
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/package.json ./package.json

ENV PORT=3867 \
    BACKEND_HTTP_ORIGIN=http://backend:5000 \
    BACKEND_WS_ORIGIN=ws://backend:5000

EXPOSE 3867

CMD ["bun", "run", "start"]
