var express = require('express');
var cors = require('cors');
var loadVT = require('./index');
var app = express();
var port = process.env.PORT || 8000;

// Elevation query example
app.get('/query/:source/:layer/:attribute/:format/:data', cors(), function(req, res, next) {
    loadVT(req.params.source, req.params.layer, req.params.attribute, req.params.format, req.params.data, function(err, result) {

        if (err) throw err;

        for (var i = 0; i < result.results.length; i++) {
            var distanceRatio = result.results[i].distance[1] / (result.results[i].distance[0] + result.results[i].distance[1]);
            var heightDifference = (result.results[i].value[0] - result.results[i].value[1]);
            var calculateElevation = result.results[i].value[1] + heightDifference * distanceRatio;

            result.results[i][req.params.attribute] = calculateElevation;
        }

        res.json(result);
    });
});

app.listen(port, function() {
    console.log('Listening on port: ' + port);
});
