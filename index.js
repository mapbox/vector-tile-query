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
    function loadTileAsync(tileObj, loadFunction, callback) {
        loadFunction(tileObj.zxy, function(err, data) {
            if (err) return callback(err,null);
            var vt = new mapnik.VectorTile(tileObj.zxy.z,tileObj.zxy.x,tileObj.zxy.y);
            vt.setData(data);
            vt.parse(function(err) {
                if (err) return callback(err,null);
                tileObj.data = vt;
                return callback(null, tileObj);
            });
        });
    }

    function loadDone(err, tileObj) {
        return callback(null,tileObj);
    }

    function buildQuery(points, zoom) {
        var queryObject = {};
        for (var i = 0; i < points.length; i++) {
            var xyz = sm.xyz([points[i][0], points[i][1], points[i][0], points[i][1]], zoom);
            var tileName = zoom + '/' + xyz.minX + '/' + xyz.minY;
            if (queryObject[tileName] === undefined) {
                queryObject[tileName] = {
                    zxy: {
                        z: zoom,
                        x: xyz.minX,
                        y: xyz.minY
                    },
                    points: [
                        [points[i][0], points[i][1]]
                    ],
                    pointIDs: [i]

                };
            } else {
                queryObject[tileName].points.push([points[i][0], points[i][1]]);
                queryObject[tileName].pointIDs.push(i);
            }
        }
        return queryObject;
    }

    var tilePoints = buildQuery(queryPoints,zoom);
    var loadQueue = new async();

    for (var i in tilePoints) {
        loadQueue.defer(loadTileAsync,tilePoints[i],loadFunction);
    }

    loadQueue.awaitAll(loadDone);
}

function queryTile(vt, tileInfo, queryPoints, pointIDs, options, callback) {

    function buildResponse(id,point,fieldName,fieldValue) {
        var respOutput = {
            id: id,
            latlng: {
                lat: point[1],
                lng: point[0]
            }
        };
        respOutput[fieldName] = fieldValue;
        return respOutput;
    }

    var data;
    var outputData = [];
    var field = options.field;
    var layer = options.layer;
    var tolerance = options.tolerance || 10;

    try {
        data = vt.queryMany(queryPoints, {
            layer: layer,
            tolerance: tolerance
        });

        for (var i = 0; i < Object.keys(data.hits).length; i++) {
            data.hits[i].sort(sortBy('distance'));
            var currentPoint = data.hits[i];
            var allData = data.features;
            var tileLength = currentPoint.length;
            var topFeatureDistance = currentPoint[tileLength - 1].distance;
            var queryPointOutput;

            if (tileLength > 1 && topFeatureDistance !== 0) {
                var distanceRatio = currentPoint[1].distance / (currentPoint[0].distance + currentPoint[1].distance);
                var queryDifference = (allData[data.hits[i][0].feature_id].attributes()[field] - allData[data.hits[i][1].feature_id].attributes()[field]);
                var calculateValue = allData[data.hits[i][1].feature_id].attributes()[field] + queryDifference * distanceRatio;
                queryPointOutput = buildResponse(pointIDs[i],queryPoints[i],field,calculateValue);

            } else if (tileLength < 1) {
                queryPointOutput = buildResponse(pointIDs[i],queryPoints[i],field,null);

            } else if (tileLength === 1) {
                queryPointOutput = buildResponse(pointIDs[i],queryPoints[i],field,allData[data.hits[i][0].feature_id].attributes()[field]);

            } else if (topFeatureDistance === 0) {
                queryPointOutput = buildResponse(pointIDs[i],queryPoints[i],field,allData[data.hits[i][tileLength - 1].feature_id].attributes()[field]);

            }
            outputData.push(queryPointOutput);
        }

    } catch (err) {
        if (err == 'Error: Could not find layer in vector tile') {
            for (var i = 0; i < queryPoints.length; i++) {
                queryPointOutput = buildResponse(pointIDs[i],queryPoints[i],field,null);
                outputData.push(queryPointOutput);
            }
            return callback(null, outputData);

        } else {
            return callback(err, null);
        }
    }

    return callback(null, outputData);
}

function multiQuery(dataArr,options,callback) {

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

    for (var i = 0; i<dataArr.length; i++) {
        queryQueue.defer(queryEach, dataArr[i]);
    }

    queryQueue.awaitAll(queriesDone);
}

module.exports = {
    queryTile: queryTile,
    loadTiles: loadTiles,
    multiQuery: multiQuery
};