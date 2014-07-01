var express = require('express');
var cors = require('cors');
var app = express();
var mapnik = require('./node_modules/mapnik');
var sphericalmercator = require('sphericalmercator');
var fs = require('fs');
var polyline = require('polyline');
var async = require('queue-async');
var sm = new sphericalmercator();

app.get('/query/:poly', cors(), loadVT);

app.listen(8000, function() {
    console.log('CORS-enabled web server listening on port 8000');
});

function loadVT(req, res, next) {
    var allStart = new Date();
    var VTs = {}
    var tileQueue = new async();
    var elevationQueue = new async(100);
    var z = 14;
    tolerance = 1000;
    var decodedPoly = polyline.decode(req.params.poly);

    function loadDone(err, response) {

        for (var i = 0; i < decodedPoly.length; i++) {
            elevationQueue.defer(findElevations, decodedPoly[i], pointIDs[i]);
        }
        elevationQueue.awaitAll(queryDone);

    }

    function queryDone(err, response) {
        return res.json({
            queryTime: new Date() - allStart,
            results: response
        });
    }

    function loadTiles(tileID, callback) {

        var queryStart = new Date();

        var tileName = tileID.z + '/' + tileID.x + '/' + tileID.y;

        fs.readFile('tiles/' + tileName + '.vector.pbf', function(err, tileData) {
            if(err) return false;

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

        try {
            var data = VTs[vtile].query(lon, lat, {
                layer: 'contour'
            });
        } catch (err) {
            return callback(err);
        }

        data.sort(function(a, b) {
            var ad = a.distance || 0;
            var bd = b.distance || 0;
            return ad < bd ? -1 : ad > bd ? 1 : 0;
        });

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
