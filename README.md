[![Build Status](https://travis-ci.org/mapbox/vector-tile-query.svg?branch=master)](https://travis-ci.org/mapbox/vector-tile-query)
vector-tile-query 1.2.0
=======================

vector-tile-query allows you to query [Mapbox Vector Tiles](https://github.com/mapbox/vector-tile-spec) and return data values from these tiles. This module consists of one main function, and two utility / helper functions.

### `queryTile(<pbuf>, <tileInfo>, <queryPoints>, <pointIDs>, <options>, <callback>);`

Parses a Vector Tile protobuf and queries a layer for a a number of fields based on a series of lat, lngs points

#### Input

* `pbuf`: vector tile (`pbuf`)
* `tileInfo`: tile Z,X,Y ('tileinfo: {z:<z>,x:<x>,y:<y>}')
* `queryPoints`: `array` of `lat, lngs`s (`[[lat,lng],[lat,lng]...]`)
* `pointIDs`: `array` of point IDs that correspond to order of query `lat,lng`s (`[0,1,2...]`)
* `options`: options for query:
 * `layer`: layer within the tile source to query. Example: `contour`
 * `fields`: `array` of fields within the layer to return data for. Example [`ele`]
 * `interpolate` (optional): whether or not to interpolate between closest two features. Example `false`. Default `true`
* `callback`: `function(err,data) {...}` to call upon completion of query

#### Output

Array (with one record per input `lat,lng`) of values:
```
[
    {
        id: <id>,
        latlng: { lat: <lat>, lng: <lng> },
        <field1>: <field1 value>,
        <field2>: <field2 value>
    },
    ...
]
```

### `loadTiles(<queryPoints>, <zoom>, <loadFunction>, <callback>)`

Given a set of `lat,lng` points and a zoom level, finds what tiles to load, loads these tiles asynchronously (using a defined function), splits query `lat, lngs`s out per tile, and assigns these a sequential ID (based on input order)

#### Input

* `queryPoints`: `array` of `lat, lngs`s (`[[lat,lng],[lat,lng]...]`)
* `zoom`: zoom level of tiles to query
* `loadFunction`: function to load tiles / should return a `pbuf`
* `callback`: `function(err,data) {...}` to call upon completion

#### Output
Array of "tile objects" with tile zxy, query points within that tile, ids of these points, and vector tile pbufs.
```
[
    {
        zxy: { z: <z>, x: <x>, y: <y> },
        points: [ [lat,lng], [lat,lng], ... ],
        pointIDs: [ 0, 1, ... ],
        data: <vtile pbuf>
    } 
...
]
```

### multiQuery(dataArr,options,callback)

Helper function to asynchronously query (using `queryTile` (given a set of "tile objects") and return sorted values (based on input order / input point ids).

#### Input

* `dataArr`: `array` of "tileObjects" as described above - one record for each tile that will be queried
* `options`: `options` as described above in `queryTile`
* `callback`: `function(err,data) {...}` to call upon completion

#### Output

Array (with one record per input `lat,lng`) of values:
```
[
    {
        id: <id>,
        latlng: { lat: <lat>, lng: <lng> },
        <field1>: <field1 value>,
        <field2>: <field2 value>
    },
    ...
]
```

### Usage
```
git clone https://github.com/mapbox/vector-tile-query.git
npm install
```
