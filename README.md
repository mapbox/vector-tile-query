vector-tile-query
================

vector-tile-query allows you to query vector tiles and return data.

## Get Data:
`queryVT(options, callback)`

## Options:

* `mapid`: Mapbox vector tile source. Example: `mapbox.mapbox-terrain-v1`
* `layer`: layer within the tile source to query. Example: `contour`
* `field`: The field within the layer to return data for. Example `ele`
* `tolerance`: Tolerance within vector tile to query for point. Default: 1
* `z`: What zoom level to pull data from.
* `queryData`: array of lng lats. Seperated by a `;`. Example: `-122.464599609375,37.80123932755579;-122.46794700622559,37.80378247417763`

#### benchmarking

Create variations of the algorithm in `variations/`.

```
$ npm install
$ node --prof bench/query.js
$ npm install -g node-tick-processor
$ node-tick-processor v8.log | less
```

(Alamere Falls Hike Query)
