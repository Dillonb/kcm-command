import './style.css';
import {Feature, Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import WebGLPointsLayer from 'ol/layer/WebGLPoints.js';
import VectorLayer from 'ol/layer/Vector';
import Point from 'ol/geom/Point';
import {Stamen, Vector as VectorSource} from 'ol/source';
import {fromLonLat} from 'ol/proj';

const source = new VectorSource();

const vehiclepositions_url = "vehiclepositions_pb.json";
const response = await fetch(vehiclepositions_url);
const vehiclepositions = await response.json();

const features = vehiclepositions.entity.map(vehicleposition => {
  const pos = vehicleposition.vehicle.position;
  return new Feature({
    geometry: new Point(fromLonLat([pos.longitude, pos.latitude])),
    name: "test"
  })
});

source.addFeatures(features);

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM()
    }),
    new WebGLPointsLayer({
      source: source,
      style: {
        symbol: {
          symbolType: 'circle',
          size: 14,
          color: 'rgb(255, 0, 0)',
          opacity: 1,
        },
      }
    })
  ],
  view: new View({
    center: [0, 0],
    zoom: 2
  })
});
