/*jslint node: true */
"use strict";

/**
 * Wrapper object for an event's data
 * @param functionName: String: name of the function
 * @param lockname: String: address of the lock
 * @param startTime: Number: timestamp
 * @param relativeStackDepth: Number: stack depth relative to other eventObj instances for this thread
 */
var EventObj = function (threadNumber, functionName, lockName, startTime, relativeStackDepth) {
    this.eventId = threadNumber + functionName + startTime;
    this.threadName = threadNumber;
    this.functionName = functionName;
    this.lockName = lockName;
    this.startTime = startTime;
    this.relativeStackDepth = relativeStackDepth;
    
    // values to be defined later
    this.stackDepth = null;
    this.endTime = null;
};

/**
 * eventEnd
 * Sets the endTime for an eventObj
 * @param endTime: Number: timestamp
 */
EventObj.prototype.eventEnd = function (endTime) {
    this.endTime = endTime;
};

/**
 * elapsedTime
 * Returns the elapsed time for this eventObj instance
 * @return Number: elapsedTime
 */
EventObj.prototype.elapsedTime = function () {
    return this.endTime - this.startTime;
};

/**
 * setStackDepth
 * Sets the absolute stack depth for this eventObj relative to the
 * minimum stack depth provided
 * @param threadMinStackDepth: Number: absolute minimum stack depth for all 
                                        events in this thread
 */
EventObj.prototype.setStackDepth = function (threadMinStackDepth) {
    this.stackDepth = this.relativeStackDepth - threadMinStackDepth;
};

/**
 * minObject
 * Creates a minimized object. Normalizes the function name and lock name
 * @param functionsReverseLookup: normalization dict for function names (from metadata)
 * @param locknamesReverseLookup: normalization dict for locknames (from metadata)
 * @return minimized object
 */
EventObj.prototype.minObject = function(functionsReverseLookup, locknamesReverseLookup) {
    return {
        "threadName": this.threadName,
        "functionName": functionsReverseLookup[this.functionName],
        "lockName": locknamesReverseLookup[this.lockName],
        "startTime": this.startTime,
        "endTime": this.endTime,
        "stackDepth": this.stackDepth
    };
};