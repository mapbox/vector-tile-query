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

        return callback(null, {
            queryTime: new Date() - timeBegin,
            results: dataOutput
        });
    }

    function loadTiles(tileID, callback) {
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
                    featureDistance: (currentPoint[0].distance + currentPoint[1].distance) / 2,
                    id: IDs[i]
                };
                var distanceRatio = currentPoint[1].distance / (currentPoint[0].distance + currentPoint[1].distance);
                var queryDifference = (currentPoint[0].attributes()[attribute] - currentPoint[1].attributes()[attribute]);
                var calculateValue = currentPoint[1].attributes()[attribute] + queryDifference * distanceRatio;
                queryPointOutput[attribute] = calculateValue;

            } else if (tileLength < 1) {
                var queryPointOutput = {
                    latlng: {
                        lat: lonlats[i][1],
                        lng: lonlats[i][0]
                    },
                    featureDistance: -999,
                    id: IDs[i]
                };
                queryPointOutput[attribute] = 0;
                var pass = true;
            } else if (tileLength === 1) {
                var queryPointOutput = {
                    latlng: {
                        lat: lonlats[i][1],
                        lng: lonlats[i][0]
                    },
                    featureDistance: currentPoint[0].distance,
                    id: IDs[i]
                };
                queryPointOutput[attribute] = currentPoint[0].attributes()[attribute];
            }
            outPutData.push(queryPointOutput);
        }

        callback(null, outPutData);
    }
    var tilePoints = {};

    for (var i = 0; i < decodedPoly.length; i++) {
        var xyz = sm.xyz([decodedPoly[i][1], decodedPoly[i][0], decodedPoly[i][1], decodedPoly[i][0]], z);
        var tileName = z + '/' + xyz.minX + '/' + xyz.minY;
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

    for (var i in tilePoints) {
        tileQueue.defer(loadTiles, tilePoints[i].zxy);
    }
    tileQueue.awaitAll(loadDone);
}
