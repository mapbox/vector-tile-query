var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var async = require('queue-async');
var request = require('request');
var zlib = require('zlib');
var concat = require('concat-stream');
var async = require('queue-async');
var fs = require('fs');
var sm = new sphericalmercator();

module.exports = function loadVT(mapid, layer, attribute, skipVal, queryData, callback) {
    var timeBegin = new Date();
    var VTs = {};
    var tileQueue = new async(100);
    var dataQueue = new async(100);
    var z = 14;
    var maximum = 3000;
    var tolerance = 1;

    function interpolateBetween(frPoint, toPoint, valueName) {
        var valueRange = frPoint[valueName] - toPoint[valueName];

        var idRange = toPoint.id - frPoint.id;
        var outPoints = [];
        for (var i = 1; i < idRange; i++) {
            var cID = frPoint.id + i;
            outPoints.push({
                latlng: {
                    lat: queryData[[cID]][0],
                    lng: queryData[[cID]][1]
                },
                value: (1 - (i / idRange)) * valueRange + toPoint[valueName],
                id: cID
            });

            outPoints[i - 1][valueName] = outPoints[i - 1].value;

        }
        return outPoints;
    }

    function euclideanDistance(fr, to) {
        a = sm.forward([fr.lng, fr.lat]);
        b = sm.forward([to.lng, to.lat]);
        var x = a[0] - b[0],
            y = a[1] - b[1];
        return Math.sqrt((x * x) + (y * y));
    };

    function loadDone(err, response) {
        for (var i in tilePoints) {
            dataQueue.defer(findMultiplePoints, tilePoints[i].points, tilePoints[i].pointIDs, i);
        }

        dataQueue.awaitAll(multiQueryDone);
    }

    function multiQueryDone(err, response) {
        var dataOutput = [];
        dataOutput = dataOutput.concat.apply(dataOutput, response);
        dataOutput.sort(function(a, b) {
            var ad = a.id || 0;
            var bd = b.id || 0;
            return ad < bd ? -1 : ad > bd ? 1 : 0;
        });
        if (skipVal > 1) {
            var interOutput = [dataOutput[0]];
            for (var i = 1; i < dataOutput.length; i++) {
                interOutput = interOutput.concat(interpolateBetween(dataOutput[i - 1], dataOutput[i], attribute));
                interOutput.push(dataOutput[i])
            }
            dataOutput = interOutput;
        }

        dataOutput[0].distance = 0;
        for (var i = 1; i < dataOutput.length; i++) {
            dataOutput[i].distance = euclideanDistance(dataOutput[i - 1].latlng, dataOutput[i].latlng) + dataOutput[i - 1].distance;
        }
        return callback(null, {
            queryTime: new Date() - timeBegin,
            results: dataOutput
        });
    }

    function loadTiles(tileID, callback) {
        var tileName = tileID.z + '/' + tileID.x + '/' + tileID.y;

        var options = {
            url: 'https://b.tiles.mapbox.com/v3/' + mapid + '/' + tileID.z + '/' + tileID.x + '/' + tileID.y + '.vector.pbf'
        };

        var req = request(options);

        req.on('error', function(err) {
            res.json({
                Error: error
            })
        });

        req.pipe(zlib.createInflate()).pipe(concat(function(data) {
            var vtile = new mapnik.VectorTile(tileID.z, tileID.x, tileID.y);
            vtile.setData(data);
            vtile.parse();
            VTs[tileName] = vtile;
            return callback(null);
        }));
    }

    function findMultiplePoints(lonlats, IDs, vtile, callback) {

        var data = VTs[vtile].queryMany(lonlats, {
            layer: layer,
            tolerance: 1000000
        });

        var outPutData = [];

        for (var i = 0; i < data.length; i++) {
            var currentPoint = data[i];
            var tileLength = currentPoint.length;

            if (tileLength > 1) {
                currentPoint.sort(function(a, b) {
                    var ad = a.distance || 0;
                    var bd = b.distance || 0;
                    return ad < bd ? -1 : ad > bd ? 1 : 0;
                });

                var queryPointOutput = {
                    latlng: {
                        lat: lonlats[i][1],
                        lng: lonlats[i][0]
                    },
                    value: [currentPoint[0].attributes()[attribute], currentPoint[1].attributes()[attribute]],
                    featureDistance: [currentPoint[0].distance, currentPoint[1].distance],
                    id: IDs[i]
                };

                var distanceRatio = queryPointOutput.featureDistance[1] / (queryPointOutput.featureDistance[0] + queryPointOutput.featureDistance[1]);
                var queryDifference = (queryPointOutput.value[0] - queryPointOutput.value[1]);
                var calculateValue = queryPointOutput.value[1] + queryDifference * distanceRatio;
                queryPointOutput[attribute] = calculateValue;

            } else if (tileLength < 1) {
                var queryPointOutput = {
                    latlng: {
                        lat: lonlats[i][1],
                        lng: lonlats[i][0]
                    },
                    value: 0,
                    featureDistance: -999,
                    id: IDs[i]
                };
                queryPointOutput[attribute] = queryPointOutput.value;
                var pass = true;
            } else if (tileLength === 1) {
                var queryPointOutput = {
                    latlng: {
                        lat: lonlats[i][1],
                        lng: lonlats[i][0]
                    },
                    value: currentPoint[0].attributes()[attribute],
                    featureDistance: currentPoint[0].distance,
                    id: IDs[i]
                };
                queryPointOutput[attribute] = queryPointOutput.value;
            }
            outPutData.push(queryPointOutput);
        }

        callback(null, outPutData);
    }
    var tilePoints = {};
    var pointTileName = [];

    for (var i = 0; i < queryData.length; i += skipVal) {
        var xyz = sm.xyz([queryData[i][1], queryData[i][0], queryData[i][1], queryData[i][0]], z);
        var tileName = z + '/' + xyz.minX + '/' + xyz.minY;
        pointTileName.push(tileName);
        if (tilePoints[tileName] === undefined) {
            tilePoints[tileName] = {
                zxy: {
                    z: z,
                    x: xyz.minX,
                    y: xyz.minY
                },
                points: [
                    [queryData[i][1], queryData[i][0]]
                ],
                pointIDs: [i]

            };
        } else {
            tilePoints[tileName].points.push([queryData[i][1], queryData[i][0]]);
            tilePoints[tileName].pointIDs.push(i)
        }
    }
    if (i != queryData.length - 1 && skipVal > 1) {
        tilePoints[tileName].points.push([queryData[queryData.length - 1][1], queryData[queryData.length - 1][0]]);
        tilePoints[tileName].pointIDs.push(queryData.length - 1)
    }
    for (var i in tilePoints) {
        tileQueue.defer(loadTiles, tilePoints[i].zxy);
    }
    tileQueue.awaitAll(loadDone);
}
