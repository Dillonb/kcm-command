import express from "express";
import ViteExpress from "vite-express";
import parse from 'csv-parser';
import * as fs from 'fs';

function parseCsv(file) {
    return new Promise((resolve) => {
        const results = [];
        fs.createReadStream(file)
            .pipe(parse())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                console.log("Loaded csv file from " + file);
                resolve(results);
            });
    });
}

const routes = await parseCsv("gtfs/routes.txt");
const trips = await parseCsv("gtfs/trips.txt");

const stopsRaw = await parseCsv("gtfs/stops.txt");
const stopsById = {};
stopsRaw.forEach(s => { stopsById[s.stop_id] = s.stop_name; });

const stopTimesRaw = await parseCsv("gtfs/stop_times.txt");
const stopTimesByTrip = {};
stopTimesRaw.forEach(st => {
    if (!stopTimesByTrip[st.trip_id]) stopTimesByTrip[st.trip_id] = [];
    stopTimesByTrip[st.trip_id].push({
        arrival_time: st.arrival_time,
        departure_time: st.departure_time,
        stop_id: st.stop_id,
        stop_sequence: Number(st.stop_sequence),
        stop_name: stopsById[st.stop_id] || st.stop_id,
    });
});
// sort each trip's stops by sequence
for (const tid in stopTimesByTrip) {
    stopTimesByTrip[tid].sort((a, b) => a.stop_sequence - b.stop_sequence);
}
console.log(`Indexed stop_times for ${Object.keys(stopTimesByTrip).length} trips`);

const app = express();

app.get('/vehiclepositions_pb.json', async function (req, res) {
    console.log("fetching vehiclepositions_pb.json");
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

ViteExpress.listen(app, 3000, () => console.log("Server is listening: http://localhost:3000/"));