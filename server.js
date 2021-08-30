const Influx = require('influx')
const path = require('path')
const express = require('express')
const bodyParser = require("body-parser")
const http = require('http')
const mqtt = require('mqtt')
const cors = require('cors')
const dotenv = require('dotenv')
const pjson = require('./package.json')

dotenv.config()

const port = process.env.APP_PORT || 80

const DB_name = 'solar'
const battery_voltage_measurement = 'battery_voltage'
const current_measurement = 'current'

const app = express();
app.use(cors())


//const influx = new Influx.InfluxDB('http://localhost:8086/' + DB_name)
const mqtt_client  = mqtt.connect(process.env.MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD
})

const influx = new Influx.InfluxDB({
  host: process.env.INFLUXDB_URL,
  database: DB_name,
})




// Create DB if not exists
influx.getDatabaseNames()
.then(names => {
  if (names.includes(DB_name)) return
  return influx.createDatabase(DB_name)
})
.then(() => {
  return influx.query(`CREATE RETENTION POLICY "renention_policy" ON "${DB_name}" DURATION 72h REPLICATION 1 DEFAULT`)
})
.then( result => console.log(`[InfluxDB] Database ${DB_name} created successfully`) )
.catch( error =>  console.log(error) )


app.get('/', (req, res) => {
  res.send({
    application_name: `Solar setup monitoring API URL`,
    version: pjson.version,
    influxdb_url: process.env.INFLUXDB_URL || 'undefined',
    mqtt_url: process.env.MQTT_URL || 'undefined',
  })
})

app.get('/battery_voltage/history', (req, res) => {
  const query = `select * from ${battery_voltage_measurement}`
  influx.query(query)
  .then( result => res.send(result) )
  .catch( error => res.status(500) );
})

app.get('/battery_voltage/current', (req, res) => {
  const query = `select * from ${battery_voltage_measurement} GROUP BY * ORDER BY DESC LIMIT 1`
  influx.query(query)
  .then( result => res.send(result[0]) )
  .catch( error => res.status(500).send(`Error getting voltge from InfluxDB: ${error}`));
})

app.get('/current/history', (req, res) => {
  const query = `select * from ${current_measurement}`
  influx.query(query)
  .then( result => res.send(result) )
  .catch( error => res.status(500) );
})

app.get('/current/current', (req, res) => {
  const query = `select * from ${current_measurement} GROUP BY * ORDER BY DESC LIMIT 1`
  influx.query(query)
  .then( result => res.send(result[0]) )
  .catch( error => res.status(500).send(`Error getting current from InfluxDB: ${error}`));
})

app.delete('/data', (req, res) => {

  influx.dropDatabase(DB_name)
  .then( () => influx.getDatabaseNames())
  .then( (names) => {
    if (names.includes(DB_name)) return

    return influx.createDatabase(DB_name)
  })
  .then(() => {
    return influx.query(`CREATE RETENTION POLICY "renention_policy" ON "${DB_name}" DURATION 72h REPLICATION 1 DEFAULT`)
  })
  .then( result => res.send(`Database ${DB_name} dropped and recreated`) )
  .catch(error => res.status(500).send(error));
})

app.listen(port, () => console.log(`[Express] Solar power manager listening on 0.0.0.0:${port}`))


mqtt_client.on('connect', () => {
  console.log("[MQTT] Connected to MQTT broker")
  mqtt_client.subscribe("solar/status");
});

mqtt_client.on('message', (topic, payload) => {
  console.log("[MQTT] Message arrived on " + topic)
  console.log(JSON.parse(payload))

  //TODO: check if payload can be parsed!


  influx.writePoints(
    [
      {
        measurement: battery_voltage_measurement,
        tags: { unit: "V", },
        fields: {
          voltage: Number(JSON.parse(payload).battery_voltage),
        },
        timestamp: new Date(),
      },
      {
        measurement: current_measurement,
        tags: { unit: "A", },
        fields: {
          voltage: Number(JSON.parse(payload).current),
        },
        timestamp: new Date(),
      },

    ], {
      database: DB_name,
      precision: 's',
    })
    .catch(error => {
      console.error(`Error saving data to InfluxDB! ${error}`)
    });

});
