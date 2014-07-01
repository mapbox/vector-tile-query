var express = require('express'),
    cors = require('cors'),
    polyline = require('polyline'),
    loadVT = require('./index');
    loadRemoteVT = require('./index_request');

var app = express();

app.get('/query-local/:poly', cors(), function(req, res, next) {
    loadVT(polyline.decode(req.params.poly), function(err, result) {
        res.json(result);
    });
});

app.get('/query-remote/:poly', cors(), function(req, res, next) {
    loadRemoteVT(polyline.decode(req.params.poly), function(err, result) {
        res.json(result);
    });
});

app.listen(8000, function() {
    console.log('CORS-enabled web server listening on port 8000');
});
