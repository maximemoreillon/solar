const Influx = require('influx');
const path = require('path');
const express = require('express');
const history = require('connect-history-api-fallback');
const bodyParser = require("body-parser");
const http = require('http');
const mqtt = require('mqtt');
const cors = require('cors');

const secrets = require('./secrets.js');

const DB_name = 'solar'
const measurement_name = 'current'

const app = express();
app.use(cors())
app.use(history({
  // Ignore routes for connect-history-api-fallback
  rewrites: [
    { from: '/data', to: '/data'},
    { from: '/drop', to: '/drop'},
    { from: '/current_battery_voltage', to: '/current_battery_voltage'},
  ]
}));
app.use(express.static(path.join(__dirname, 'dist')));

//const influx = new Influx.InfluxDB('http://localhost:8086/' + DB_name)
const mqtt_client  = mqtt.connect('mqtt://192.168.1.2', secrets.mqtt);

const influx = new Influx.InfluxDB({
  host: secrets.influx.url,
  database: DB_name,
})


const PORT = 7668

// Create DB if not exists
influx.getDatabaseNames()
.then(names => {
  if (!names.includes(DB_name)) {
    influx.createDatabase(DB_name)
    .then(() => {
      influx.query(`CREATE RETENTION POLICY "renention_policy" ON "${DB_name}" DURATION 72h REPLICATION 1 DEFAULT`)
      .then( result => console.log(`Database ${DB_name} created successfully`) )
      .catch( error =>  console.log(error) );
    })
    .catch( error =>  console.log(error) );
  }
})
.catch(error => console.log(error));


app.get('/data', (req, res) => {
  influx.query(`
    select * from ${measurement_name}
  `)
  .then( result => res.send(result) )
  .catch( error => res.status(500) );
})

app.get('/current_battery_voltage', (req, res) => {
  influx.query(`
    select * from ${measurement_name} GROUP BY * ORDER BY DESC LIMIT 1
  `)
  .then( result => res.send(result[0].voltage) )
  .catch( error => res.status(500).send(`Error getting batteyr voltage from Influx: ${error}`));
})

app.get('/drop', (req, res) => {
  influx.dropDatabase(DB_name)
  .then( () => {

    influx.getDatabaseNames()
    .then(names => {
      if (!names.includes(DB_name)) {
        influx.createDatabase(DB_name)
        .then(() => {
          influx.query(`CREATE RETENTION POLICY "renention_policy" ON "${DB_name}" DURATION 72h REPLICATION 1 DEFAULT`)
          .then( result => res.send(`Database ${DB_name} created successfully`) )
          .catch( error =>  res.status(500).send(error) );
        })
        .catch( error =>  res.status(500).send(error) );
      }
    })
    .catch(error => res.status(500).send(error));
  })
  .catch(error => res.status(500).send(error));
})

app.listen(PORT, () => console.log(`[Express] Solar power manager listening on 0.0.0.0:${PORT}`))


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
        measurement: measurement_name,
        tags: {
          unit: "V",
        },
        fields: {
          voltage: Number(JSON.parse(payload).battery_voltage),
        },
        timestamp: new Date(),
      }
    ], {
      database: DB_name,
      precision: 's',
    })
    .catch(error => {
      console.error(`Error saving data to InfluxDB! ${error}`)
    });

});
