vector-tile-query
================

vector-tile-query allows you to query vector tiles and return data values from these tiles. This module consists of one main function, and two utility / helper functions.

### `queryTile(<pbuf>, <tileInfo>, <queryPoints>, <pointIDs>, <options>, <callback>);`

Parses a Vector Tile protobuf and queries a layer for a a number of fields based on a series of lng, lat points

#### Input

* `pbuf`: vector tile (`pbuf`)
* `tileInfo`: tile Z,X,Y ('tileinfo: {z:<z>,x:<x>,y:<y>}')
* `queryPoints`: `array` of `lng, lat`s (`[[lng,lat],[lng,lat]...]`)
* `pointIDs`: `array` of point IDs that correspond to order of query `lng,lat`s (`[0,1,2...]`)
* `options`: options for query:
 * `layer`: layer within the tile source to query. Example: `contour`
 * `fields`: `array` of fields within the layer to return data for. Example [`ele`]
* `callback`: `function(err,data) {...}` to call upon completion of query

#### Output

Array (with one record per input `lng,lat`) of values:
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

Given a set of `lng,lat` points and a zoom level, finds what tiles to load, loads these tiles asynchronously (using a defined function), splits query `lng, lat`s out per tile, and assigns these a sequential ID (based on input order)

#### Input

* `queryPoints`: `array` of `lng, lat`s (`[[lng,lat],[lng,lat]...]`)
* `zoom`: zoom level of tiles to query
* `loadFunction`: function to load tiles / should return a `pbuf`
* `callback`: `function(err,data) {...}` to call upon completion

#### Output
Array of "tile objects" with tile zxy, query points within that tile, ids of these points, and vector tile pbufs.
```
[
    {
        zxy: { z: <z>, x: <x>, y: <y> },
        points: [ [lng,lat], [lng,lat], ... ],
        pointIDs: [ 0, 1, ... ],
        data: <vtile pbuf>
    } 
...
]
```

### multiQuery(dataArr,options,callback)

Helper function to asynchronously query (using `queryTile` (given a set of "tile objects") and return sorted values (based on input order / input point ids).

#### Input

* `dataArr`: `array` of "tileObjects" as described above - one for each tile that will be queried
* `options`: `options` as described above in `queryTile`
* `callback`: `function(err,data) {...}` to call upon completion

#### Output

Array (with one record per input `lng,lat`) of values:
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