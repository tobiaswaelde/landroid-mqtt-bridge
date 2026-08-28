# MQTT contract

Replace `<topic>` with one instance's configured `topic` and `<serial>` with an enabled mower serial. The bridge uses one shared local MQTT connection for every instance. All bridge publications are non-retained; subscribe before starting the bridge when the initial values matter.

| Topic | Direction | Payload |
| --- | --- | --- |
| `<topic>/connected` | Bridge → client | `true` after the account and configured mowers are available through the cloud API; `false` during startup or shutdown. |
| `<topic>/mowers/<serial>/status` | Bridge → client | JSON object such as `{ "online": true }`. |
| `<topic>/mowers/<serial>/mowerdata` | Bridge → client | Raw JSON snapshot from the vendor cloud. |
| `<topic>/mowers/<serial>/configuration/#` | Bridge → client | Flattened scalar values from `mowerdata.cfg` and `mowerdata.dat`; see below. |
| `<topic>/mowers/<serial>/set/json` | Client → bridge | Non-retained vendor command JSON object. |

The bridge publishes the initial `connected: false` and every enabled mower's `status: { "online": false }` before signing in. It then combines periodic REST refreshes with vendor-cloud MQTT messages for live state.

## Mower data and configuration

`mowerdata` intentionally preserves the vendor JSON so automations can use fields the bridge does not normalize. The bridge also publishes known scalar values from its `cfg` configuration and `dat` live-data objects below `configuration/` for simple topic-based consumers.

Every path below is relative to `<topic>/mowers/<serial>/configuration/`. A path is published only when the vendor snapshot contains its source value. `<zone>` is a one-based zone number; `<day>` is `sunday` through `saturday`.

| Path | Source | Meaning |
| --- | --- | --- |
| `activityCode` | `dat.act` | Raw mower activity code. |
| `autoLock/{level,timeout}` | `cfg.al` | Automatic-lock level and timeout. |
| `battery/{chargeCycles,charging,mode,percentage,temperatureCelsius,voltage}` | `dat.bt` | Battery cycle count, charge state, vendor mode, level, temperature, and voltage. |
| `command`, `date`, `language`, `requestId`, `serialNumber`, `time`, `torquePercent` | `cfg` | Last cloud command and configuration metadata. |
| `connection` | `dat.conn` | Vendor-reported connection type, for example `wifi`. |
| `errorCode` | `dat.le` | Raw vendor error code; see the enum below. |
| `firmware/{boardVersion,version}` | `dat.fwb`, `dat.fw` | Board and main firmware versions. |
| `locked` | `dat.lk` | Whether the mower reports itself locked. |
| `macAddress` | `dat.mac` | Mower MAC address. Restrict MQTT reads if this is sensitive. |
| `modules/antiCollisionSystem/enabled` | `cfg.modules.US` | Anti-collision-system setting. |
| `modules/offLimits/{enabled,shortcutsEnabled}` | `cfg.modules.DF` | Off Limits setting and its shortcut option. |
| `multiZone/enabled` | `cfg.mzk` | Multi-zone mode. |
| `multiZone/startingPoints/zone<zone>` | `cfg.mz` | Starting point for each configured zone. |
| `multiZone/zoneIndices/zone<zone>` | `cfg.mzv` | Zone allocation/index values. |
| `orientation/{pitch,roll,yaw}` | `dat.dmp` | Mower orientation in degrees. |
| `rain/{detected,remainingMinutes}` | `dat.rain` | Rain-sensor state and vendor-reported remaining time. |
| `rainDelayMinutes` | `cfg.rd` | Configured rain delay. |
| `schedules/active`, `schedules/distanceMode`, `schedules/timeExtensionPercent` | `cfg.sc` | Scheduler-wide values. |
| `schedules/oneTime/{boundaryCut,durationMinutes}` | `cfg.sc.ots` | One-time mowing settings. |
| `schedules/{primary,secondary}/<day>/{boundaryCut,durationMinutes,startTime}` | `cfg.sc.d`, `cfg.sc.dd` | Weekly schedule slots. |
| `signalStrength` | `dat.rsi` | Vendor-reported radio signal strength. |
| `statistics/bladeTimeMinutes` | `dat.st.b` | Total blade operating time in minutes. |
| `statistics/boundaryWireLengthMeters` | `dat.st.bl` | Boundary-wire length in metres. |
| `statistics/distanceMeters` | `dat.st.d` | Total travelled distance in metres. |
| `statistics/workingTimeMinutes` | `dat.st.wt` | Total mower operating time in minutes. |
| `statusCode` | `dat.ls` | Raw vendor status code; see the enum below. |
| `zoneIndex` | `dat.lz` | Last/current vendor zone index. |

Unknown vendor fields remain only in `mowerdata`; this avoids silently assigning a public topic contract to every cloud field.

## Commands

Publish a JSON object to `<topic>/mowers/<serial>/set/json`:

```json
{ "cmd": "start" }
```

`cmd` is always a string. Numeric cloud codes are deliberately rejected at the MQTT boundary; the bridge converts documented names before sending the vendor request. Additional fields are forwarded unchanged for the selected command.

| `cmd` | Cloud code | Effect |
| --- | --- | --- |
| `start` | `1` | Start mowing. |
| `pause` or `stop` | `2` | Pause/stop the current mowing action. |
| `home` | `3` | Return to the charging base. |
| `zone_training` | `4` | Start zone training, if the mower supports it. |
| `lock` | `5` | Lock the mower. |
| `unlock` | `6` | Unlock the mower. |

The bridge enriches a valid command with the serial, current local date and time, language, and request ID required by the cloud protocol, then forwards it only while the mower and cloud MQTT connection are online. Keep additional vendor-specific fields small and test them with one mower first.

Commands must not be retained. The bridge clears a successfully received command topic with an empty payload, preventing a broker reconnect from repeating a mower action.

## Status and error codes

`configuration/statusCode` and `configuration/errorCode` are the raw numeric values reported by the vendor. They are intentionally kept numeric so the original cloud data remains available, while this table gives the established meaning for wire-based Landroid models.

### Error codes

| Code | Meaning |
| --- | --- |
| `-1` | Unknown. |
| `0` | No error. |
| `1` | Mower trapped. |
| `2` | Mower lifted. |
| `3` | Boundary wire missing. |
| `4` | Outside boundary wire. |
| `5` | Rain detected. |
| `6` | Close the cover to mow. |
| `7` | Close the cover to return home. |
| `8` | Blade motor blocked. |
| `9` | Wheel motor blocked. |
| `10` | Trapped timeout. |
| `11` | Mower upside down. |
| `12` | Battery low. |
| `13` | Boundary wire reversed. |
| `14` | Charging error. |
| `15` | Timeout while finding home. |
| `16` | Mower locked. |
| `17` | Battery over temperature. |
| `20` | Mower outside boundary wire. |

### Status codes

| Code | Meaning |
| --- | --- |
| `-1` | Unknown. |
| `0` | Idle. |
| `1` | At home. |
| `2` | Start sequence. |
| `3` | Leaving home. |
| `4` | Following the wire. |
| `5` | Searching for home. |
| `6` | Searching for the boundary wire. |
| `7` | Mowing. |
| `8` | Lifted. |
| `9` | Trapped. |
| `10` | Blade blocked. |
| `11` | Debug mode. |
| `12` | Remote control. |
| `13` | Escaping Off Limits. |
| `30` | Going home. |
| `31` | Zone training. |
| `32` | Border cut. |
| `33` | Searching for a zone. |
| `34` | Paused. |
| `99` | Manual stop. |

These code sets are not a promise for every newer Kress, LandXcape, Ferrex, or Vision model. Treat unknown values as vendor/model-specific and still use the raw `mowerdata` JSON while investigating them. The established enum names and Landroid battery/status channels are documented by the [openHAB Worx Landroid binding](https://www.openhab.org/addons/bindings/worxlandroid/).
