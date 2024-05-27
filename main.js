import './style.css';
import {Feature, Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
import Point from 'ol/geom/Point';
import {Vector as VectorSource} from 'ol/source';
import {fromLonLat} from 'ol/proj';

let map;
let pointsLayer;
let routes;
let trips;

async function fetchRoutes() {
  const routes_url = "/routes.json";
  const response = await fetch(routes_url);
  const routesList = await response.json();
  let routesById = {};
  routesList.forEach(route => {
    routesById[route["route_id"]] = route;
  });
  return routesById;
}

async function fetchTrips() {
  const trips_url = "/trips.json";
  const response = await fetch(trips_url);
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

async function generatePointsLayer() {
  const source = new VectorSource();

  const vehiclepositions_url = "/vehiclepositions_pb.json";
  const response = await fetch(vehiclepositions_url);
  const vehiclepositions = await response.json();

  const features = vehiclepositions.entity.map(vehicleposition => {
    const pos = vehicleposition.vehicle.position;
    const route_id = vehicleposition.vehicle.trip.route_id;
    const trip_id = vehicleposition.vehicle.trip.trip_id;
    const direction_id = vehicleposition.vehicle.trip.direction_id;
    const route = routes[route_id];
    const trip = trips[trip_id][direction_id];
    return new Feature({
      geometry: new Point(fromLonLat([pos.longitude, pos.latitude])),
      name: route["route_short_name"] + " - " + route["route_desc"] + "\n" + trip["trip_headsign"]
    })
  });

  source.addFeatures(features);

  return new WebGLPointsLayer({
        source: source,
        style: {
          symbol: {
            symbolType: 'circle',
            size: 14,
            color: 'rgb(255, 0, 0)',
            opacity: 1,
          },
        }
      });
}

async function refreshPoints() {
  const newPointsLayer = await generatePointsLayer();

  if (pointsLayer) {
    map.removeLayer(pointsLayer);
  }

  pointsLayer = newPointsLayer;
  map.addLayer(pointsLayer);

}

const info = document.getElementById('info');

let currentFeature;
const displayFeatureInfo = function (pixel, feature) {
  if (feature) {
    info.style.left = pixel[0] + 'px';
    info.style.top = pixel[1] + 'px';
    info.style.visibility = 'visible';
    info.innerText = feature.get('name');
  } else {
    info.style.visibility = 'hidden';
  }
  currentFeature = feature;
};


let selected = null;
async function initializeMap() {
  map = new Map({
    target: 'map',
    layers: [
      new TileLayer({
        source: new OSM()
      })
    ],
    view: new View({
      center: [0, 0],
      zoom: 2
    })
  });

  routes = await fetchRoutes();
  trips = await fetchTrips();

  refreshPoints();

  setInterval(refreshPoints, 10000);

  map.on('pointermove', function (ev) {
    if (selected !== null) {
      selected.set('hover', 0);
      info.style.visibility = 'hidden';
      selected = null;
    }

    map.forEachFeatureAtPixel(ev.pixel, function (feature) {
      feature.set('hover', 1);
      selected = feature;
      return true;
    });

    displayFeatureInfo(ev.pixel, selected);
  });
}

initializeMap();