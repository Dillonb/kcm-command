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

const app = express();

app.get('/vehiclepositions_pb.json', async function (req, res) {
    console.log("fetching vehiclepositions_pb.json");
    const response = await fetch("https://s3.amazonaws.com/kcm-alerts-realtime-prod/vehiclepositions_pb.json");
    const data = await response.json();
    res.send(data)
});

app.get('/routes.json', async function (req, res) { res.send(routes); });
app.get('/trips.json', async function (req, res) { res.send(trips); });

ViteExpress.listen(app, 3000, () => console.log("Server is listening: http://localhost:3000/"));