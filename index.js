var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var sm = new sphericalmercator();
var async = require('queue-async');
var _ = require('lodash');
var lynx = require('lynx');
var metrics = new lynx('localhost', 8125, {scope: 'api.vector-tile-query-async-2'});

function sortBy(sortField) {
    return function sortCallback(a, b) {
        var ad = a[sortField] || 0;
        var bd = b[sortField] || 0;
        return ad < bd ? -1 : ad > bd ? 1 : 0;
    };
}

function loadTiles(queryPoints, zoom, loadFunction, callback) {

    if (!queryPoints[0].length) return callback(new Error('Invalid query points'));

    function loadTileAsync(tileObj, loadFunction, callback) {
        var loadTileAsyncTimer = metrics.createTimer('loadTileAsync.time');
        loadFunction(tileObj.zxy, function(err, data) {
            loadTileAsyncTimer.stop();
            if (err) return callback(err);
            tileObj.data = data;
            return callback(null, tileObj);
        });
    }

    function buildQuery(points, zoom) {
        var buildQueryTimer = metrics.createTimer('buildQuery.time');
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
        buildQueryTimer.stop();
        return output;
    }

    var tilePoints = buildQuery(queryPoints,zoom);
    var loadQueue = new async();

    for (var i = 0; i < tilePoints.length; i++) {
        metrics.increment('loadTileAsync.increment', 1);
        loadQueue.defer(loadTileAsync,tilePoints[i],loadFunction);
    }

    loadQueue.awaitAll(callback);
}

function queryTile(pbuf, tileInfo, queryPoints, pointIDs, options, callback) {

    function createEmptyResponse(respLength, callback) {
            var data = {
                hits: {}
            };
            for (var i = 0; i < respLength; i++) {
                data.hits[i] = [];
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

    if (Object.keys(pbuf).length !== 0) {
        var parseTimer = metrics.createTimer('parse.time');
        var vt = new mapnik.VectorTile(tileInfo.z,tileInfo.x,tileInfo.y);
        vt.setData(pbuf);
        vt.parse(function(err) {
            if (err) return callback(err);
            query(vt, queryPoints,layer,fields, tolerance, callback);
            parseTimer.stop();
        });
    } else {
        outputData = [];
        var createJSONTimer = metrics.createTimer('createJSONTimer.time');
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
        createJSONTimer.stop();
        return callback(null, outputData);
    }
}

function multiQuery(dataArr,options,callback) {
    var multiQueryTimer = metrics.createTimer('multiQuery.time');
    function queriesDone(err, queries) {
        var queriesDoneTimer = metrics.createTimer('queriesDone.time');
        multiQueryTimer.stop();
        if (err) return callback(err);
        var dataOutput = [];
        dataOutput = dataOutput.concat.apply(dataOutput, queries);
        var sortTimer = metrics.createTimer('sort.time');
        dataOutput.sort(sortBy('id'));
        sortTimer.stop();
        queriesDoneTimer.stop();
        return callback(null, dataOutput);
    }

    var queryTileTimer = metrics.createTimer('queryTileTimer');
    var queryQueue = new async();

    for (var i = 0; i<dataArr.length; i++) {
        metrics.increment('queryTile.increment', 1);
        queryQueue.defer(queryTile, dataArr[i].data, dataArr[i].zxy, dataArr[i].points, dataArr[i].pointIDs, options);
    }

    queryQueue.awaitAll(queriesDone);
    queryTileTimer.stop();
}

// Convert raw results from vt.queryMany into formatted output.
function convert(queryPoints, pointIDs, fields, interpolate, data) {
    if (data.features) {
        var getAttributesTimer = metrics.createTimer('getAttributes.time');
        for (var k in data.features) {
            data.features[k].attr = data.features[k].attributes();
        }
        getAttributesTimer.stop();
    }

    var fieldsLength = fields.length;
    var converted = [];
    var hitsForLoopTimer = metrics.createTimer('hitsForLoop.time');
    for (var i in data.hits) {
        var res = {
            id: pointIDs[i],
            latlng: {
                lat: queryPoints[i][1],
                lng: queryPoints[i][0]
            }
        };

        var hit = data.hits[i];
        var ifChecksTimer = metrics.createTimer('ifChecksTimer.time');
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
                var field = fields[j];
                res[field] = data.features[hit[hit.length - 1].feature_id].attr[field];
            }
        }
        ifChecksTimer.stop();

        converted.push(res);
    }
    hitsForLoopTimer.stop();
    return converted;
}

module.exports = {
    convert: convert,
    queryTile: queryTile,
    loadTiles: loadTiles,
    multiQuery: multiQuery
};
