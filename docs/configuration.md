# Configuration

Copy `config/config.example.yml` to `config/config.yml`. The container reads `/app/config/config.yml`; use `CONFIG_FILE` or `--config <path>` only when the file is stored elsewhere.

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

Keep this file private and out of Git. It contains both MQTT and vendor-account passwords.

## Shared settings

| Key | Required | Default | Description |
| --- | --- | --- | --- |
| `mqtt.protocol` | No | `mqtt` | MQTT transport: `mqtt` or `mqtts`. |
| `mqtt.host` | Yes | — | Broker hostname or IP address, without a scheme or path. |
| `mqtt.port` | No | `1883` | Broker port. Set the TLS listener explicitly when using `mqtts`. |
| `mqtt.clientId` | Yes | — | Client ID. An empty string creates a UUID for this process. |
| `mqtt.username` / `mqtt.password` | No | — | Optional broker credentials. |
| `mqtt.keepAliveSeconds` | No | `30` | Positive MQTT keepalive interval. |
| `mqtt.reconnectDelayMs` | No | `5000` | Positive delay between broker reconnect attempts. |
| `http.host` | No | `0.0.0.0` | Health-endpoint bind address. |
| `http.port` | No | `3000` | Health-endpoint port. |
| `logging.level` | No | `log` | One of `error`, `warn`, `log`, `debug`, or `verbose`. |

## Account instances

Every `instances[].id` and `instances[].topic` must be unique. One instance corresponds to one vendor cloud account and can expose several selected mowers.

| Key | Required | Default | Description |
| --- | --- | --- | --- |
| `id` | Yes | — | Instance identifier without slashes or whitespace. |
| `enabled` | No | `true` | Set to `false` to leave an account inactive. |
| `topic` | Yes | — | Root below which this account's MQTT state is published. |
| `cloud.type` | No | `worx` | Vendor cloud: `worx`, `kress`, `landxcape`, or `ferrex`. |
| `cloud.email` / `cloud.password` | Yes | — | Credentials accepted by the selected vendor app. |
| `cloud.loginUrl` | No | vendor default | Override only when the vendor directs the account to another login host. |
| `mowers[].serial` | Yes | — | Exact mower serial number allowed onto the local MQTT broker. |
| `mowers[].enabled` | No | `true` | Set to `false` to keep one configured serial inactive. |
| `updateInterval` | No | `60000` | Positive REST refresh interval in milliseconds. Live cloud MQTT updates are forwarded immediately. |
| `authFile` | No | derived private filename | OAuth-token file, relative to the configuration directory unless absolute. |

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

The generated `*.auth.json` file stores OAuth-token data, but never the YAML password. Do not commit, copy into support requests, or share it with the MQTT broker.
