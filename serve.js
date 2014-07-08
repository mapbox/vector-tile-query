var express = require('express');
var cors = require('cors');
var loadVT = require('./index');
var app = express();
var port = process.env.PORT || 8000;
var skipValue = 5;

function interpolateBetween(frPoint,toPoint,valueName) {
    var valueRange = frPoint[valueName]-toPoint[valueName];
    
    var idRange = toPoint.id-frPoint.id;
    var outPoints = [];
    for (var i=1; i<idRange; i++) {
        var cID = frPoint.id+i;
        outPoints.push({
            latlng: {
                lat: decodedPoly[[cID]][0],
                lng: decodedPoly[[cID]][1]
            },
            value: (1-(i/idRange))*valueRange+toPoint[valueName],
            id: cID
        });

        outPoints[i-1][valueName] = outPoints[i-1].value;

    }
    return outPoints;
}

function euclideanDistance(fr, to) {
    a = sm.forward([fr.lng,fr.lat]);
    b = sm.forward([to.lng,to.lat]);
    var x = a[0] - b[0], y = a[1] - b[1];
    return Math.sqrt((x * x) + (y * y));
};

    // if (i != decodedPoly.length-1 && skipVal > 1) {
    //     tilePoints[tileName].points.push([decodedPoly[decodedPoly.length-1][1], decodedPoly[decodedPoly.length-1][0]]);
    //     tilePoints[tileName].pointIDs.push(decodedPoly.length-1)
    // }

        //     if (skipVal > 1) {
        //     var interOutput = [dataOutput[0]];
        //     for (var i = 1; i<dataOutput.length; i++) {
        //         interOutput = interOutput.concat(interpolateBetween(dataOutput[i-1],dataOutput[i],attribute));
        //         interOutput.push(dataOutput[i])
        //     }
        //     dataOutput = interOutput;
        // }
        // dataOutput[0].distance = 0;
        // for (var i = 1; i < dataOutput.length; i++) {
        //     dataOutput[i].distance = euclideanDistance(dataOutput[i-1].latlng,dataOutput[i].latlng)+dataOutput[i-1].distance;
        // }

// Elevation query example
app.get('/query/:source/:layer/:attribute/:format/:data', cors(), function(req, res, next) {
    loadVT(req.params.source, req.params.layer, req.params.attribute, req.params.format, skipValue, req.params.data, function(err, result) {
        if (err) throw err;

        res.json(result);
    });
});

app.listen(port, function() {
    console.log('Listening on port: ' + port);
});
