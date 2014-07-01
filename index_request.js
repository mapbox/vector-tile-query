var mapnik = require('./node_modules/mapnik');
var sphericalmercator = require('sphericalmercator');
var async = require('queue-async');
var request = require('request');
var zlib = require('zlib');
var concat = require('concat-stream');
var async = require('queue-async');
var sm = new sphericalmercator();

module.exports = function loadRemoteVT(decodedPoly, callback) {
    var allStart = new Date();
    var VTs = {}
    var tileQueue = new async();
    var elevationQueue = new async(100);
    var z = 14;
    var tolerance = 1000;

    function loadDone(err, response) {
        for (var i = 0; i < decodedPoly.length; i++) {
            elevationQueue.defer(findElevations, decodedPoly[i], pointIDs[i]);
        }
        elevationQueue.awaitAll(queryDone);
    }

    function queryDone(err, response) {
        return callback(null, {
            queryTime: new Date() - allStart,
            results: response
        });
    }

    function requestTile(tileID, callback) {
        var queryStart = new Date();
        var tileName = tileID.z + '/' + tileID.x + '/' + tileID.y;
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
    }

    function findElevations(lonlat, vtile, callback) {
        var lon = lonlat[1];
        var lat = lonlat[0];

        try {
            var data = VTs[vtile].query(lon, lat, {
                layer: 'contour'
            });
        } catch (err) {
            return callback(err);
        }

        if (data.length < 1) {
            var elevationOutput = {
                distance: -999,
                lat: lat,
                lon: lon,
                elevation: 0
            };
        } else if (data.length == 1) {
            var elevationOutput = {
                distance: data[0].distance,
                lat: lat,
                lon: lon,
                elevation: data[0].attributes().ele
            };
        } else {

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
        }

        callback(null, elevationOutput);
    }

    var uniqCheck = {};
    var uList = [];
    var pointIDs = [];

    for (var i = 0; i < decodedPoly.length; i++) {
        var xyz = sm.xyz([decodedPoly[i][1], decodedPoly[i][0], decodedPoly[i][1], decodedPoly[i][0]], z);
        var tileName = z + '/' + xyz.minX + '/' + xyz.minY;
        pointIDs.push(tileName);
        if (uniqCheck[tileName] === undefined) {
            uniqCheck[tileName] = true;
            uList.push({
                z: z,
                x: xyz.minX,
                y: xyz.minY
            });
        }
    }

    for (var i = 0; i < uList.length; i++) {
        tileQueue.defer(requestTile, uList[i]);
    }

    tileQueue.awaitAll(loadDone);
}
