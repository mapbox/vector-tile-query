var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var sm = new sphericalmercator();
var async = require('queue-async');

function loadTiles(queryPoints, zoom, loadFunction, callback) {
    var tilePoints = {};
    for (var i = 0; i < queryPoints.length; i++) {
        var xyz = sm.xyz([queryPoints[i][0], queryPoints[i][1], queryPoints[i][0], queryPoints[i][1]], zoom);
        var tileName = zoom + '/' + xyz.minX + '/' + xyz.minY;
        if (tilePoints[tileName] === undefined) {
            tilePoints[tileName] = {
                zxy: {
                    z: zoom,
                    x: xyz.minX,
                    y: xyz.minY
                },
                points: [
                    [queryPoints[i][0], queryPoints[i][1]]
                ],
                pointIDs: [i]

            };
        } else {
            tilePoints[tileName].points.push([queryPoints[i][0], queryPoints[i][1]]);
            tilePoints[tileName].pointIDs.push(i);
        }
    }
    function loader(tileObj, loadFunc, callback) {
        loadFunc(tileObj.zxy, function(err, data) {
            if (err) throw err;
            tileObj.data = data;
            callback(null, tileObj);
        });
    }

    function loadDone(err, tileObj) {
        return callback(null,tileObj);
    }

    var tileQueue = new async();
    for (var t in tilePoints) {
        tileQueue.defer(loader, tilePoints[t],loadFunction);
    }
    tileQueue.awaitAll(loadDone);
}

function queryVT(vtilePbuf, tileInfo, queryPoints, pointIDs, options, callback) {
    var data;
    var outputData = [];
    var field = options.field;
    var layer = options.layer;
    var tolerance = options.tolerance || 10;

    var vt = new mapnik.VectorTile(tileInfo.z,tileInfo.x,tileInfo.y);

    vt.setData(vtilePbuf);

    vt.parse();

    function sortCallback(a, b) {
        var ad = a.distance || 0;
        var bd = b.distance || 0;
        return ad < bd ? -1 : ad > bd ? 1 : 0;
    }

    function buildResponse(id,point,fieldName,fieldValue) {
        var respOutput = {
            id: id,
            latlng: {
                lat: point[1],
                lng: point[0]
            }
        }
        respOutput[fieldName] = fieldValue;
        return respOutput
    }

    try {
        data = vt.queryMany(queryPoints, {
            layer: layer,
            tolerance: tolerance
        });

        for (var d = 0; d < Object.keys(data.hits).length; d++) {
            data.hits[d].sort(sortCallback);
            var currentPoint = data.hits[d];
            var allData = data.features;
            var tileLength = currentPoint.length;
            var topFeatureDistance = currentPoint[tileLength - 1].distance;
            var queryPointOutput;

            if (tileLength > 1 && topFeatureDistance !== 0) {
                var distanceRatio = currentPoint[1].distance / (currentPoint[0].distance + currentPoint[1].distance);
                var queryDifference = (allData[data.hits[d][0].feature_id].attributes()[field] - allData[data.hits[d][1].feature_id].attributes()[field]);
                var calculateValue = allData[data.hits[d][1].feature_id].attributes()[field] + queryDifference * distanceRatio;

                queryPointOutput = buildResponse(pointIDs[d],queryPoints[d],field,calculateValue);

            } else if (tileLength < 1) {
                queryPointOutput = buildResponse(pointIDs[d],queryPoints[d],field,null);

            } else if (tileLength === 1) {
                queryPointOutput = buildResponse(pointIDs[d],queryPoints[d],field,allData[data.hits[d][0].feature_id].attributes()[field])

            } else if (topFeatureDistance === 0) {
                queryPointOutput = buildResponse(pointIDs[d],queryPoints[d],field,allData[data.hits[d][tileLength - 1].feature_id].attributes()[field])

            }
            outputData.push(queryPointOutput);
        }

    } catch (err) {
        if (err == 'Error: Could not find layer in vector tile') {
            for (var d = 0; d < queryPoints.length; d++) {
                queryPointOutput = buildResponse(pointIDs[d],queryPoints[d],field,null);
                outputData.push(queryPointOutput);
            }
            return callback(null, outputData);
        } else {
            return callback(err, null);
        }
    }

    callback(null, outputData);
}

module.exports = {
    queryVT: queryVT,
    loadTiles: loadTiles
};