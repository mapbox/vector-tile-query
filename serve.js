var express = require('express'),
    cors = require('cors'),
    loadVT = require('./index');

var app = express();

app.get('/query/:source/:layer/:attribute/:format/:data', cors(), function(req, res, next) {
    loadVT(req.params.source, req.params.layer, req.params.attribute, req.params.format, req.params.data, function(err, result) {
        if (err) throw err;
        res.json(result);
    });
});

app.listen(8000, function() {
    console.log('CORS-enabled web server listening on port 8000');
});
