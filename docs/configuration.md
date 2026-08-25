# Configuration

All bridges use the same top-level shape:

```yaml
mqtt:
  host: mqtt.example.net
  clientId: landroid-mqtt-bridge
http:
  host: 0.0.0.0
  port: 3000
logging:
  level: log
instances:
  - id: unique-instance-name
    enabled: true
    topic: home/example
    # device-specific fields
```

- `mqtt` configures the single shared broker connection.
- `mqtt.clientId` may be empty; the bridge generates a UUID for the running process.
- `http` controls the health endpoint and, where required, browser OAuth callbacks.
- `logging.level` accepts `error`, `warn`, `log`, `debug`, or `verbose`.
- Every `instances[].id` and `instances[].topic` must be unique.

## Landroid MQTT Bridge example

```yaml
mqtt:
  host: mqtt.example.net
  clientId: landroid-mqtt-bridge
  username: mqtt-user
  password: change-me
http:
  port: 3000
logging:
  level: log
instances:
  - id: garden
    topic: home/landroid/garden
    cloud:
      type: worx
      email: mower-account@example.com
      password: change-me
    mowers:
      - serial: '20213026710100887292'
    updateInterval: 60000
```

Do not commit passwords, API usernames, or generated `*.auth.json` files.
