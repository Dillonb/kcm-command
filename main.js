import './style.css';
import L from 'leaflet';
import { formatTime, buildTimetableHtml } from './lib.js';

let map;
let markersLayer;
let routes;
let trips;

// tracks the currently open timetable popup across refreshes
let activePopup = null; // { vehicleId, tripId, stops, label }
let isRefreshing = false;

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

  let reopenMarker = null;

  vehiclepositions.entity.forEach(vehicleposition => {
    const vehicleId = vehicleposition.vehicle.vehicle.id;
    const pos = vehicleposition.vehicle.position;
    const route_id = vehicleposition.vehicle.trip.route_id;
    const trip_id = vehicleposition.vehicle.trip.trip_id;
    const direction_id = vehicleposition.vehicle.trip.direction_id;
    const route = routes[route_id];
    const trip = trips[trip_id][direction_id];
    const label = route["route_short_name"] + " - " + route["route_desc"] + "\n" + trip["trip_headsign"];
    const isRapidRide = /^[A-Z] Line$/.test(route["route_short_name"]);

    const currentStopSeq = vehicleposition.vehicle.current_stop_sequence;
    const currentStatus = vehicleposition.vehicle.current_status;

    const isStreetcar = route["route_type"] === "0";
    const routeNum = route["route_short_name"]?.replace(" Line", "") || "";

    let iconClass = 'route-icon';
    let iconHtml;
    if (isStreetcar) {
      iconClass += ' streetcar';
      iconHtml = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff"><path d="M12 2C8 2 4 2.5 4 6v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 11H6V6h12v5z"/></svg>';
    } else {
      if (isRapidRide) iconClass += ' rapidride';
      iconHtml = `<span>${routeNum}</span>`;
    }

    const icon = L.divIcon({
      className: iconClass,
      html: iconHtml,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const marker = L.marker([pos.latitude, pos.longitude], { icon })
      .bindTooltip(label)
      .addTo(newLayer);

    marker.on('click', () => openTimetablePopup(marker, vehicleId, trip_id, currentStopSeq, currentStatus, label));
    marker.on('popupclose', () => { if (!isRefreshing && activePopup?.vehicleId === vehicleId) activePopup = null; });

    if (activePopup && activePopup.vehicleId === vehicleId) {
      activePopup.currentStopSeq = currentStopSeq;
      activePopup.currentStatus = currentStatus;
      activePopup.label = label;
      reopenMarker = marker;
    }
  });

  isRefreshing = true;
  if (markersLayer) {
    map.removeLayer(markersLayer);
  }
  markersLayer = newLayer;
  markersLayer.addTo(map);

  if (reopenMarker && activePopup) {
    attachPopup(reopenMarker, activePopup);
  }
  isRefreshing = false;

  lastRefresh = Date.now();
  updateStatus();
}

function attachPopup(marker, popupData) {
  const html = buildTimetableHtml(popupData.stops, popupData.currentStopSeq, popupData.currentStatus, popupData.label);
  marker.unbindPopup();
  marker.bindPopup(html, { maxHeight: 320, minWidth: 240 }).openPopup();
}

async function openTimetablePopup(marker, vehicleId, tripId, currentStopSeq, currentStatus, label) {
  marker.unbindPopup();
  marker.bindPopup('<div class="timetable-popup"><em>Loading…</em></div>', { maxHeight: 320, minWidth: 240 }).openPopup();

  try {
    const res = await fetch(`/trip_stops/${tripId}.json`);
    if (!res.ok) { marker.setPopupContent('<div class="timetable-popup">Timetable not available</div>'); return; }
    const stops = await res.json();

    activePopup = { vehicleId, tripId, stops, currentStopSeq, currentStatus, label };
    const html = buildTimetableHtml(stops, currentStopSeq, currentStatus, label);
    marker.setPopupContent(html);
  } catch {
    marker.setPopupContent('<div class="timetable-popup">Failed to load timetable</div>');
  }
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