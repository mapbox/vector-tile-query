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

module.exports = function loadVT(source, layer, attribute, format, queryData, callback) {
    var allStart = new Date();
    var VTs = {};
    var skipVal = 1;
    var tileQueue = new async(100);
    var multiQueryQueue = new async(100);
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
        // for (var i = 0; i < decodedPoly.length; i++) {
        //     multiQueryQueue.defer(queryIsoSurface, decodedPoly[i], pointTileName[i]);
        // }
        for (var i in tilePoints) {
            multiQueryQueue.defer(queryIsoSurfaceMulti, tilePoints[i].points, tilePoints[i].pointIDs, i);
        }
        multiQueryQueue.awaitAll(multiQueryDone);
    }

    function queryDone(err, response) {
        return callback(null, {
            queryTime: new Date() - allStart,
            results: response
        });
    }

    function multiQueryDone(err, response) {
        var startDone = new Date();
        var elevOutput = [];
        elevOutput = elevOutput.concat.apply(elevOutput, response);
        elevOutput.sort(function(a, b) {
            var ad = a.id || 0;
            var bd = b.id || 0;
            return ad < bd ? -1 : ad > bd ? 1 : 0;
        });
        return callback(null, {
            queryTime: new Date() - allStart,
            results: elevOutput
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

    function queryIsoSurface(lonlat, vtile, callback) {
        var lon = lonlat[1];
        var lat = lonlat[0];

        try {
            var data = VTs[vtile].query(lon, lat, {
                layer: layer
            });
            var tileLength = data.length;
        } catch (err) {
            return callback(err);
        }

        for (var i = 0; i < data.length; i++) {
            var tileLength = data[i].length;
            if (tileLength > 1) {
                data[i].sort(function(a, b) {
                    var ad = a.distance || 0;
                    var bd = b.distance || 0;
                    return ad < bd ? -1 : ad > bd ? 1 : 0;
                });

                var distRatio = data[i][1].distance / (data[i][0].distance + data[i][1].distance);
                var valueDiff = (data[i][0].attributes()[attribute] - data[i][1].attributes().attribute);
                var interpolatedValue = data[i][1].attributes()[attribute] + valueDiff * distRatio;

                var queryOutput = {
                    distance: (data[i][0].distance + data[i][1].distance) / 2,
                    lat: lat,
                    lon: lon,
                    value: interpolatedValue
                };

            } else if (tileLength < 1) {
                var queryOutput = {
                    distance: -999,
                    lat: lat,
                    lon: lon,
                    value: 0
                };
            } else if (tileLength === 1) {
                var queryOutput = {
                    distance: data[i][0].distance,
                    lat: lat,
                    lon: lon,
                    value: data[i][0].attributes()[attribute]
                };
            }
        }

        callback(null, queryOutput);
    }

    function queryIsoSurfaceMulti(lonlats, IDs, vtile, callback) {

        var data = VTs[vtile].queryMany(lonlats, {
            layer: layer
        });

        var outValues = [];

        for (var i = 0; i < data.length; i++) {
            var currData = data[i];
            var tileLength = currData.length;

            if (tileLength > 1) {
                currData.sort(function(a, b) {
                    var ad = a.distance || 0;
                    var bd = b.distance || 0;
                    return ad < bd ? -1 : ad > bd ? 1 : 0;
                });

                var distRatio = currData[1].distance / (currData[0].distance + currData[1].distance);
                var valueDiff = (currData[0].attributes()[attribute] - currData[1].attributes()[attribute]);
                var interpolatedValue = currData[1].attributes()[attribute] + valueDiff * distRatio;

                var queryOutput = {
                    distance: (currData[0].distance + currData[1].distance) / 2,
                    lat: lonlats[i][1],
                    lon: lonlats[i][0],
                    value: interpolatedValue
                };

            } else if (tileLength < 1) {
                var queryOutput = {
                    distance: -999,
                    lat: lonlats[i][1],
                    lon: lonlats[i][0],
                    value: 0
                };
            } else if (tileLength === 1) {
                var queryOutput = {
                    distance: currData[0].distance,
                    lat: lonlats[i][1],
                    lon: lonlats[i][0],
                    value: currData[0].attributes()[attribute],
                };
            }

            outValues.push(queryOutput);
        }

        callback(null, outValues);
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

    for (var i in tilePoints) {
        tileQueue.defer(loadTiles, tilePoints[i].zxy);
    }

    tileQueue.awaitAll(loadDone);
}
