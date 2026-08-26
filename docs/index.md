---
layout: home

hero:
  name: Landroid MQTT Bridge
  text: Reliable cloud-to-MQTT automation for robotic mowers
  tagline: Connect selected Worx, Kress, Landxcape, and Ferrex mowers through explicit, per-device MQTT topics.
  image:
    src: /logo.svg
    alt: Landroid MQTT Bridge logo
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: MQTT contract
      link: /mqtt
    - theme: alt
      text: GitHub
      link: https://github.com/tobiaswaelde/landroid-mqtt-bridge

features:
  - icon: 🌿
    title: Account-scoped access
    details: Give each vendor account its own instance and publish only the explicitly configured mower serial numbers.
  - icon: ⚡
    title: REST snapshots and cloud MQTT
    details: Receive initial and periodic state over the vendor API, then forward live mower updates from one cloud MQTT connection.
  - icon: 🔒
    title: Private token storage
    details: OAuth tokens are written atomically with mode 0600 in the local, writable configuration volume.
---

## Built for deliberate mower automation

The bridge exposes raw mower snapshots, a small normalized configuration subtree, and one non-retained command topic per mower. It never discovers or publishes every mower in an account automatically: the `mowers` allowlist remains the MQTT boundary.

Start with the [configuration guide](/configuration), review [authentication storage](/authentication), then integrate with the [MQTT contract](/mqtt).

For other devices on the same broker, see the [WLED MQTT Bridge](https://tobiaswaelde.github.io/wled-mqtt-bridge/) and [Displays MQTT Bridge](https://tobiaswaelde.github.io/displays-mqtt-bridge/).
