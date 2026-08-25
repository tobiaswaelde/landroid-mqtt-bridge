# Landroid MQTT Bridge

[![CI](https://github.com/tobiaswaelde/landroid-mqtt-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/tobiaswaelde/landroid-mqtt-bridge/actions/workflows/ci.yml) [![Docs](https://github.com/tobiaswaelde/landroid-mqtt-bridge/actions/workflows/pages.yml/badge.svg)](https://tobiaswaelde.github.io/landroid-mqtt-bridge/) [![Deploy](https://github.com/tobiaswaelde/landroid-mqtt-bridge/actions/workflows/deploy.yml/badge.svg)](https://github.com/tobiaswaelde/landroid-mqtt-bridge/actions/workflows/deploy.yml)

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-tobiaswaelde-FFDD00?style=for-the-badge&logo=buymeacoffee)](https://www.buymeacoffee.com/tobiaswaelde)

NestJS bridge between Worx, Kress, Landxcape, or Ferrex mower accounts and MQTT. Full documentation: [tobiaswaelde.github.io/landroid-mqtt-bridge](https://tobiaswaelde.github.io/landroid-mqtt-bridge/).

## Quick start

```bash
cp config/config.example.yml config/config.yml
# edit config/config.yml
docker compose up -d
```

Minimal configuration:

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

`mqtt.clientId` may be empty; the bridge then generates a UUID for the running process.

Example command:

```bash
mosquitto_pub -h mqtt.example.net -t 'home/landroid/garden/mowers/20213026710100887292/set/json' -m '{"cmd":1}'
```

See the [configuration](https://tobiaswaelde.github.io/landroid-mqtt-bridge/configuration), [MQTT contract](https://tobiaswaelde.github.io/landroid-mqtt-bridge/mqtt), [authentication](https://tobiaswaelde.github.io/landroid-mqtt-bridge/authentication), and [deployment guide](https://tobiaswaelde.github.io/landroid-mqtt-bridge/deployment).
