/*jslint node: true */
/*jslint bitwise: true */
"use strict";

/**
 * This whole thing is a hack.
 *
 * We need to squeeze just a little bit more memory performance
 * out of the application. Logfiles on the magnitude of 100MB will successfully
 * parse and be stored in our WebWorker, however, transferring them from
 * the backend to the frontend requires a memory overhead that we cannot afford.
 *
 * Without transferrable objects (eg. Uint32Array), the memory pipeline looks
 * like this:
 *
 *   WebWorker: Array of EventObj
 *   WebWorker: JSON stringify the Array of EventObj
 *   Main: Receive message array from WebWorker
 *   Main: JSON parse the Array of EventObj
 *
 * As you can see, this means we have 4 copies of the same data in 
 * 2 different formats (JS object, JSON string).
 *
 * With transferrable objects, the memory pipeline looks like this:
 *
 *   WebWorker: Array of EventObj
 *   WebWorker/Main: transferrableObject Array
 *   Main: parse the Array of transferrableObject into EventObj
 *
 * Technically the last parsing step can be skipped, further reducing our
 * memory footprint to seemlingly 50% of what we were using before. The word
 * seemingly is used because I'm unsure of the overhead in JS objects.
 */
var TransferrableEventObj = {
    /**
     * There is no Uint64Array object in JavaScript.
     * We will have to do some good old high-order/low-order manipulation
     * to store any 64-bit numbers.
     * threadName      = 1 Uint32
     * functionName    = 1 Uint32
     * lockName        = 1 Uint32
     * startTime       = 2 Uint32 = uint64
     * endTime         = 2 Uint32 = uint64
     * stackDepth      = 1 Uint32
     * TOTAL:          = 8 Uint32
     */
    "THREADNAME_INDEX": 0,
    "FUNCTIONNAME_INDEX": 1,
    "LOCKNAME_INDEX": 2,
    "STARTTIME_HIGH_INDEX": 3,
    "STARTTIME_LOW_INDEX": 4,
    "ENDTIME_HIGH_INDEX": 5,
    "ENDTIME_LOW_INDEX": 6,
    "STACKDEPTH_INDEX": 7,
    
    "NUM_FIELDS": 8,
    
    // cache the value of 2^32 so we don't have to keep computing it
    "HEX_0XFFFFFFFF": Math.pow(2,32)
};

/**
 * Converts an eventObjArray into a transferrable array
 */
TransferrableEventObj.toTransferrableArray = function(minEventObjArray) {
    var transferrableArray = new Uint32Array(minEventObjArray.length * TransferrableEventObj.NUM_FIELDS),
        i;
    
    for (i = 0; i < minEventObjArray.length; i++) {
        // Note that bitshifting would first truncate our number into a 32-bit uint,
        // so we have to divide by 2^32 instead as our janky rightshift
        transferrableArray[(i * TransferrableEventObj.NUM_FIELDS) + TransferrableEventObj.THREADNAME_INDEX] = minEventObjArray[i].threadName;
        transferrableArray[(i * TransferrableEventObj.NUM_FIELDS) + TransferrableEventObj.FUNCTIONNAME_INDEX] = minEventObjArray[i].functionName;
        transferrableArray[(i * TransferrableEventObj.NUM_FIELDS) + TransferrableEventObj.LOCKNAME_INDEX] = minEventObjArray[i].lockName;
        transferrableArray[(i * TransferrableEventObj.NUM_FIELDS) + TransferrableEventObj.STARTTIME_HIGH_INDEX] = minEventObjArray[i].startTime / TransferrableEventObj.HEX_0XFFFFFFFF;
        transferrableArray[(i * TransferrableEventObj.NUM_FIELDS) + TransferrableEventObj.STARTTIME_LOW_INDEX] = minEventObjArray[i].startTime >>> 0;
        transferrableArray[(i * TransferrableEventObj.NUM_FIELDS) + TransferrableEventObj.ENDTIME_HIGH_INDEX] = minEventObjArray[i].endTime / TransferrableEventObj.HEX_0XFFFFFFFF;
        transferrableArray[(i * TransferrableEventObj.NUM_FIELDS) + TransferrableEventObj.ENDTIME_LOW_INDEX] = minEventObjArray[i].endTime >>> 0;
        transferrableArray[(i * TransferrableEventObj.NUM_FIELDS) + TransferrableEventObj.STACKDEPTH_INDEX] = minEventObjArray[i].stackDepth;
    }
    
    return transferrableArray;
};
    
TransferrableEventObj.fromTransferrableArray = function(transferrableArray) {
    var minEventObjArray = [],
        i;
    
    for (i = 0; i < transferrableArray.length; i += TransferrableEventObj.NUM_FIELDS) {
        minEventObjArray.push({
            // Note that bitshifting would truncate our number into a 32-bit uint,
            // so we have to multiply by 2^32 instead as our janky leftshift
            "threadName": transferrableArray[i + TransferrableEventObj.THREADNAME_INDEX],
            "functionName": transferrableArray[i + TransferrableEventObj.FUNCTIONNAME_INDEX],
            "lockName": transferrableArray[i + TransferrableEventObj.LOCKNAME_INDEX],
            "startTime": (transferrableArray[i + TransferrableEventObj.STARTTIME_HIGH_INDEX] * TransferrableEventObj.HEX_0XFFFFFFFF) + transferrableArray[i + TransferrableEventObj.STARTTIME_LOW_INDEX],
            "endTime": (transferrableArray[i + TransferrableEventObj.ENDTIME_HIGH_INDEX] * TransferrableEventObj.HEX_0XFFFFFFFF) + transferrableArray[i + TransferrableEventObj.ENDTIME_LOW_INDEX],
            "stackDepth": transferrableArray[i + TransferrableEventObj.STACKDEPTH_INDEX]
        });
    }
    return minEventObjArray;
};
