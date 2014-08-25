var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var sm = new sphericalmercator();
var async = require('queue-async');

function sortBy(sortField) {
    return function sortCallback(a, b) {
        var ad = a[sortField] || 0;
        var bd = b[sortField] || 0;
        return ad < bd ? -1 : ad > bd ? 1 : 0;
    };
}

function loadTiles(queryPoints, zoom, loadFunction, callback) {

    if (!queryPoints[0].length) return callback(new Error('Invalid query points'));

    function loadTileAsync(tileObj, loadFunction, callback) {
        loadFunction(tileObj.zxy, function(err, data) {
            if (err) return callback(new Error('Tile not loaded'));
            tileObj.data = data;
            return callback(null, tileObj);
        });
    }

    function buildQuery(points, zoom) {
        var queryObject = {};
        for (var i = 0; i < points.length; i++) {
            var xyz = sm.xyz([points[i][1], points[i][0], points[i][1], points[i][0]], zoom);
            var tileName = zoom + '/' + xyz.minX + '/' + xyz.minY;
            if (queryObject[tileName] === undefined) {
                queryObject[tileName] = {
                    zxy: {
                        z: zoom,
                        x: xyz.minX,
                        y: xyz.minY
                    },
                    points: [
                        [points[i][1], points[i][0]]
                    ],
                    pointIDs: [i]

                };
            } else {
                queryObject[tileName].points.push([points[i][1], points[i][0]]);
                queryObject[tileName].pointIDs.push(i);
            }
        }
        return queryObject;
    }

    var tilePoints = buildQuery(queryPoints,zoom);
    var loadQueue = new async();

    for (var i in tilePoints) {
        loadQueue.defer(loadTileAsync,tilePoints[i],loadFunction);
    }

    loadQueue.awaitAll(callback);
}

function queryTile(pbuf, tileInfo, queryPoints, pointIDs, options, callback) {

    function buildResponse(id,point,fieldNames,fieldValues) {
        var respOutput = {
            id: id,
            latlng: {
                lat: point[1],
                lng: point[0]
            }
        };
        for (var f=0; f<fieldNames.length; f++) {
            respOutput[fieldNames[f]] = fieldValues[f];
        }
        return respOutput;
    }

    function query(vt, queryPoints, layer, fields, tolerance) {
        var outputData = [];
        var data = vt.queryMany(queryPoints, {
            layer: layer,
            tolerance: tolerance
        });

        for (var i = 0; i < Object.keys(data.hits).length; i++) {
            data.hits[i].sort(sortBy('distance'));
            var fieldValues;

            if (data.hits[i].length > 1 && data.hits[i][data.hits[i].length - 1].distance !== 0) {
                fieldValues = fields.map(function(field) {
                    if (isNaN(data.features[data.hits[i][0].feature_id].attributes()[field])) {
                        return data.features[data.hits[i][0].feature_id].attributes()[field];
                    } else {
                        var distanceRatio = data.hits[i][1].distance / (data.hits[i][0].distance + data.hits[i][1].distance);
                        var queryDifference = (data.features[data.hits[i][0].feature_id].attributes()[field] - data.features[data.hits[i][1].feature_id].attributes()[field]);
                        return data.features[data.hits[i][1].feature_id].attributes()[field] + queryDifference * distanceRatio;
                    }
                });

            } else if (data.hits[i].length < 1) {
                fieldValues = fields.map(function() {
                    return null;
                });

            } else if (data.hits[i].length === 1) {
                fieldValues = fields.map(function(field) {
                    return data.features[data.hits[i][0].feature_id].attributes()[field];
                });

            } else if (data.hits[i][data.hits[i].length - 1].distance === 0) {
                fieldValues = fields.map(function(field) {
                    return data.features[data.hits[i][data.hits[i].length - 1].feature_id].attributes()[field];
                });
            }

            outputData.push(buildResponse(pointIDs[i],queryPoints[i],fields,fieldValues));
        }
        return outputData;
    }

    var outputData;
    var fields;
    var tolerance = options.tolerance || 10;

    if (options.fields) {
        fields = options.fields;
    } else {
        return callback(new Error('Field(s) not specified'));
    }

    if (options.layer) {
        var layer = options.layer;
    } else {
        return callback(new Error('No layer specified'));
    }

    if (fields && fields.length === 0) {
        callback(new Error('Field array empty'));
    }

    if (Object.keys(pbuf).length !== 0) {
        var vt = new mapnik.VectorTile(tileInfo.z,tileInfo.x,tileInfo.y);
        vt.setData(pbuf);
        vt.parse(function(err) {
            if (err) return callback(err);
            outputData = query(vt, queryPoints,layer,fields, tolerance);
            return callback(null, outputData);
        });
    } else {
        outputData = [];
        for (var i = 0; i < queryPoints.length; i++) {
            var fieldValues = fields.map(function() {
                return null;
            });

            outputData.push(buildResponse(pointIDs[i],queryPoints[i],fields,fieldValues));
        }
        return callback(null, outputData);
    }
}

function multiQuery(dataArr,options,callback) {

    function queriesDone(err, queries) {
        if (err) return callback(err);
        var dataOutput = [];
        dataOutput = dataOutput.concat.apply(dataOutput, queries);
        dataOutput.sort(sortBy('id'));
        return callback(null, dataOutput);
    }

    var queryQueue = new async();

    for (var i = 0; i<dataArr.length; i++) {
        queryQueue.defer(queryTile, dataArr[i].data, dataArr[i].zxy, dataArr[i].points, dataArr[i].pointIDs, options);
    }

    queryQueue.awaitAll(queriesDone);
}

module.exports = {
    queryTile: queryTile,
    loadTiles: loadTiles,
    multiQuery: multiQuery
};