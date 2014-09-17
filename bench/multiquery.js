var fs = require('fs');
var path = require('path');
var Benchmark = require('benchmark');
var suite = new Benchmark.Suite();
var assert = require('assert');
var mapnik = require('mapnik');
var vtileQuery = require('../index.js');

function readTile(tile,callback) {
    var tilepath = 'test/fixtures/tiles/'+tile.z+'/'+tile.x+'/'+tile.y+'.vector.pbf';
    fs.readFile(tilepath, function(err,data) {
        if (err) return callback(err);
        return callback(null,data);
    });
}

var queryPoints = [[37.934205, -122.747147], [37.934721, -122.747461]];
vtileQuery.loadTiles(queryPoints, 14, readTile, function (err, data) {
    if (err) throw err;
    suite.add({
        name: 'convert',
        fn: function(promise) {
            vtileQuery.multiQuery(data, {
                tolerance:10,
                layer:'contour',
                fields:['ele']
            }, function(err, queryData) {
                promise.resolve();
            });
        },
        defer: true
    })
    .on('cycle', function(event) {
        console.log(String(event.target));
    })
    .run();
});

