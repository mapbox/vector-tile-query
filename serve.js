var express = require('express');
var cors = require('cors');
var loadVT = require('./index');
var app = express();
var port = process.env.PORT || 8000;
var skipValue = 5;

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
