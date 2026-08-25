# Landroid MQTT Bridge

[![CI](https://img.shields.io/github/actions/workflow/status/tobiaswaelde/landroid-mqtt-bridge/ci.yml?style=for-the-badge&label=CI)](https://github.com/tobiaswaelde/landroid-mqtt-bridge/actions/workflows/ci.yml) [![Docs](https://img.shields.io/github/actions/workflow/status/tobiaswaelde/landroid-mqtt-bridge/docs.yml?style=for-the-badge&label=Docs)](https://github.com/tobiaswaelde/landroid-mqtt-bridge/actions/workflows/docs.yml) [![Deploy](https://img.shields.io/github/actions/workflow/status/tobiaswaelde/landroid-mqtt-bridge/deploy.yml?style=for-the-badge&label=Deploy)](https://github.com/tobiaswaelde/landroid-mqtt-bridge/actions/workflows/deploy.yml)

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

## Documentation

- [Documentation home](https://tobiaswaelde.github.io/landroid-mqtt-bridge/)
- [Configuration](https://tobiaswaelde.github.io/landroid-mqtt-bridge/configuration)
- [Authentication](https://tobiaswaelde.github.io/landroid-mqtt-bridge/authentication)
- [MQTT contract](https://tobiaswaelde.github.io/landroid-mqtt-bridge/mqtt)
- [Docker deployment](https://tobiaswaelde.github.io/landroid-mqtt-bridge/deployment)
- [WLED MQTT Bridge for local lighting](https://tobiaswaelde.github.io/wled-mqtt-bridge/)
