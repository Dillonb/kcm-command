import express from "express";
import ViteExpress from "vite-express";

const app = express();

app.get('/vehiclepositions_pb.json', async function (req, res) {
    console.log("fetching vehiclepositions_pb.json");
    const response = await fetch("https://s3.amazonaws.com/kcm-alerts-realtime-prod/vehiclepositions_pb.json");
    const data = await response.json();
    res.send(data)
})

ViteExpress.listen(app, 3000, () => console.log("Server is listening..."));