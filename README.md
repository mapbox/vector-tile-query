vector-tile-query
================

vector-tile-query allows you to query vector tiles and return data values from these tiles. This module consists of one main function, and two utility / helper functions.

### `vector-tile-query.queryTile(<pbuf>, <tileInfo>, <queryPoints>, <pointIDs>, <options>, <callback>);`

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



### `vector-tile-query.loadTiles(<queryPoints>, <zoom>, <loadFunction>, <callback>)`

Given a set of `lng,lat` points and a zoom level, finds what tiles to load, loads these tiles asyncronously (using a defined function), splits query `lng, lat`s out per tile, and assigns these a sequential ID (based on input order)

#### Input

* `queryPoints`: `array` of `lng, lat`s (`[[lng,lat],[lng,lat]...]`)
* `zoom`: zoom level of tiles to query
* `loadFunction`: function to load tiles / should return a `pbuf`
* `callback`: `function(err,data) {...}` to call upon completion

#### Output
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




