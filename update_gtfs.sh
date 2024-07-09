#!/usr/bin/env bash
pushd gtfs
wget https://metro.kingcounty.gov/GTFS/google_transit.zip
unzip -o google_transit.zip
rm google_transit.zip
popd
