# Solar setup monitor

A monitoring system for a solar installation

## API
| Route | Method | query/body | Description |
| --- | --- | --- | --- |
| / | GET | - | Show application configuration |
| /battery_voltage/history | GET | - | Get an array of the past voltage measurements |
| /battery_voltage/current | GET | - | Get the current battery voltage |
| /current/history | GET | - | Get an array of the past current measurements |
| /current/current | GET | - | Get the current current value |

## Environment variables
| Variable  | Description |
| --- | --- |
| INFLUXDB_URL | URL of the InfluxDB database |
| MQTT_URL | URL of the MQTT broker |
| MQTT_USERNAME | Username for the MQTT broker |
| MQTT_PASSWORD | Password for the MQTT broker |
