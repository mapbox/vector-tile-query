var mapnik = require('./node_modules/mapnik');
var sphericalmercator = require('sphericalmercator');
var async = require('queue-async');
var request = require('request');
var zlib = require('zlib');
var concat = require('concat-stream');
var async = require('queue-async');
var fs = require('fs');
var polyline = require('polyline');
var sm = new sphericalmercator();

module.exports = function loadVT(source, format, elevation_data, callback) {
    var allStart = new Date();
    var VTs = {}
    var tileQueue = new async(100);
    var elevationQueue = new async(100);
    var z = 14;
    var tolerance = 1000;
    var decodedPoly = [];
    if (format === 'polyline') {
        decodedPoly = polyline.decode(elevation_data);
    } else if (format === 'path') {
        decodedPoly = formatPoints(elevation_data);
    } else {
        decodedPoly = elevation_data;
    }

    function formatPoints(points, callback) {
        var formattedPointed = [];
        points.split(';').map(function(x) {
            formattedPointed.push([parseFloat(x.split(',')[1]),parseFloat(x.split(',')[0])]);
        });
        return formattedPointed;
    }

    function loadDone(err, response) {
        for (var i = 0; i < decodedPoly.length; i++) {
            elevationQueue.defer(findElevations, decodedPoly[i], pointTileName[i]);
        }
        for (var i in tilePoints) {
            // defer to findElevationsMulti when ready
        }
        elevationQueue.awaitAll(queryDone);
    }

    function queryDone(err, response) {
        return callback(null, {
            queryTime: new Date() - allStart,
            results: response
        });
    }

    function multiQueryDone(err,response) {
        var elevOutput = [];
        elevOutput.concat.apply(elevOutput,response);
        elevOutput.sort(function(a, b) {
            var ad = a.id || 0;
            var bd = b.id || 0;
            return ad < bd ? -1 : ad > bd ? 1 : 0;
        });
        return callback(null)

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

    function findElevations(lonlat, vtile, callback) {
        var lon = lonlat[1];
        var lat = lonlat[0];

        try {
            var data = VTs[vtile].query(lon, lat, {
                layer: 'contour'
            });
            var tileLength = data.length;
        } catch (err) {
            return callback(err);
        }

        if (tileLength > 1) {

            data.sort(function(a, b) {
                var ad = a.distance || 0;
                var bd = b.distance || 0;
                return ad < bd ? -1 : ad > bd ? 1 : 0;
            });

            var distRatio = data[1].distance / (data[0].distance + data[1].distance);
            var heightDiff = (data[0].attributes().ele - data[1].attributes().ele);
            var calcEle = data[1].attributes().ele + heightDiff * distRatio;

            var elevationOutput = {
                distance: (data[0].distance + data[1].distance) / 2,
                lat: lat,
                lon: lon,
                elevation: calcEle
            };

        } else if (tileLength < 1) {
            var elevationOutput = {
                distance: -999,
                lat: lat,
                lon: lon,
                elevation: 0
            };
        } else if (tileLength === 1) {
            var elevationOutput = {
                distance: data[0].distance,
                lat: lat,
                lon: lon,
                elevation: data[0].attributes().ele
            };
        }

        callback(null, elevationOutput);
    }

    function findElevationsMulti(lonlats, IDs, vtile, callback) {
        try {
            var data = VTs[vtile].query(lonlats, {
                layer: 'contour'
            });
        } catch (err) {
            return callback(err);
        }
        var outElevs = [];
        
        for (var i=0;i<data.length;i++) {
            var currentData = data[i];
            var tileLength = currentData.length;

            if (tileLength > 1) {
                currData.sort(function(a, b) {
                    var ad = a.distance || 0;
                    var bd = b.distance || 0;
                    return ad < bd ? -1 : ad > bd ? 1 : 0;
                });

                var distRatio = currData[1].distance / (currData[0].distance + currData[1].distance);
                var heightDiff = (currData[0].attributes().ele - currData[1].attributes().ele);
                var calcEle = currData[1].attributes().ele + heightDiff * distRatio;

                var elevationOutput = {
                    distance: (currData[0].distance + currData[1].distance) / 2,
                    lat: lat,
                    lon: lon,
                    elevation: calcEle
                };

            } else if (tileLength < 1) {
                var elevationOutput = {
                    distance: -999,
                    lat: lat,
                    lon: lon,
                    elevation: 0
                };
            } else if (tileLength === 1) {
                var elevationOutput = {
                    distance: currData[0].distance,
                    lat: lat,
                    lon: lon,
                    elevation: currData[0].attributes().ele
                };
            }
            outElevs.push({
                elevationOutput: elevationOutput,
                id: IDs[i]
            });
        }

        callback(null, outElevs);
    }

    var tilePoints = {};
    var pointTileName = [];


    for (var i = 0; i < decodedPoly.length; i++) {
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
                points: [decodedPoly[i]],
                pointIDs: [i]

            };
        } else {
            tilePoints[tileName].points.push(decodedPoly[i]);
            tilePoints[tileName].pointIDs.push(i)
        }
    }
    
    for (var i in tilePoints) {
        tileQueue.defer(loadTiles, tilePoints[i].zxy);
    }

    tileQueue.awaitAll(loadDone);
}
