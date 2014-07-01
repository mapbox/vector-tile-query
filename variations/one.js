var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var fs = require('fs');
var async = require('queue-async');
var sm = new sphericalmercator();

module.exports = function loadVT(decodedPoly, callback) {
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

    function loadTiles(tileID, callback) {

        var queryStart = new Date();

        var tileName = tileID.z + '/' + tileID.x + '/' + tileID.y;

        fs.readFile('/Users/tmcw/src/api-elevation/tiles/' + tileName + '.vector.pbf', function(err, tileData) {
            if (err) throw err;

            var vtile = new mapnik.VectorTile(tileID.z, tileID.x, tileID.y);
            vtile.setData(tileData);
            vtile.parse();

            VTs[tileName] = vtile;

            return callback(null);
        });
    }

    function findElevations(lonlat, vtile, callback) {
        var lon = lonlat[1];
        var lat = lonlat[0];

        var data = VTs[vtile].query(lon, lat, {
            layer: 'contour'
        });

        if (data.length === 0) {
            return callback(null, {
                distance: -999,
                lat: lat,
                lon: lon,
                elevation: 0
            });
        } else if (data.length === 1) {
            return callback(null, {
                distance: data[0].distance,
                lat: lat,
                lon: lon,
                elevation: data[0].attributes().ele
            });
        } else {
            data.sort(function(a, b) {
                var ad = a.distance || 0;
                var bd = b.distance || 0;
                return ad < bd ? -1 : ad > bd ? 1 : 0;
            });

            var d0attr = data[0].attributes();
            var d1attr = data[1].attributes();

            var distRatio = data[1].distance / (data[0].distance + data[1].distance);
            var heightDiff = (data[0].attributes().ele - data[1].attributes().ele);
            var calcEle = data[1].attributes().ele + heightDiff * distRatio;
            return callback(null, {
                distance: (data[0].distance + data[1].distance) / 2,
                lat: lat,
                lon: lon,
                elevation: calcEle
            });
        }
    }

    var uniqList = [];
    var uList = [];
    var pointIDs = [];

    for (var i = 0; i < decodedPoly.length; i++) {
        var xyz = sm.xyz([decodedPoly[i][1], decodedPoly[i][0], decodedPoly[i][1], decodedPoly[i][0]], z);
        var tileName = z + '/' + xyz.minX + '/' + xyz.minY;
        pointIDs.push(tileName);
        if (uniqList.indexOf(tileName) == -1) {
            uniqList.push(tileName);
            uList.push({
                z: z,
                x: xyz.minX,
                y: xyz.minY
            });
        }
    }

    for (var i = 0; i < uList.length; i++) {
        tileQueue.defer(loadTiles, uList[i]);
    }

    tileQueue.awaitAll(loadDone);
}
