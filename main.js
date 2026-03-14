import './style.css';
import L from 'leaflet';

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

    const routeNum = route["route_short_name"]?.replace(" Line", "") || "";
    const icon = L.divIcon({
      className: isRapidRide ? 'route-icon rapidride' : 'route-icon',
      html: `<span>${routeNum}</span>`,
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

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':');
  let hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${m} ${suffix}`;
}

function buildTimetableHtml(stops, currentStopSeq, currentStatus, label) {
  let rows = '';
  stops.forEach(stop => {
    const seq = stop.stop_sequence;
    let cls = '';
    if (currentStatus === 'STOPPED_AT' && seq === currentStopSeq) {
      cls = 'stop-current';
    } else if (currentStatus === 'IN_TRANSIT_TO') {
      if (seq === currentStopSeq - 1) cls = 'stop-previous';
      else if (seq === currentStopSeq) cls = 'stop-next';
    }
    rows += `<tr class="${cls}"><td class="tt-time">${formatTime(stop.arrival_time)}</td><td>${stop.stop_name}</td></tr>`;
  });
  return `<div class="timetable-popup"><div class="tt-header">${label.replace('\n', '<br>')}</div><div class="tt-scroll"><table>${rows}</table></div></div>`;
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