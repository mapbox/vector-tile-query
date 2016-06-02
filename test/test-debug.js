var assert = require("assert");
var fs = require('fs');
var sphericalmercator = require('sphericalmercator');
var sm = new sphericalmercator();
var vtileQuery = require('../');

function readTile(tile,callback) {
    var tilepath = 'test/fixtures/tiles/' + tile.z + '/' + tile.x + '/' + tile.y + '-original.vector.pbf';
    fs.readFile(tilepath, function(err,data) {
        if (err) return callback(err)
        return callback(null, data);
    });
}

describe('test v1 vs v2', function() {
    
    ['test/fixtures/tiles/12/725/1453-original.vector.pbf',  // original tileset
     //'test/fixtures/tiles/12/725/1453-mapsamv1.vector.pbf',  // uploaded with old unpacker manual
     //'test/fixtures/tiles/12/725/1453-mapsamv2.vector.pbf'   // current mapbox studio upload
    ].forEach(function(fixture) {

        var options = {
            layer: 'GMUs',
            fields: ['State','Label'],
            tolerance: 100,
            interpolate: true
        };
        //var zxy = {z: 12, x: 725, y: 1453};
        //var pointIDs = [1, 2];

        // tests directly querying a tile with `queryTile`
        /*
        it(fixture, function(done) {
            console.log('\n - - - FIXTURE: ' + fixture + ' - - - ');
            fs.readFile(fixture, function(err, data) {
                vtileQuery.queryTile(data, zxy, [[-116.2683, 46.2312]], pointIDs, options, function(err, results) {
                    if (err) throw err;
                    console.log('results:',results);
                    done();
                });
            });
        });
        */

        // tests loading tiles, which calculates the zxy for us
        it(fixture + ' load', function(done) {
            fs.readFile(fixture, function(err, data) {
                vtileQuery.loadTiles([[46.2312, -116.2683]], 12, 10, 70, readTile, function(err, data) {
                    if (err) throw err;
                    vtileQuery.multiQuery(data, options, function(err, queryData) {
                        if (err) throw err;
                        var expected = [ { id: 0,
                            latlng: { lat: 46.2312, lng: -116.2683 },
                            State: 'ID',
                            Label: '11A' } ];
                        assert.deepEqual(queryData,expected)
                        done();
                    });
                });
            });
        });
    });

    /*['test/fixtures/tiles/8/140/100-v1.vector.pbf', // bathymetry v1 tileset
     'test/fixtures/tiles/8/140/100-v2.vector.pbf'  // bathymetry v2 tileset
    ].forEach(function(fixture) {
        it(fixture, function(done) {
            console.log('\n - - - FIXTURE: ' + fixture + ' - - - ');
            fs.readFile(fixture, function(err, data) {
                vtileQuery.queryTile(data, {z: 8, x: 140, y: 100}, [[17.71, 35.84]], [1, 2], {
                    layer: 'ne_10m_bathymetry_H_3000',
                    fields: ['depth']
                }, function(err, results) {
                    if (err) throw err;
                    console.log('results:',results);
                    done();
                });
            });
        });
    });
    */
});