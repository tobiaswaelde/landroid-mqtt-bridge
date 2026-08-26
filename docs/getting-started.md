# Getting started

1. Copy `config/config.example.yml` to the ignored `config/config.yml`.
2. Configure one MQTT broker and one `instances[]` entry for each vendor account.
3. Add only the mower serial numbers that this broker may expose.
4. Start the service with `docker compose up -d`.
5. Subscribe to `<instance.topic>/#` and wait for `<instance.topic>/connected` to become `true`.

The container exposes `GET /health` on the configured HTTP port. It only needs a host port mapping when a host-side health probe needs it; Landroid authentication happens directly between the bridge and the vendor cloud.
