var mapnik = require('mapnik');

module.exports = function queryVT(vtile, tileInfo, queryPoints, options, callback) {
    var data;
    var outputData = [];
    var field = options.field;
    var layer = options.layer;
    var tolerance = options.tolerance || 10;

    var vt = new mapnik.VectorTile(tileInfo.z,tileInfo.x,tileInfo.y);

    vt.setData(vtile);

    vt.parse();

    function sortCallback(a, b) {
        var ad = a.distance || 0;
        var bd = b.distance || 0;
        return ad < bd ? -1 : ad > bd ? 1 : 0;
    }

    try {
        data = vt.queryMany(queryPoints, {
            layer: layer,
            tolerance: tolerance
        });

        for (var d = 0; d < Object.keys(data.hits).length; d++) {
            data.hits[d].sort(sortCallback);
            var currentPoint = data.hits[d];
            var allData = data.features;
            var tileLength = currentPoint.length;
            var topFeatureDistance = currentPoint[tileLength - 1].distance;
            var queryPointOutput;

            if (tileLength > 1 && topFeatureDistance !== 0) {
                queryPointOutput = {
                    id: d,
                    latlng: {
                        lat: queryPoints[d][1],
                        lng: queryPoints[d][0]
                    }
                };

                var distanceRatio = currentPoint[1].distance / (currentPoint[0].distance + currentPoint[1].distance);
                var queryDifference = (allData[data.hits[d][0].feature_id].attributes()[field] - allData[data.hits[d][1].feature_id].attributes()[field]);
                var calculateValue = allData[data.hits[d][1].feature_id].attributes()[field] + queryDifference * distanceRatio;
                queryPointOutput[field] = calculateValue;

            } else if (tileLength < 1) {
                queryPointOutput = {
                    id: d,
                    latlng: {
                        lat: queryPoints[d][1],
                        lng: queryPoints[d][0]
                    }
                };

                queryPointOutput[field] = null;
            } else if (tileLength === 1) {
                queryPointOutput = {
                    id: d,
                    latlng: {
                        lat: queryPoints[d][1],
                        lng: queryPoints[d][0]
                    }
                };

                queryPointOutput[field] = allData[data.hits[d][0].feature_id].attributes()[field];

            } else if (topFeatureDistance === 0) {
                queryPointOutput = {
                    id: d,
                    latlng: {
                        lat: queryPoints[d][1],
                        lng: queryPoints[d][0]
                    }
                };
                queryPointOutput[field] = allData[data.hits[d][tileLength - 1].feature_id].attributes()[field];

            }
            outputData.push(queryPointOutput);
        }

    } catch (err) {
        if (err == 'Error: Could not find layer in vector tile') {
            for (var i = 0; i < queryPoints.length; i++) {
                queryPointOutput = {
                    id: IDs[i],
                    latlng: {
                        lat: queryPoints[i][1],
                        lng: queryPoints[i][0]
                    }
                };
                queryPointOutput[field] = null;
                outputData.push(queryPointOutput);
            }
            return callback(null, outputData);
        } else {
            return callback(err, null);
        }
    }

    callback(null, outputData);
}
