/*jslint node: true */
"use strict";

var QueryConstructor = function () {
    // Empty constructor
    return;
};

QueryConstructor.queryTime = function (startTime, endTime, queryObj) {
    if (queryObj === undefined) {
        queryObj = {};
    }
    
    queryObj.startTime = {$and: [{$gte: startTime}, {$lt: endTime}]};
    
    return queryObj;
};

QueryConstructor.queryThread = function (threadName, queryObj) {
    if (queryObj === undefined) {
        queryObj = {};
    }
    
    if (threadName.constructor === Array) {
        queryObj.threadName = {$or: threadName};
    } else {
        queryObj.threadName = threadName;
    }
    
    return queryObj;
};