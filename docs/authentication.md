# Authentication

Configure the account credentials used by the vendor app. The bridge signs in once, refreshes the cloud token before expiry, and keeps one cloud MQTT connection per account.

Use one instance for each vendor/cloud account and list only the mower serials that the local broker may expose. Keep the writable `config/` volume private; the bridge stores cloud credentials only in its instance-specific auth file.
