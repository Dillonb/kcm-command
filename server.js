import express from "express";
import ViteExpress from "vite-express";
import parse from 'csv-parser';
import * as fs from 'fs';
import { indexStopsById, indexStopTimesByTrip } from './lib.js';

function log(msg) {
    const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    console.log(`${time} [kcm] ${msg}`);
}

function parseCsv(file) {
    return new Promise((resolve) => {
        const results = [];
        fs.createReadStream(file)
            .pipe(parse())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                log("Loaded csv file from " + file);
                resolve(results);
            });
    });
}

const routes = await parseCsv("gtfs/routes.txt");
const trips = await parseCsv("gtfs/trips.txt");

const stopsRaw = await parseCsv("gtfs/stops.txt");
const stopsById = indexStopsById(stopsRaw);

const stopTimesRaw = await parseCsv("gtfs/stop_times.txt");
const stopTimesByTrip = indexStopTimesByTrip(stopTimesRaw, stopsById);
log(`Indexed stop_times for ${Object.keys(stopTimesByTrip).length} trips`);

const app = express();

app.get('/vehiclepositions_pb.json', async function (req, res) {
    log("Fetching vehiclepositions_pb.json");
    const response = await fetch("https://s3.amazonaws.com/kcm-alerts-realtime-prod/vehiclepositions_pb.json");
    const data = await response.json();
    res.send(data)
});

app.get('/routes.json', async function (req, res) { res.send(routes); });
app.get('/trips.json', async function (req, res) { res.send(trips); });

app.get('/trip_stops/:tripId.json', function (req, res) {
    const stops = stopTimesByTrip[req.params.tripId];
    if (!stops) return res.status(404).json({ error: "Trip not found" });
    res.json(stops);
});

ViteExpress.listen(app, 3000, () => log("Server is listening: http://localhost:3000/"));