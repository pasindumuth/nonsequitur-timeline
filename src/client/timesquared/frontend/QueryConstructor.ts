/*jslint node: true */
"use strict";

export default class QueryConstructor {

    static queryTime(startTime, endTime, queryObj?) {
        if (queryObj === undefined) {
            queryObj = {};
        }
        
        queryObj.startTime = {$and: [{$gte: startTime}, {$lt: endTime}]};
        
        return queryObj;
    }

    static queryThread(threadName, queryObj) {
        if (queryObj === undefined) {
            queryObj = {};
        }
        
        if (threadName.constructor === Array) {
            queryObj.threadName = {$or: threadName};
        } else {
            queryObj.threadName = threadName;
        }
        
        return queryObj;
    }
}