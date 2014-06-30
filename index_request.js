
var express = require('express');
var cors = require('cors');
var app = express();
var request = require('request');
var mapnik = require('./node_modules/mapnik');
var Buffer = require('buffer').Buffer;
var sphericalmercator = require('sphericalmercator');
var zlib = require('zlib');
var fs = require('fs');

app.get('/query/:z,:x,:y', cors(), loadVT);

app.listen(8000, function(){
  console.log('CORS-enabled web server listening on port 8000');
});

function loadVT(req,res,next) {
    var z = parseInt(req.params.z,10);
    var x = parseInt(req.params.x,10);
    var y = parseInt(req.params.y,10);

    var tileURL = 'https://b.tiles.mapbox.com/v3/mapbox.mapbox-terrain-v1/'+z+'/'+x+'/'+y+'.vector.pbf'
    var options = { url: tileURL, headers: {'accept-encoding': 'gzip,deflate','Content-Type':'application/x-protobuf'}}

    // request(options).pipe(fs.createWriteStream(y+'.vector.pbf'));
    // var data = fs.readFileSync(y+'.vector.pbf');
    // var vtile = new mapnik.VectorTile(z,x,y);
    // vtile.setData(data);
    // vtile.parse();
    // res.json({err:""})
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var parsed = new Buffer(body,'binary');
            zlib.deflate(body, function(err,unz) {
                var parsed = new Buffer(unz);

                var vtile = new mapnik.VectorTile(z,x,y);
                vtile.setData(parsed);
                vtile.parse();
                res.json({tile:""});
            });
            
        }
        else {
            res.json({err:error})
        }
    });
}

