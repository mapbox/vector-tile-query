function interpolateResponse(inObj, field) {

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
        var uVals = [0];
        var idVals = [];
        var kernel = objArr.slice(0,2).map(function(k) {
            return k[field];
        });
        var nullBreaks = [];
        for (var i = 1; i < objArr.length-1; i++) {
            kernel.push(objArr[i+1][field]);
            var kVal = kernel[0];
            for (var k = 1; k<3; k++) {
                if (kernel[k] !== kVal && kernel[1] !== null) {
                    uVals.push(kernel[1]);
                    idVals.push(i);
                    if (kernel[0] === null || kernel[2] === null) {
                        nullBreaks.push(i);
                    }
                    break;
                }
                kVal = kernel[k];
            }
            kernel.shift();
        }
        uVals.shift();
        idVals.unshift(0);
        if (objArr[0][field] != null) {
            uVals.unshift(objArr[0][field]);
        } else if (uVals.length !== 0) {
            uVals.unshift(uVals[0]);
        }
        idVals.push(objArr.length-1)
        if (objArr[objArr.length-1][field] !== null) {
            uVals.push(objArr[objArr.length-1][field]);
        } else if (uVals.length !== 0) {
            uVals.push(uVals[uVals.length-1]);
        }

        return {
            ids: idVals,
            breaks: uVals
        };
    }

    if (typeof(inObj[0][field]) !== 'number') {
        return inObj;
    }

    var breaks = findBreaks(inObj, field);

    if (breaks.breaks.length === 0) {
        return inObj;
    } else if (breaks.breaks.length == inObj.length) {
        return inObj;
    }

    var output = [breaks.breaks[0]];

    for (var i=1; i< breaks.breaks.length; i++) {
        output = output.concat(interpolateBetween(breaks.breaks[i-1],breaks.breaks[i],breaks.ids[i-1],breaks.ids[i]));
        output.push(breaks.breaks[i]);
    }

    inObj.map(function(record, i) {
        record[field] = output[i];
    });

    return inObj;
}

module.exports = {
    interpolateObject: interpolateResponse
};