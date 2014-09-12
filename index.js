var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var sm = new sphericalmercator();
var async = require('queue-async');
var _ = require('lodash');

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
        loadFunction(tileObj.zxy, function(err, data) {
            if (err) return callback(err);
            tileObj.data = data;
            return callback(null, tileObj);
        });
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

    var tilePoints = buildQuery(queryPoints,zoom);
    var loadQueue = new async();

    for (var i = 0; i < tilePoints.length; i++) {
        loadQueue.defer(loadTileAsync,tilePoints[i],loadFunction);
    }

    loadQueue.awaitAll(callback);
}

function queryTile(pbuf, tileInfo, queryPoints, pointIDs, options, callback) {

    function createNulls() {
        return null;
    }

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
        var processed = _.values(data.hits).map(function(hit) {
            hit.sort(sortBy('distance'));
            if (hit.length > 1 && hit[hit.length - 1].distance !== 0 && interpolate === true) {
                return fields.map(function(field) {
                    if (isNaN(data.features[hit[0].feature_id].attributes()[field])) {
                        return data.features[hit[0].feature_id].attributes()[field];
                    } else {
                        var distanceRatio = hit[1].distance / (hit[0].distance + hit[1].distance);
                        var queryDifference = (data.features[hit[0].feature_id].attributes()[field] - data.features[hit[1].feature_id].attributes()[field]);
                        return data.features[hit[1].feature_id].attributes()[field] + queryDifference * distanceRatio;
                    }
                });
            } else if (hit.length < 1) {
                return fields.map(createNulls);
            } else if (hit.length === 1 || interpolate === false) {
                return fields.map(function(field) {
                    return data.features[hit[0].feature_id].attributes()[field];
                });
            } else if (hit[hit.length - 1].distance === 0) {
                return fields.map(function(field) {
                    return data.features[hit[hit.length - 1].feature_id].attributes()[field];
                });
            }
        }).map(function(fieldValues, i) {
            var output = {
                id: pointIDs[i],
                latlng: {
                    lat: queryPoints[i][1],
                    lng: queryPoints[i][0]
                }
            };
            for (var f=0; f<fields.length; f++) {
                output[fields[f]] = fieldValues[f];
            }
            return output;
        });
        return callback(null, processed);
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
        var vt = new mapnik.VectorTile(tileInfo.z,tileInfo.x,tileInfo.y);
        vt.setData(pbuf);
        vt.parse(function(err) {
            if (err) return callback(err);
            query(vt, queryPoints,layer,fields, tolerance, callback);
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

    function queriesDone(err, queries) {
        if (err) return callback(err);
        var dataOutput = [];
        dataOutput = dataOutput.concat.apply(dataOutput, queries);
        dataOutput.sort(sortBy('id'));
        return callback(null, dataOutput);
    }

    var queryQueue = new async();

    for (var i = 0; i<dataArr.length; i++) {
        queryQueue.defer(queryTile, dataArr[i].data, dataArr[i].zxy, dataArr[i].points, dataArr[i].pointIDs, options);
    }

    queryQueue.awaitAll(queriesDone);
}

module.exports = {
    queryTile: queryTile,
    loadTiles: loadTiles,
    multiQuery: multiQuery
};
