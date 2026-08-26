# Authentication

Use the same email address and password that sign in to the selected vendor app. The bridge obtains an OAuth token on startup, refreshes it before expiry, and then keeps one cloud MQTT connection per configured account.

Use one instance for each vendor/cloud account and list only the mower serials that the local broker may expose. The serial list is an allowlist, not a discovery mechanism.

## Token files

The bridge stores its current access and refresh-token data in `authFile`. When omitted, it derives a filename from the instance topic, such as `.landroid-<hash>.auth.json`, next to `config.yml`.

- The file is written atomically and set to mode `0600`.
- Mount `./config` read/write in Docker so a refreshed token survives a restart.
- Keep the mounted directory private. It is ignored by Git, but that does not protect copied backups or logs.
- Delete only the relevant auth file to force a fresh cloud login after an account-password change or revoked session.

The YAML password is used to obtain a new token; it is not copied into the auth file. Never publish cloud tokens or vendor credentials to MQTT.
