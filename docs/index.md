---
layout: home

hero:
  name: Landroid MQTT Bridge
  text: Bring robotic mower accounts to MQTT
  tagline: Connect Worx, Kress, Landxcape, and Ferrex mower accounts through one clear MQTT contract.
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

features:
  - title: Multi-brand accounts
    details: Configure the supported mower cloud and the serial numbers this bridge manages.
  - title: Mower telemetry
    details: Publish mower state and send supported commands through device-specific MQTT topics.
  - title: Container ready
    details: Keep credentials in ignored local configuration and run the bridge with Docker.
---

Every installation is defined in `config/config.yml`. Continue with [configuration](/configuration), [authentication](/authentication), or the [MQTT contract](/mqtt).

For local lighting controllers in the same MQTT setup, see the [WLED MQTT Bridge documentation](https://tobiaswaelde.github.io/wled-mqtt-bridge/).
