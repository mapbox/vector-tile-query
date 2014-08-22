var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var sm = new sphericalmercator();
var async = require('queue-async');

function sortBy(sortField) {
    return function sortCallback(a, b) {
        var ad = a[sortField] || 0;
        var bd = b[sortField] || 0;
        return ad < bd ? -1 : ad > bd ? 1 : 0;
    };
}

function loadTiles(queryPoints, zoom, loadFunction, callback) {

    if (!queryPoints[0].length) return callback(new Error("Invalid query points"));

    function loadTileAsync(tileObj, loadFunction, callback) {
        loadFunction(tileObj.zxy, function(err, data) {
            if (err) return callback(new Error('Tile not loaded'));
            tileObj.data = data;
            return callback(null, tileObj);
        });
    }

    function loadDone(err, tileObj) {
        if (err) return callback(err, null);
        return callback(null, tileObj);
    }

    function buildQuery(points, zoom) {
        var queryObject = {};
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
            } else {
                queryObject[tileName].points.push([points[i][1], points[i][0]]);
                queryObject[tileName].pointIDs.push(i);
            }
        }
        return queryObject;
    }

    var tilePoints = buildQuery(queryPoints, zoom);
    var loadQueue = new async();

    for (var i in tilePoints) {
        loadQueue.defer(loadTileAsync, tilePoints[i], loadFunction);
    }

    loadQueue.awaitAll(loadDone);
}

function queryTile(pbuf, tileInfo, queryPoints, pointIDs, options, callback) {

    function buildResponse(id, point, fieldNames, fieldValue) {
        var respOutput = {
            id: id,
            latlng: {
                lat: point[1],
                lng: point[0]
            }
        };
        for (var f = 0; f < fieldNames.length; f++) {
            respOutput[fieldNames[f]] = fieldValue[f];
        }
        return respOutput;
    }

    function query(vt, queryPoints, layer, fields, tolerance) {
        var outputData = [];
        var data = vt.queryMany(queryPoints, {
            layer: layer,
            tolerance: tolerance
        });


        for (var i = 0; i < Object.keys(data).length; i++) {
            var currentPoint = data[i];
            var tileLength = currentPoint.length;
            var topFeatureDistance = currentPoint[tileLength - 1].distance;
            var queryPointOutput;

            if (tileLength > 1 && topFeatureDistance !== 0) {
                var fieldValues = [];
                for (var f = 0; f < fields.length; f++) {
                    if (typeof currentPoint[0].feature.attributes()[fields[f]] === 'string') {
                        calculateValue = currentPoint[0].feature.attributes()[fields[f]];
                    } else {
                        var distanceRatio = currentPoint[1].distance / (currentPoint[0].distance + currentPoint[1].distance);
                        var queryDifference = (currentPoint[0].feature.attributes()[fields[f]] - currentPoint[1].feature.attributes()[fields[f]]);
                        var calculateValue = currentPoint[1].feature.attributes()[fields[f]] + queryDifference * distanceRatio;
                    }
                    fieldValues.push(calculateValue);
                }
                queryPointOutput = buildResponse(pointIDs[i], queryPoints[i], fields, fieldValues);

            } else if (tileLength < 1) {
                var fieldValues = [];
                for (var f = 0; f < fields.length; f++) {
                    fieldValues.push(null);
                }
                queryPointOutput = buildResponse(pointIDs[i], queryPoints[i], fields, fieldValues);

            } else if (tileLength === 1) {
                var fieldValues = [];
                for (var f = 0; f < fields.length; f++) {
                    fieldValues.push(data[0].feature.attributes()[fields[f]])
                }
                queryPointOutput = buildResponse(pointIDs[i], queryPoints[i], fields, fieldValues);

            } else if (topFeatureDistance === 0) {
                var fieldValues = [];
                for (var f = 0; f < fields.length; f++) {
                    fieldValues.push(currentPoint[0].feature.attributes()[fields[f]])
                }
                queryPointOutput = buildResponse(pointIDs[i], queryPoints[i], fields, fieldValues);

            }
            outputData.push(queryPointOutput);
        }
        return outputData;
    }

    var outputData;

    if (options.fields) {
        var fields = options.fields;
    } else {
        return callback(new Error('Field(s) not specified'));
    }

    if (options.layer) {
        var layer = options.layer;
    } else {
        return callback(new Error('No layer specified'));
    }

    var tolerance = options.tolerance || 10;

    if (fields && fields.length === 0) {
        callback(new Error('Field array empty'));
    }

    if (Object.keys(pbuf).length !== 0) {
        var vt = new mapnik.VectorTile(tileInfo.z, tileInfo.x, tileInfo.y);
        vt.setData(pbuf);
        vt.parse(function(err) {
            if (err) return callback(err);
            outputData = query(vt, queryPoints, layer, fields, tolerance);
            return callback(null, outputData);
        });
    } else {
        outputData = [];
        for (var i = 0; i < queryPoints.length; i++) {
            var fieldValues = [];
            for (var f = 0; f < fields.length; f++) {
                fieldValues.push(null);
            }
            queryPointOutput = buildResponse(pointIDs[i], queryPoints[i], fields, fieldValues);
            outputData.push(queryPointOutput);
        }
        return callback(null, outputData);
    }
}

function multiQuery(dataArr, options, callback) {

    function queryEach(data, callback) {
        queryTile(data.data, data.zxy, data.points, data.pointIDs, options, function(err, queryData) {
            if (err) return callback(err);
            return callback(null, queryData);
        });
    }

    function queriesDone(err, queries) {
        if (err) return callback(err);
        var dataOutput = [];
        dataOutput = dataOutput.concat.apply(dataOutput, queries);
        dataOutput.sort(sortBy('id'));
        return callback(null, dataOutput);
    }

    var queryQueue = new async();

    for (var i = 0; i < dataArr.length; i++) {
        queryQueue.defer(queryEach, dataArr[i]);
    }

    queryQueue.awaitAll(queriesDone);
}

module.exports = {
    queryTile: queryTile,
    loadTiles: loadTiles,
    multiQuery: multiQuery
};
