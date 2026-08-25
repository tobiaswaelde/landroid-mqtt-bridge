# MQTT contract

Each cloud account has a root availability topic `<topic>/connected`; individual mower data is published below `<topic>/mowers/<serial>/mowerdata`, `status`, and `configuration/... `.

Send the vendor command object to `<topic>/mowers/<serial>/set/json`. For example, `{ "cmd": 1 }` starts mowing, `{ "cmd": 2 }` pauses, and `{ "cmd": 3 }` returns to base.

All command publications must be non-retained. The bridge clears a successfully received command topic with an empty payload.
