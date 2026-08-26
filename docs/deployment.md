# Docker deployment

Create a writable local configuration directory. The container runs as the local `UID:GID` from Compose so it can persist a private authentication file in that mount.

```yaml
services:
  landroid-mqtt-bridge:
    image: ghcr.io/tobiaswaelde/landroid-mqtt-bridge:latest
    restart: unless-stopped
    volumes:
      - ./config:/app/config
    ports:
      - "${PORT:-3000}:${PORT:-3000}"
```

Run `docker compose up -d`. Export `UID` and `GID` first on hosts where Compose does not provide those values automatically. The port can be removed when health checks run in the Docker network; Landroid authentication does not need a browser callback. Use a fixed image version in production.
