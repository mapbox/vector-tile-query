var express = require('express'),
    cors = require('cors'),
    loadVT = require('./index');

var app = express();

app.get('/elevation/:source/:format/:poly', cors(), function(req, res, next) {
    loadVT(req.params.source, req.params.format, req.params.poly, function(err, result) {
        if (err) throw err;
        res.json(result);
    });
});

app.listen(8000, function() {
    console.log('CORS-enabled web server listening on port 8000');
});
