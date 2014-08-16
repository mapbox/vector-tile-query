var assert = require("assert");
var fs = require('fs');
var vtileQuery = require('../');

function readTile(tile,callback) {
    var tilepath = 'fixtures/tiles/'+tile.z+'/'+tile.x+'/'+tile.y+'.vector.pbf';
    fs.readFile(tilepath, function(err,data) {
        if (err) return callback(err)   
        return callback(null,data);
    });
}

describe('Load relevant tiles from list of coords', function() {
    it('should fail if tile does not exist', function(done) {
        var queryCoords = [[-122.747147, 37.934205], [-122.747461, 37.934721], [-122.747993, 38.93512]];
        vtileQuery.loadTiles(queryCoords,14,readTile, function (err,data) {
            assert.equal(err.message,"Tile not loaded")
            done();
        });   
    });
});

describe('Make sure layers and fields are specified', function() {
    var queryCoords = [[-122.747147, 37.934205], [-122.747461, 37.934721], [-122.747993, 37.93512]];
    it('should fail if field does not exist', function(done) {
        vtileQuery.loadTiles(queryCoords,14,readTile, function (err,data) {
            vtileQuery.multiQuery(data, {tolerance:10,layer:'contour',field:'aFake'}, function(err, queryData) {
                assert.equal(err.message,'Field "aFake" not found in tile')
                done();
            });
        });
            
    });
    it('should fail if layer not specified', function(done) {
        vtileQuery.loadTiles(queryCoords,14,readTile, function (err,data) {
            vtileQuery.multiQuery(data, {tolerance:10,field:'ele'}, function(err, queryData) {
                assert.equal(err.message,'No layer specified')
                done();
            });
        });
            
    });
    it('should fail if field not specified', function(done) {
        vtileQuery.loadTiles(queryCoords,14,readTile, function (err,data) {
            vtileQuery.multiQuery(data, {tolerance:10,layer:'contour'}, function(err, queryData) {
                assert.equal(err.message,'No field specified')
                done();
            });
        });
            
    });
});

describe('Test for matching queries', function() {
    it('elevation (polyline) return should match', function(done) {
        var queryPoints = [[-122.747147, 37.934205], [-122.747461, 37.934721]];
        var validResponse = '[{"id":0,"latlng":{"lat":37.934205,"lng":-122.747147},"ele":81.3189156103434},{"id":1,"latlng":{"lat":37.934721,"lng":-122.747461},"ele":85.1838043599294}]'
        vtileQuery.loadTiles(queryPoints,14,readTile, function (err,data) {
            vtileQuery.multiQuery(data, {tolerance:10,layer:'contour',field:'ele'}, function(err, queryData) {
                assert.equal(JSON.stringify(queryData),validResponse);
                done();
            });
        });
    });
    it('landcover (stackedpolygon) return should match', function(done) {
        var queryPoints = [[-122.747147, 37.934205], [-122.747461, 37.934721]];
        var validResponse = '[{"id":0,"latlng":{"lat":37.934205,"lng":-122.747147},"class":"scrub"},{"id":1,"latlng":{"lat":37.934721,"lng":-122.747461},"class":"wood"}]';
        vtileQuery.loadTiles(queryPoints,14,readTile, function (err,data) {
            vtileQuery.multiQuery(data, {tolerance:10,layer:'landcover',field:'class'}, function(err, queryData) {
                assert.equal(JSON.stringify(queryData),validResponse);
                done();
            });
        });
    });
});

describe('Test for invalid points', function() {
    it('should not work for point queries', function(done) {
        var queryPoints = [-122.4242377281189,37.775718243274575];
        vtileQuery.loadTiles(queryPoints,15,readTile, function (err,data) {
            assert.equal(err.message,"Invalid query points")
            done();
        });
    });
});