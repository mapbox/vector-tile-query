var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var sm = new sphericalmercator();
var async = require('queue-async');
var filler = require('./lib/fill-nulls');

function sortBy(sortField) {
    return function sortCallback(a, b) {
        var ad = a[sortField] || 0;
        var bd = b[sortField] || 0;
        return ad < bd ? -1 : ad > bd ? 1 : 0;
    };
}

function buildQuery(points, zoom) {
    var queryObject = {}, output = [];
    for (var i = 0; i < points.length; i++) {
        var xyz = sm.xyz([points[i][1], points[i][0], points[i][1], points[i][0]], zoom);
        var tileName = zoom + '/' + xyz.minX + '/' + xyz.minY;
        if (queryObject[tileName] === undefined) {
            queryObject[tileName] = {
                zxy: {
                    z: zoom,
                    x: xyz.minX,
                    y: xyz.minY
                },
                points: [
                    [points[i][1], points[i][0]]
                ],
                pointIDs: [i]
            };
            output.push(queryObject[tileName]);
        } else {
            queryObject[tileName].points.push([points[i][1], points[i][0]]);
            queryObject[tileName].pointIDs.push(i);
        }
    }
    return output;
}

function loadTiles(queryPoints, maxZoom, minZoom, threshold, loadFunction, callback) {
    if (!queryPoints[0].length) return callback(new Error('Invalid query points'));
    if (!threshold) return callback(new Error('Specify a zoom level threshold'));

    function loadTileAsync(tileObj, loadFunction, callback) {
        loadFunction(tileObj.zxy, function(err, data) {
            if (err) return callback(err);
            tileObj.data = data;
            return callback(null, tileObj);
        });
    }
    var reducer = new Reducer();
    var initialTileLoad = buildQuery(queryPoints, maxZoom);

    var reducedTiles = reducer.reduce(initialTileLoad, queryPoints, maxZoom, minZoom, threshold);

    if(reducedTiles.length > threshold) return callback(new Error('Too many tiles have been requested'));

    var loadQueue = new async();
    for (var i = 0; i < reducedTiles.length; i++) {
        loadQueue.defer(loadTileAsync,reducedTiles[i],loadFunction);
    }

    loadQueue.awaitAll(callback);

}

var Reducer = function() {};

Reducer.prototype = {
    tileReduce: function(points, minZoom, threshold) {
        if (this.tiles.length > threshold) {
             this.zoom -= 1;
             if (this.zoom >= minZoom) {
                this.tiles = buildQuery(points, this.zoom);
                try {
                    this.tileReduce(points, minZoom, threshold);
                } catch(e) {
                    return e; 
                }
             } else {
                return this.tiles;
             }
        } else {
            return this.tiles;
        }
    },
    reduce: function(tiles, points, currentZoom, minZoom, threshold) {
        this.tiles = tiles;
        this.zoom = currentZoom;
        this.tileReduce(points, minZoom, threshold);
        return this.tiles;
    },
    tiles: {},
    zoom: {}
};

function changeNumberTilesLoaded(initialTileLoad, queryPoints, maxZoom, minZoom, threshold) {
    var reducer = new Reducer();
    return reducer.reduce(initialTileLoad, queryPoints, maxZoom, minZoom, threshold);
}

function queryTile(pbuf, tileInfo, queryPoints, pointIDs, options, callback) {

    function createEmptyResponse(respLength, callback) {
            var data = {
                hits: []
            };
            for (var i = 0; i < respLength; i++) {
                data.hits.push([]);
            }
            return callback(null, data);
    }

    function query(vt, queryPoints, layer, fields, tolerance) {
        if (vt.names().indexOf(layer) === -1) {
            createEmptyResponse(queryPoints.length,queryFinalize);
        } else {
            vt.queryMany(queryPoints, { layer: layer, tolerance: tolerance }, queryFinalize);
        }
    }

    function queryFinalize(err, data) {
        if (err) return callback(err);
        return callback(null, convert(queryPoints, pointIDs, fields, interpolate, data));
    }

    var outputData;
    var fields;
    var tolerance = options.tolerance || 10;
    var interpolate = options.interpolate !== undefined ? options.interpolate : true;

    if (options.fields) {
        fields = options.fields;
    } else {
        return callback(new Error('Field(s) not specified'));
    }

    if (options.layer) {
        var layer = options.layer;
    } else {
        return callback(new Error('No layer specified'));
    }

    if (fields && fields.length === 0) {
        callback(new Error('Field array empty'));
    }

    if (pbuf && Buffer.isBuffer(pbuf)) {
        var vt = new mapnik.VectorTile(tileInfo.z,tileInfo.x,tileInfo.y);
        vt.setData(pbuf, function(err) {
            if (err) throw err;
            query(vt, queryPoints, layer, fields, tolerance, callback);
        });
    } else {
        outputData = [];
        for (var i = 0; i < queryPoints.length; i++) {
            var output = {
                id: pointIDs[i],
                latlng: {
                    lat: queryPoints[i][1],
                    lng: queryPoints[i][0]
                }
            };
            for (var f=0; f<fields.length; f++) {
                output[fields[f]] = null;
            }
            outputData.push(output);
        }
        return callback(null, outputData);
    }
}

function multiQuery(dataArr,options,callback) {

    var fillNulls = options.fill !== undefined ? options.fill : false;

    function queriesDone(err, queries) {
        if (err) return callback(err);

        var dataOutput = [];
        dataOutput = dataOutput.concat.apply(dataOutput, queries);
        dataOutput.sort(sortBy('id'));

        if (fillNulls) {
            for (var f = 0; f < options.fields.length; f++) {
                filler.interpolateNulls(dataOutput, options.fields[f]);
            }
        }
        return callback(null, dataOutput);
    }

    var queryQueue = new async();

    for (var i = 0; i<dataArr.length; i++) {
        queryQueue.defer(queryTile, dataArr[i].data, dataArr[i].zxy, dataArr[i].points, dataArr[i].pointIDs, options);
    }

    queryQueue.awaitAll(queriesDone);
}

function convert(queryPoints, pointIDs, fields, interpolate, data) {
    if (data.features) {
        for (var k = 0; k < data.features.length; k++) {
            data.features[k].attr = data.features[k].attributes();
        }
    }

    var fieldsLength = fields.length;
    var converted = [];
    for (var i = 0; i < data.hits.length; i++) {
        var res = {
            id: pointIDs[i],
            latlng: {
                lat: queryPoints[i][1],
                lng: queryPoints[i][0]
            }
        };

        var hit = data.hits[i] || [];

        if (hit.length > 1 && hit[hit.length - 1].distance !== 0 && interpolate === true) {
            for (var j = 0; j < fieldsLength; j++) {
                var field = fields[j];
                var val0 = data.features[hit[0].feature_id].attr[field];
                var val1 = data.features[hit[1].feature_id].attr[field];
                if (isNaN(val0)) {
                    res[field] = val0;
                } else {
                    res[field] = val1 + (val0 - val1) * (hit[1].distance / (hit[0].distance + hit[1].distance));
                }
            }
        } else if (hit.length < 1) {
            for (var j = 0; j < fieldsLength; j++) {
                var field = fields[j];
                res[field] = null;
            }
        } else if (hit.length === 1 || interpolate === false) {
            for (var j = 0; j < fieldsLength; j++) {
                var field = fields[j];
                res[field] = data.features[hit[0].feature_id].attr[field];
            }
        } else if (hit[hit.length - 1].distance === 0) {
            for (var j = 0; j < fieldsLength; j++) {
                hit.sort(sortBy('feature_id'));
                var field = fields[j];
                res[field] = data.features[hit[hit.length - 1].feature_id].attr[field];
            }
        }

        converted.push(res);
    }
    return converted;
}

module.exports = {
    buildQuery: buildQuery,
    convert: convert,
    queryTile: queryTile,
    loadTiles: loadTiles,
    changeNumberTilesLoaded: changeNumberTilesLoaded,
    multiQuery: multiQuery
};
