![GitHub License](https://img.shields.io/github/license/phob/mediaflick)

# MediaFlick

![MediaFlick screenshot](mediaflick1.jpg)

## Description

MediaFlick scans media libraries, matches titles with TMDb metadata, and organizes files based on your configured folder mappings.

## Docker (single container)

The current setup runs `frontend-solid` and `backend-bun` inside one container.

- Only the frontend port is exposed: `3867`
- Backend listens on `5000` internally and is not published
- Frontend proxies `/api/*` and `/ws/*` to the internal backend

### Quick start

From repo root:

```bash
mkdir -p /opt/mediaflick/config /opt/mediaflick/logs
cp -n backend-bun/config/config.yml /opt/mediaflick/config/config.yml
docker compose up -d --build
```

Open `http://localhost:3867`.

### Compose mounts used by default

- `/opt/mediaflick/config:/app/backend-bun/config`
- `/opt/mediaflick/logs:/app/backend-bun/logs`
- `/mnt/zurg:/mnt/zurg:rshared`
- `/mnt/organized:/mnt/organized`
- `/mnt/organized2:/mnt/organized2`

If your media paths are different, update `docker-compose.yml` and `config.yml` accordingly.

### Build image manually

```bash
docker build -t mediaflick:latest .

docker run -d \
  --name mediaflick \
  -p 3867:3867 \
  -v /opt/mediaflick/config:/app/backend-bun/config \
  -v /opt/mediaflick/logs:/app/backend-bun/logs \
  -v /mnt/zurg:/mnt/zurg:rshared \
  -v /mnt/organized:/mnt/organized \
  -v /mnt/organized2:/mnt/organized2 \
  mediaflick:latest
```

## Local development (Bun)

### Backend

```bash
cd backend-bun
bun install
bun run dev
```

### Frontend

```bash
cd frontend-solid
bun install
bun run dev
```

Default dev ports:

- frontend: `5173` (Vite dev)
- backend: `5000`

## Configuration

Primary runtime config is in `backend-bun/config/config.yml`.

When running with Docker bind mounts, edit:

- `/opt/mediaflick/config/config.yml`

Make sure `folderMappings` match your mounted media paths and set your TMDb API key there.
