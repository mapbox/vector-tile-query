function interpolateNulls(inObj, field) {

    function interpolateBetween(fr, to, frID, toID) {
        var idRange = toID - frID;
        var outPoints = [];
        var valueRange = fr - to;
        for (var i = 1; i < idRange; i++) {
            outPoints.push((1 - (i / idRange)) * valueRange + to);
        }
        return outPoints;
    }
    function findBreaks(result, field) {
        var uVals = [0];
        var idVals = [];
        var uCount = 1;
        var hasNull = false;
        var kernel = result.slice(0,2).map(function(k) {
            return k[field];
        });
        var nullBreaks = {};
        for (var i = 1; i < result.length-1; i++) {
            kernel.push(result[i+1][field]);

            var kVal = kernel[0];
            for (var k = 1; k<3; k++) {
                if (kernel[k] !== kVal && kernel[1] !== null) {
                    uVals.push(kernel[1]);
                    idVals.push(i);
                    if (kernel[0] === null || kernel[2] === null) {
                        nullBreaks[uCount] = true;
                        hasNull = true;
                    }
                    uCount++;
                    break;
                }
                kVal = kernel[k];
            }
            kernel.shift();
        }
        uVals.shift();
        idVals.unshift(0);
        if (result[0][field] !== null) {
            uVals.unshift(result[0][field]);
        } else if (uVals.length !== 0) {
            uVals.unshift(uVals[0]);
        }

        idVals.push(result.length-1);
        if (result[result.length-1][field] !== null) {
            uVals.push(result[result.length-1][field]);
        } else if (uVals.length !== 0) {
            uVals.push(uVals[uVals.length-1]);
        }
        var lastBreak = false;
        var cBreak;
        for (var i = 1; i< uVals.length-1; i++) {
            if (!nullBreaks[i]) {
                if (uVals[i]<uVals[i-1] && uVals[i] === uVals[i+1]) {
                    cBreak = 'L';
                }  else if (uVals[i]<uVals[i+1] && uVals[i] === uVals[i-1]) {
                    cBreak = 'R';
                    if (lastBreak !== 'L') {
                        uVals.splice(i,1);
                        idVals.splice(i,1);
                    }
                } else {
                    if (lastBreak === 'L') {
                        uVals.splice(i-1,1);
                        idVals.splice(i-1,1);
                    }
                    cBreak = false;
                }
                lastBreak = cBreak;
            }
        }

        return {
            ids: idVals,
            breaks: uVals,
            hasNull: hasNull
        };
    }

    for (var f = 0; f<inObj.length; f++) {
        if (inObj[f][field] !== null) {
            if (typeof(inObj[f][field]) === 'number') {
                break;
            } else {
                return inObj;
            }
        }
    }

    if (inObj.length < 3) {
        return inObj;
    }

    var breaks = findBreaks(inObj, field);

    if (breaks.breaks.length === 0) {
        return inObj;
    } else if (breaks.breaks.length === inObj.length && !breaks.hasNull) {
        return inObj;
    }

    var output = [breaks.breaks[0]];

    for (var i=1; i< breaks.breaks.length; i++) {
        if (breaks.ids[i] !== breaks.ids[i-1]) {
            output = output.concat(interpolateBetween(breaks.breaks[i-1],breaks.breaks[i],breaks.ids[i-1],breaks.ids[i]));
        }
        output.push(breaks.breaks[i]);
    }

    inObj.map(function(record, i) {
        record[field] = output[i];
    });

    return inObj;
}

module.exports = {
    interpolateNulls: interpolateNulls
};