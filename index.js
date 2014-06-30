var start = new Date();
var timeProfile = {'start':0}

fs = require('fs');
mapnik = require('./node_modules/mapnik');
sphericalmercator = require('sphericalmercator');

timeProfile.modulesLoaded = new Date() - start;
var data = fs.readFileSync("6335.vector.pbf");
timeProfile.protobufLoaded =  new Date() - start;

var vtile = new mapnik.VectorTile(14,2620,6335);
timeProfile.newVT =  new Date() - start;

vtile.setData(data);
timeProfile.setVTData =  new Date() - start;

vtile.parse();
timeProfile.parseVT = new Date() - start;

var sm = new sphericalmercator();
var tileBounds = sm.bbox(2620,6335,14);
var qLon = (tileBounds[2]-tileBounds[0])/2+tileBounds[0];
var qLat = (tileBounds[3]-tileBounds[1])/2+tileBounds[1];
timeProfile.smMakeCoords =  new Date() - start;

var features = vtile.query(qLon,qLat,{tolerance:0});
timeProfile.queryDone =  new Date() - start;

console.log(timeProfile);