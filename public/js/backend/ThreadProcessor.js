/*jslint node: true */
"use strict";

/**
 * Container and processor for thread-based data
 * @param threadNumber: Number: The number id for this thread
 */
var ThreadProcessor = function (threadNumber) {
    this.threadNumber = threadNumber;
    this.minStackDepth = 0;
    this.maxStackDepth = null;
    this.minElapsedTime = null;
    // stage all incomplete events prior during first pass
    this.eventStreamLastTimestamp = null;
    this.eventStream = [];
    // stage all events for processing after first pass
    this.events = [];
    // cache for all processed events
    this.processedEvents = undefined;
};

/**
 * processEvent
 * Store the event data during a first-pass through a dataset.
 * On a --> event, a new EventObj is created in the eventStream
 * On a <-- event, an EventObj is taken from the eventStream, updated, and moved to events
 * @param direction: String: "-->" or "<--"
 * @param functionName: String: name of the function
 * @param time: Number: timestamp
 * @param lockName: String: address of the lock
 * @return true if the event was correctly processed, false if an error occurred
 */
ThreadProcessor.prototype.processEvent = function (direction, functionName, time, lockName) {
    var stackDepth, eventObj, elapsedTime;
    
    switch (direction) {
    case "-->":
        stackDepth = this.eventStream.length + this.minStackDepth;
        eventObj = new EventObj(this.threadNumber, functionName, lockName, time, stackDepth);
        this.eventStream.push(eventObj);
        
        if (this.maxStackDepth === null || this.maxStackDepth < eventObj.relativeStackDepth) {
            this.maxStackDepth = eventObj.relativeStackDepth;
        }
        
        break;
        
    case "<--":
        if (this.eventStream.length === 0) {
            // We encountered an exit without a corresponding enter
            this.minStackDepth--;
            eventObj = new EventObj(this.threadNumber,functionName, lockName, 0, this.minStackDepth);
            eventObj.eventEnd(time);
            
            if (this.maxStackDepth === null || this.maxStackDepth < eventObj.relativeStackDepth) {
                this.maxStackDepth = eventObj.relativeStackDepth;
            }
        } else {
            eventObj = this.eventStream.pop();
            if (eventObj.functionName !== functionName || eventObj.lockName !== lockName) {
                console.log("Error: Sanity check failed. Unexpected event in stack");
                this.eventStream.push(eventObj);
                return false;
            }
            eventObj.eventEnd(time);
        }
        
        this.events.push(eventObj);
        break;
        
    default:
        console.log("Error: Invalid direction");
        return false;
    }
    
    // Calculate the minimum elapsed time between consecutive events
    elapsedTime = (time - this.eventStreamLastTimestamp);
    if (this.minElapsedTime === null || this.minElapsedTime > elapsedTime) {
        this.minElapsedTime = elapsedTime;
    }
    this.eventStreamLastTimestamp = time;
    
    return true;
};

/**
 * getMetadata
 * Returns the metadata for the events for this thread
 * @return Object: metadata
 */
ThreadProcessor.prototype.getMetadata = function() {
    var metadata = {
        stackDepth: this.maxStackDepth - this.minStackDepth + 1,
        minElapsedTime: this.minElapsedTime
    };
    return metadata;
};

/**
 * getProcessedEvents
 * Return the events captured from processLine() thus far
 * @param metadata: Metadata from the entire event trace
 */
ThreadProcessor.prototype.getProcessedEventsArray = function(metadata) {
    var i, eventObj, unprocessedEvent;
    
    // check cache
    if (this.processedEvents !== undefined) {
        return this.processedEvents;
    }
    
    // move all incomplete events into the completed event queue
    while (this.eventStream.length > 0) {
        eventObj = this.eventStream.pop();
        eventObj.eventEnd(metadata.endTime);
        this.events.push(eventObj);
    }
    
    // process all complete events
    for (i = 0; i < this.events.length; i++) {
        unprocessedEvent = this.events[i];
        unprocessedEvent.setStackDepth(this.minStackDepth);
        if (unprocessedEvent.startTime === 0) {
            unprocessedEvent.startTime = metadata.startTime;
        }
    }
    
    // create cache
    this.processedEvents = [];
    for (i = 0; i < this.events.length; i++) {
        this.processedEvents.push(this.events[i].minObject(metadata.functionsReverseLookup, metadata.locknamesReverseLookup));
    }
    
    // garbage
    this.events = undefined;
    
    return this.processedEvents;
};
