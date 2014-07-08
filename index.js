var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var async = require('queue-async');
var request = require('request');
var zlib = require('zlib');
var concat = require('concat-stream');
var async = require('queue-async');
var fs = require('fs');
var polyline = require('polyline');
var sm = new sphericalmercator();

module.exports = function loadVT(source, layer, attribute, format, skipVal, queryData, callback) {
    var timeBegin = new Date();
    var VTs = {};
    var tileQueue = new async(100);
    var dataQueue = new async(100);
    var z = 14;
    var maximum = 350;
    var tolerance = 1;
    var decodedPoly = [];
    if (format === 'encoded_polyline') {
        decodedPoly = polyline.decode(queryData);
    } else if (format === 'points') {
        decodedPoly = formatPoints(queryData);
    } else {
        decodedPoly = queryData;
    }

    if (decodedPoly.length > maximum) {
        throw 'Too many points';
    }

    function formatPoints(points, callback) {
        var formattedPointed = [];
        points.split(';').map(function(x) {
            formattedPointed.push([parseFloat(x.split(',')[1]), parseFloat(x.split(',')[0])]);
        });
        return formattedPointed;
    }

    function interpolateBetween(frPoint,toPoint,valueName) {
        var valueRange = frPoint[valueName]-toPoint[valueName];
        
        var idRange = toPoint.id-frPoint.id;
        var outPoints = [];
        for (var i=1; i<idRange; i++) {
            var cID = frPoint.id+i;
            outPoints.push({
                latlng: {
                    lat: decodedPoly[[cID]][0],
                    lng: decodedPoly[[cID]][1]
                },
                value: (1-(i/idRange))*valueRange+toPoint[valueName],
                id: cID
            });

            outPoints[i-1][valueName] = outPoints[i-1].value;

        }
        return outPoints;
    }

    function euclideanDistance(fr, to) {
        a = sm.forward([fr.lng,fr.lat]);
        b = sm.forward([to.lng,to.lat]);
        var x = a[0] - b[0], y = a[1] - b[1];
        return Math.sqrt((x * x) + (y * y));
    };

    function loadDone(err, response) {
        for (var i in tilePoints) {
            dataQueue.defer(findMultiplePoints, tilePoints[i].points, tilePoints[i].pointIDs, i);
        }
        dataQueue.awaitAll(multiQueryDone);
    }

    function multiQueryDone(err, response) {
        var startDone = new Date();
        var dataOutput = [];
        dataOutput = dataOutput.concat.apply(dataOutput, response);
        dataOutput.sort(function(a, b) {
            var ad = a.id || 0;
            var bd = b.id || 0;
            return ad < bd ? -1 : ad > bd ? 1 : 0;
        });
        if (skipVal > 1) {
            var interOutput = [dataOutput[0]];
            for (var i = 1; i<dataOutput.length; i++) {
                interOutput = interOutput.concat(interpolateBetween(dataOutput[i-1],dataOutput[i],attribute));
                interOutput.push(dataOutput[i])
            }
            dataOutput = interOutput;
        }
        dataOutput[0].distance = 0;
        for (var i = 1; i < dataOutput.length; i++) {
            dataOutput[i].distance = euclideanDistance(dataOutput[i-1].latlng,dataOutput[i].latlng)+dataOutput[i-1].distance;
        }
        return callback(null, {
            queryTime: new Date() - timeBegin,
            results: dataOutput
        });
    }

    function loadTiles(tileID, callback) {
        var queryStart = new Date();
        var tileName = tileID.z + '/' + tileID.x + '/' + tileID.y;

        if (source === 'remote') {
            var options = {
                url: 'https://b.tiles.mapbox.com/v3/mapbox.mapbox-terrain-v1/' + tileID.z + '/' + tileID.x + '/' + tileID.y + '.vector.pbf'
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

        } else if (source === 'local') {
            fs.readFile(__dirname + '/tiles/' + tileName + '.vector.pbf', function(err, tileData) {
                if (err) throw err;

                var vtile = new mapnik.VectorTile(tileID.z, tileID.x, tileID.y);
                vtile.setData(tileData);
                vtile.parse();
                VTs[tileName] = vtile;
                return callback(null);
            });

        } else {
            return false;
        }
    }

    function findMultiplePoints(lonlats, IDs, vtile, callback) {

        var data = VTs[vtile].queryMany(lonlats, {
            layer: layer
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
                var heightDifference = (queryPointOutput.value[0] - queryPointOutput.value[1]);
                var calculateElevation = queryPointOutput.value[1] + heightDifference * distanceRatio;
                queryPointOutput[attribute] = calculateElevation;

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

    for (var i = 0; i < decodedPoly.length; i += skipVal) {
        var xyz = sm.xyz([decodedPoly[i][1], decodedPoly[i][0], decodedPoly[i][1], decodedPoly[i][0]], z);
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
                    [decodedPoly[i][1], decodedPoly[i][0]]
                ],
                pointIDs: [i]

            };
        } else {
            tilePoints[tileName].points.push([decodedPoly[i][1], decodedPoly[i][0]]);
            tilePoints[tileName].pointIDs.push(i)
        }
    }
    if (i != decodedPoly.length-1 && skipVal > 1) {
        tilePoints[tileName].points.push([decodedPoly[decodedPoly.length-1][1], decodedPoly[decodedPoly.length-1][0]]);
        tilePoints[tileName].pointIDs.push(decodedPoly.length-1)
    }
    for (var i in tilePoints) {
        tileQueue.defer(loadTiles, tilePoints[i].zxy);
    }

    tileQueue.awaitAll(loadDone);
}
