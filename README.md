vector-tile-query
================

vector-tile-query allows you to query vector tiles and return data.

## Get Data:
`queryVT(mapid, layer, attribute, skipVal, queryData, callback)`

## Params:

`mapid`: Mapbox vector tile source. Example: `mapbox.mapbox-terrain-v1`
`layer`: layer within the tile source to query. Example: `contour`
`attribute`: The attribute within the layer to return data for. Example `ele`
`skipVal`: The number of values to skip along a long. Higher values interpolates more features and makes the query faster.  The Default is set 1 or no skipping.
`tolerance`: Tolerance within vector tile to query for point. Default: 1
`maximum`: Maximum number of points to query. Default: 350.
`z`: What zoom level to pull data from. Default: 14.
`queryData`: array of lng lats. Seperated by a `;`. Example: `-122.464599609375,37.80123932755579;-122.46794700622559,37.80378247417763`

#### benchmarking

Create variations of the algorithm in `variations/`.

```
$ npm install
$ node --prof bench/query.js
$ npm install -g node-tick-processor
$ node-tick-processor v8.log | less
```

(Alamere Falls Hike Query)
