import './style.css';
import L from 'leaflet';

let map;
let markersLayer;
let routes;
let trips;

async function fetchRoutes() {
  const response = await fetch("/routes.json");
  const routesList = await response.json();
  let routesById = {};
  routesList.forEach(route => {
    routesById[route["route_id"]] = route;
  });
  return routesById;
}

async function fetchTrips() {
  const response = await fetch("/trips.json");
  const tripsList = await response.json();
  let tripsById = {};
  tripsList.forEach(trip => {
    if (!tripsById[trip["trip_id"]]) {
      tripsById[trip["trip_id"]] = {};
    }
    if (tripsById[trip["trip_id"]][trip["direction_id"]]) {
      console.log("Duplicate trip_id and direction_id");
    }
    tripsById[trip["trip_id"]][trip["direction_id"]] = trip;
  });
  return tripsById;
}

let lastRefresh = null;
const REFRESH_INTERVAL = 10;

const statusBox = document.getElementById('status');

function updateStatus() {
  if (!lastRefresh) return;
  const elapsed = Math.floor((Date.now() - lastRefresh) / 1000);
  const remaining = Math.max(0, REFRESH_INTERVAL - elapsed);
  const time = new Date(lastRefresh).toLocaleTimeString();
  statusBox.textContent = `Last refresh: ${time} · Next in ${remaining}s`;
}

async function refreshPoints() {
  const response = await fetch("/vehiclepositions_pb.json");
  const vehiclepositions = await response.json();

  const newLayer = L.layerGroup();

  vehiclepositions.entity.forEach(vehicleposition => {
    const pos = vehicleposition.vehicle.position;
    const route_id = vehicleposition.vehicle.trip.route_id;
    const trip_id = vehicleposition.vehicle.trip.trip_id;
    const direction_id = vehicleposition.vehicle.trip.direction_id;
    const route = routes[route_id];
    const trip = trips[trip_id][direction_id];
    const label = route["route_short_name"] + " - " + route["route_desc"] + "\n" + trip["trip_headsign"];
    const isRapidRide = /^[A-Z] Line$/.test(route["route_short_name"]);

    const routeNum = route["route_short_name"]?.replace(" Line", "") || "";
    const icon = L.divIcon({
      className: isRapidRide ? 'route-icon rapidride' : 'route-icon',
      html: `<span>${routeNum}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    L.marker([pos.latitude, pos.longitude], { icon })
      .bindTooltip(label)
      .addTo(newLayer);
  });

  if (markersLayer) {
    map.removeLayer(markersLayer);
  }
  markersLayer = newLayer;
  markersLayer.addTo(map);

  lastRefresh = Date.now();
  updateStatus();
}

async function initializeMap() {
  map = L.map('map').setView([47.6062, -122.3321], 11);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  routes = await fetchRoutes();
  trips = await fetchTrips();

  refreshPoints();
  setInterval(refreshPoints, REFRESH_INTERVAL * 1000);
  setInterval(updateStatus, 1000);
}

initializeMap();