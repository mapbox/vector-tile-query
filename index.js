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

app.listen(8000, function(){
  console.log('CORS-enabled web server listening on port 8000');
});

function loadVT(req,res,next) {
    var queryStart = new Date();
    var queue = new async();
    var z = 14;
    tolerance = 1000;
    var decodedPoly = polyline.decode(req.params.poly);

    function queryDone(err,response) {
        return res.json({results:response,queryTime:new Date()-queryStart});
    }


    function getElev(z,lonlat,callback) {
            
        var lon = lonlat[1];
        var lat = lonlat[0];
        var xyz = sm.xyz([lon, lat, lon, lat], z);
        var tileName = ''+z+'/'+xyz.minX+'/'+xyz.minY;
        var data = fs.readFileSync('tiles/'+tileName+'.vector.pbf');
        var vtile = new mapnik.VectorTile(z,xyz.minX,xyz.minY);
        vtile.setData(data);
        vtile.parse();


        try {
            var data = vtile.query(lon, lat, { layer: 'contour', tolerance:tolerance });
        } catch(err) {
            return callback(err);
        }
        console.log(vtile)
        data.sort(function(a, b) {
            var ad = a.distance || 0;
            var bd = b.distance || 0;
            return ad < bd ? -1 : ad > bd ? 1 : 0;
        });
        if (data.length<1){
            var elevationOutput = {
                distance: -999,
                lat: lat,
                lon: lon,
                elevation: 0
            }
        }

        else if (data.length==1){
            var elevationOutput = {
                distance: data[0].distance,
                lat: lat,
                lon: lon,
                elevation: data[0].attributes().ele
            }
        }

        else {
            var distRatio = data[1].distance/(data[0].distance+data[1].distance);
            var heightDiff = (data[0].attributes().ele-data[1].attributes().ele);
            var calcEle = data[1].attributes().ele+heightDiff*distRatio;

            var elevationOutput = {
                distance: (data[0].distance+data[1].distance)/2,
                lat: lat,
                lon: lon,
                elevation: calcEle
            }
        }

        callback(null, elevationOutput);
    }

    for (var i = 0; i<decodedPoly.length; i++) {
        queue.defer(getElev,z,decodedPoly[i]);
    }

    queue.awaitAll(queryDone);


}
