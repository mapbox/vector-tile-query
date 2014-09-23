var mapnik = require('mapnik');
var sphericalmercator = require('sphericalmercator');
var sm = new sphericalmercator();
var async = require('queue-async');
var _ = require('lodash');

function sortBy(sortField) {
    return function sortCallback(a, b) {
        var ad = a[sortField] || 0;
        var bd = b[sortField] || 0;
        return ad < bd ? -1 : ad > bd ? 1 : 0;
    };
}

function buildQuery(points, zoom) {
    var queryObject = {}, output = [];
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
            output.push(queryObject[tileName]);
        } else {
            queryObject[tileName].points.push([points[i][1], points[i][0]]);
            queryObject[tileName].pointIDs.push(i);
        }
    }
    return output;
}

function loadTiles(queryPoints, maxZoom, minZoom, threshold, loadFunction, callback) {
    if (!queryPoints[0].length) return callback(new Error('Invalid query points'));
    if (!threshold) return callback(new Error('Specify a zoom level threshold'));

    function loadTileAsync(tileObj, loadFunction, callback) {
        loadFunction(tileObj.zxy, function(err, data) {
            if (err) return callback(err);
            tileObj.data = data;
            return callback(null, tileObj);
        });
    }

    var initialTileLoad = buildQuery(queryPoints, maxZoom);
    var reducuedTiles = changeNumberTilesLoaded(initialTileLoad, queryPoints, maxZoom, minZoom, threshold);
    if(!reducuedTiles) return callback(new Error('Too many tiles have been requested'));

    var loadQueue = new async();
    for (var i = 0; i < reducuedTiles.length; i++) {
        loadQueue.defer(loadTileAsync,reducuedTiles[i],loadFunction);
    }

    loadQueue.awaitAll(callback);

}

function changeNumberTilesLoaded(tiles, points, currentZoom, minZoom, threshold) {
    if(tiles.length > threshold){
        var newZoom = currentZoom - 1;
        if(newZoom >= minZoom){
            var newTiles = buildQuery(points, newZoom);
            if(newTiles.length > threshold){
                try {
                    changeNumberTilesLoaded(newTiles, points, newZoom, minZoom, threshold);
                } catch(e) {
                    return e;
                }
            } else {
                return newTiles;
            }
        } else {
            return tiles;
        }
    } else {
        return tiles;
    }
}

function queryTile(pbuf, tileInfo, queryPoints, pointIDs, options, callback) {

    function createEmptyResponse(respLength, callback) {
            var data = {
                hits: []
            };
            for (var i = 0; i < respLength; i++) {
                data.hits.push([]);
            }
            return callback(null, data);
    }

    function query(vt, queryPoints, layer, fields, tolerance) {
        if (vt.names().indexOf(layer) === -1) {
            createEmptyResponse(queryPoints.length,queryFinalize);
        } else {
            vt.queryMany(queryPoints, { layer: layer, tolerance: tolerance }, queryFinalize);
        }
    }

    function queryFinalize(err, data) {
        if (err) return callback(err);
        return callback(null, convert(queryPoints, pointIDs, fields, interpolate, data));
    }

    var outputData;
    var fields;
    var tolerance = options.tolerance || 10;
    var interpolate = options.interpolate !== undefined ? options.interpolate : true;

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

    if (pbuf && Buffer.isBuffer(pbuf)) {
        var vt = new mapnik.VectorTile(tileInfo.z,tileInfo.x,tileInfo.y);
        vt.setData(pbuf);
        vt.parse(function(err) {
            if (err) return callback(err);
            query(vt, queryPoints,layer,fields, tolerance, callback);
        });
    } else {
        outputData = [];
        for (var i = 0; i < queryPoints.length; i++) {
            var output = {
                id: pointIDs[i],
                latlng: {
                    lat: queryPoints[i][1],
                    lng: queryPoints[i][0]
                }
            };
            for (var f=0; f<fields.length; f++) {
                output[fields[f]] = null;
            }
            outputData.push(output);
        }
        return callback(null, outputData);
    }
}

function multiQuery(dataArr,options,callback) {

    var fillNulls = options.fill !== undefined ? options.fill : false;


    function queriesDone(err, queries) {
        if (err) return callback(err);
        var dataOutput = [];
        dataOutput = dataOutput.concat.apply(dataOutput, queries);
        dataOutput.sort(sortBy('id'));
        if (fillNulls) {
            for (var f = 0; f < options.fields.length; f++) {
                dataOutput = interpolateResponse(dataOutput, options.fields[f]);
            }
        }
        return callback(null, dataOutput);
    }

    var queryQueue = new async();

    for (var i = 0; i<dataArr.length; i++) {
        queryQueue.defer(queryTile, dataArr[i].data, dataArr[i].zxy, dataArr[i].points, dataArr[i].pointIDs, options);
    }

    queryQueue.awaitAll(queriesDone);
}

// Convert raw results from vt.queryMany into formatted output.
function convert(queryPoints, pointIDs, fields, interpolate, data) {
    if (data.features) {
        for (var k = 0; k < data.features.length; k++) {
            data.features[k].attr = data.features[k].attributes();
        }
    }

    var fieldsLength = fields.length;
    var converted = [];
    for (var i = 0; i < data.hits.length; i++) {
        var res = {
            id: pointIDs[i],
            latlng: {
                lat: queryPoints[i][1],
                lng: queryPoints[i][0]
            }
        };

        var hit = data.hits[i];
        if (hit.length > 1 && hit[hit.length - 1].distance !== 0 && interpolate === true) {
            for (var j = 0; j < fieldsLength; j++) {
                var field = fields[j];
                var val0 = data.features[hit[0].feature_id].attr[field];
                var val1 = data.features[hit[1].feature_id].attr[field];
                if (isNaN(val0)) {
                    res[field] = val0;
                } else {
                    res[field] = val1 + (val0 - val1) * (hit[1].distance / (hit[0].distance + hit[1].distance));
                }
            }
        } else if (hit.length < 1) {
            for (var j = 0; j < fieldsLength; j++) {
                var field = fields[j];
                res[field] = null;
            }
        } else if (hit.length === 1 || interpolate === false) {
            for (var j = 0; j < fieldsLength; j++) {
                var field = fields[j];
                res[field] = data.features[hit[0].feature_id].attr[field];
            }
        } else if (hit[hit.length - 1].distance === 0) {
            for (var j = 0; j < fieldsLength; j++) {
                var field = fields[j];
                res[field] = data.features[hit[hit.length - 1].feature_id].attr[field];
            }
        }

        converted.push(res);
    }
    return converted;
}

function interpolateResponse(inObj, field, callback) {

    function interpolateBetween(fr, to, frID, toID) {
        var idRange = toID - frID;
        var outPoints = [];
        var valueRange = fr - to;
        for (var i = 1; i < idRange; i++) {
            outPoints.push((1 - (i / idRange)) * valueRange + to);
        }
        return outPoints;
    }

    function findBreaks(objArr, field) {
        var uVals = [];
        var idVals = [];
        var firstNonNull = 0;

        for (var i = 0; i < objArr.length; i++) {
            var oObj = null;
            if (objArr[i][field] !== null && uVals.length === 0) {
                oObj = objArr[i][field];
                firstNonNull = i;
            } else if (objArr[i][field] !== null && objArr[i][field] !== uVals[uVals.length-1]) {
                oObj = objArr[i][field];
            } else if (i === objArr.length-1 && objArr[i][field] !== null) {
                oObj = objArr[i][field];
            } else if (i === objArr.length-1 && uVals.length !== 0) {
                oObj = uVals[uVals.length-1];
            }
            if (oObj !== null) {
                uVals.push(oObj);
                idVals.push(i);
            }
        }

        if (firstNonNull !== 0) {
            idVals.unshift(0);
            uVals.unshift(uVals[0]);
        }
        return {
            ids: idVals,
            breaks: uVals
        };
    }

    var breaks = findBreaks(inObj, field);

    if (breaks.breaks.length === 0) {
        return callback(null, inObj);
    } else if (breaks.breaks.length == inObj.length) {
        return callback(null, inObj);
    }

    var output = [breaks.breaks[0]];

    for (var i=1; i< breaks.breaks.length; i++) {
        output = output.concat(interpolateBetween(breaks.breaks[i-1],breaks.breaks[i],breaks.ids[i-1],breaks.ids[i]));
        output.push(breaks.breaks[i]);
    }

    inObj.map(function(record, i) {
        record[field] = output[i];
    });

    return callback(null, inObj);
}

module.exports = {
    buildQuery: buildQuery,
    convert: convert,
    queryTile: queryTile,
    loadTiles: loadTiles,
    changeNumberTilesLoaded: changeNumberTilesLoaded,
    multiQuery: multiQuery
};
