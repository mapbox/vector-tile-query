var express = require('express');
var cors = require('cors');
var loadVT = require('./index');
var polyline = require('polyline');
var app = express();
var port = process.env.PORT || 8000;
var skipValue = 2;


function formatPoints(points, callback) {
    var formattedPointed = [];
    points.split(';').map(function(x) {
        formattedPointed.push([parseFloat(x.split(',')[1]), parseFloat(x.split(',')[0])]);
    });
    return formattedPointed;
}

// Elevation query example
app.get('/query/:mapid/:layer/:attribute/:format/:data', cors(), function(req, res, next) {

    if (req.params.format === 'encoded_polyline') {
        var data = polyline.decode(req.params.data);
    } else if (req.params.format === 'points') {
        var data = formatPoints(req.params.data);
    } else {
        var data = req.params.data;
    }

    loadVT(req.params.mapid, req.params.layer, req.params.attribute, skipValue, data, function(err, result) {
        console.log(err)
        if (err) throw err;
        res.json(result);
    });

});

app.listen(port, function() {
    console.log('Listening on port: ' + port);
});
