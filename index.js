var cors = require('cors');
var mapnik = require('./node_modules/mapnik');
var sphericalmercator = require('sphericalmercator');
var fs = require('fs');
var polyline = require('polyline');
var async = require('queue-async');
var sm = new sphericalmercator();

var z = 14;
var tolerance = 1000;

// Alamere Falls Hike
var poly = 'w_pfFt`elVq@BaBhBc@z@ElAP~@Qt@ObAg@fAU~AW`Am@TeAc@}@BGq@Dv@n@Z~@Zx@bATzAMxA[pAQtAW|AGxA{@rCw@e@{@U{@LYnADnAzBvA\\dAWjAaBlBEhAOrAMnDYnDKpA]hAItAFrAJtAQtA{@bAiALg@}@e@kAaA_@_ASeABm@m@e@_AoBkAEhANpDx@v@HvAA~A]hAm@k@MuAsBgAy@L_AQPeGCqAi@gAA_ABqA_@mAc@s@m@u@_Ag@_A@{@K{@Wu@c@q@Y_AM{@W}@Hy@MaAWs@i@_AFm@r@y@n@sBfAy@\\y@d@}BdA_A\\_ANaAJ{@Zw@l@yAtBc@dAQnAYbAm@r@c@hAoAdF]lA[rA]~@c@dAQnABrAApANdAItAHhATfATlAl@z@j@~@|AbFNjANhDYjAWjA@nAFjA_AhCWdAc@bAu@p@g@~@]dAg@bA{@|C_@dAc@xAWtAKrA^fAAt@Cl@YxAC|CGpAPlA~@dCj@x@lApAYp@k@n@s@l@s@NW|@WZEt@g@l@Ff@RN`ABXWLEHNKAE\\_@Gs@JI[MPI_@Bw@d@]Nu@ZaAn@_@t@Uj@s@Xm@Yo@[i@_@iAa@}@g@{@[mAAcDHoA@sAf@w@YgAMoANsAt@_D`@cAVmA\\cAf@gAh@}@TgAr@e@h@y@ZeAViAf@q@KwAj@mDJkACwA]iDe@cA_@oAm@iAo@}@MkA_@wAYyAJuAK}FNsA`@aAf@uCn@wCPqA`@iAf@cAr@w@\\iANkAXgAj@{@f@cA|@_@~@_@xBg@|@Qv@c@z@Y|@c@r@e@z@_@x@g@|@a@l@{@t@Y`C|@x@^bAQx@H|@N~@B\\fA`A?tBd@`AFz@Vt@f@NlABjAKpAh@x@XfAM~COpA@hAz@d@~@Wz@j@t@j@NhAv@ZPiA@wAIsAu@q@?wAKsA?iA\\t@bC~@n@l@z@J~@\\p@h@h@|@l@x@`AE|@k@TiADuAWmACwAPkAZiATsAN}C@gDXoADcA~AoBZkAWiAu@i@y@]_@mATiAp@s@z@Pz@Zn@YJmALsAAiA\\gATeARgANoAKsAm@_Au@i@_A_@c@m@zBG`ABt@u@dA}CJsAOoA@sAj@y@t@g@p@o@';

var decodedPoly = polyline.decode(poly);

function getElev(z,lonlat,callback) {

    var lon = lonlat[1];
    var lat = lonlat[0];
    var xyz = sm.xyz([lon, lat, lon, lat], z);
    var tileName = ''+z+'/'+xyz.minX+'/'+xyz.minY;
    fs.readFile('tiles/'+tileName+'.vector.pbf', function(err, data) {
        if (err) throw err;
        var vtile = new mapnik.VectorTile(z,xyz.minX,xyz.minY);
        vtile.setData(data, function query(err) {
            vtile.parse();

            try {
                var data = vtile.query(lon, lat, { layer: 'contour', tolerance:tolerance });
            } catch(err) {
                return callback(err);
            }

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
        });
    });
}

function runTest(done) {
    var queue = new async(100);

    for (var i = 0; i < decodedPoly.length; i++) {
        queue.defer(getElev, z, decodedPoly[i]);
    }

    queue.awaitAll(done);
}

var queue = new async(1);

for (var i = 0; i < 10; i++) {
    queue.defer(runTest);
}

queue.awaitAll(function() {
    console.log('done');
});
