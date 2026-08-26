# Troubleshooting

## The bridge stays disconnected

1. Verify the local process first: `curl http://localhost:${PORT:-3000}/health`.
2. Subscribe to the full instance tree: `mosquitto_sub -t '<topic>/#' -v`.
3. Confirm the vendor email, password, selected `cloud.type`, and container network access to the vendor cloud.
4. Confirm every configured serial belongs to that account. A mower outside the explicit allowlist is intentionally ignored.
5. Delete only that instance's private `authFile` if a previously valid vendor session has been revoked, then restart the container.

## MQTT cannot connect

- `mqtt.host` must be only a hostname or IP address; omit `mqtt://`, ports, and paths.
- Set `mqtt.port` explicitly for a non-default or TLS listener.
- Check the broker's client-ID and credential policy. An empty `mqtt.clientId` is valid and creates a process-local UUID.
- Inspect `docker compose logs -f` without publishing tokens, passwords, or full cloud HTTP errors.

## A mower command is ignored

- Publish a JSON object to `<topic>/mowers/<serial>/set/json`, not a retained message.
- Confirm `<topic>/mowers/<serial>/status` contains `{ "online": true }` before sending it.
- The bridge clears a successfully received command topic with an empty payload. Re-publish a valid command if required.
- Commands use string names, for example `{ "cmd": "start" }`, `{ "cmd": "pause" }`, or `{ "cmd": "home" }`. Numeric command codes are intentionally rejected.

## Safe diagnostics

Use the bridge's container logs for connection diagnostics. Never include `config.yml`, `*.auth.json`, cloud sessions, tokens, or passwords in issues or logs.
