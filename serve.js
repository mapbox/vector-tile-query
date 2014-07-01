var express = require('express'),
    cors = require('cors'),
    polyline = require('polyline'),
    loadVT = require('./index')

var app = express();

app.get('/query/:source/:poly', cors(), function(req, res, next) {
    loadVT(req.params.source, polyline.decode(req.params.poly),function(err, result) {
        res.json(result);
    });
});

app.listen(8000, function() {
    console.log('CORS-enabled web server listening on port 8000');
});
