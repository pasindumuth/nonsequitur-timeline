/*jslint node: true */
"use strict";

/**
 * Wrapper object for a time interval between two logged events
 */
var TimeInterval = function (startTime, endTime) {
    this.startTime = startTime;
    this.endTime = endTime;
};

/**
 * Top-level Data Processor for the TimeSquared data visualization tool.
 */
var DataProcessor = function () {
    this.startTime = null;
    this.lastTimestamp = null;
    this.threads = {};
    this.eventSet = new Set();
    this.functionSet = new Set();
    this.locknameSet = new Set();
    this.timeIntervals = [];
    this.query = null;
    
    // Staging variables for requests
    this.metadata = undefined;
    this.allProcessedEvents = undefined;
    this.processedCompressedRegions = [];
    
    /**
     * Private method.
     * Delegates the raw event data to a ThreadProcessor which will process the data
     * @param direction: String: "-->" or "<--"
     * @param functionName: String: name of the function
     * @param thread: Number: thread number
     * @param time: Number: timestamp
     * @param lockname: String: address of the lock
     * @return true if the event was correctly processed, false if an error occurred
     */
    this.processEvent = function (direction, functionName, thread, time, lockName) {
        var eventName;
        
        if (this.startTime === null) {
            this.startTime = time;
        }
        
        // Add our funcname+lockname to our metadata
        if (lockName !== "") {
            eventName = functionName + ":::" + lockName;
        } else {
            eventName = functionName;
        }
        this.eventSet.add(eventName);
        this.functionSet.add(functionName);
        this.locknameSet.add(lockName);
        
        // Track our time intervals for our metadata
        if (this.lastTimestamp !== null) {
            this.timeIntervals.push(new TimeInterval(this.lastTimestamp, time));
        }
        this.lastTimestamp = time;
        
        // Have the appropriate ThreadProcessor handle the specific event data
        if (!(this.threads.hasOwnProperty(thread))) {
            this.threads[thread] = new ThreadProcessor(thread);
        }
        
        return this.threads[thread].processEvent(direction, functionName, time, lockName);
    };
    
    /**
     * Private method.
     * Creates a reverse lookup for an array
     * @param list: List to create reverse lookup
     * @return dict object for reverse lookup
     */
    this.createReverseLookup = function(list) {
        var i,
            dict = {};
        
        for (i = 0; i < list.length; i++) {
            dict[list[i]] = i;
        }
        
        return dict;
    };
};

/**
 * processLine
 * Processes a formatted log line for TimeSquared.
 * eg. "--> __wt_fs_unlock 33 1456966516531713211 0x18e45b8"
 * @param line: formatted TimeSquared log line
 * @return true if the event was correctly processed, false if an error occurred
 */
DataProcessor.prototype.processLine = function (line) {
    var line_contents = line.split(" "),
        i,
        direction = line_contents[0],
        functionName = line_contents[1],
        thread = Number(line_contents[2]),
        time = Number(line_contents[3]),
        lockName = line_contents[4] || "";
		
	if (direction === 0 || direction === "0") {
		direction = "-->";
	} else if (direction === 1 || direction === "1") {
		direction = "<--";
	}
	
	if (lockName === "null") {
		lockName = "";
	} else {
		// Lock names may be separated by spaces. Replace spaces with _
		for (i = 5; i < line_contents.length; i++) {
			lockName += "_" + line_contents[i];
		}
	}
    
    return this.processEvent(direction, functionName, thread, time, lockName);
};

/**
 * getMetadata
 * Returns the metadata for the log data that has been processed thus far
 * @return metadata
 */
DataProcessor.prototype.getMetadata = function () {
    var metadata, t,
        maxStackDepth = 0,
        minElapsedTime = null,
        threads = Object.keys(this.threads),
        threadNames = [],
        threadProcessor;
    
    // If no cached metadata exists, create it
    if (this.metadata === undefined) {
        
        for (t = 0; t < threads.length; t++) {
            threadProcessor = this.threads[threads[t]];
            
            threadNames.push(threadProcessor.threadNumber);
            metadata = threadProcessor.getMetadata();
            
            if (maxStackDepth < metadata.stackDepth) {
                maxStackDepth = metadata.stackDepth;
            }
            
            if (minElapsedTime === null ||
                (metadata.minElapsedTime !== null && minElapsedTime > metadata.minElapsedTime)) {
                minElapsedTime = metadata.minElapsedTime;
            }
        }
        
        // This JSON conforms to the ProcessedMetadata schema in render.json
        this.metadata = {
            startTime: this.startTime,
            endTime: this.lastTimestamp,
            minElapsedTime: minElapsedTime,
            maxStackDepth: maxStackDepth,
            threads: threadNames,
            events: Array.from(this.eventSet.values()),
            functions: Array.from(this.functionSet.values()),
            locknames: Array.from(this.locknameSet.values())
        };
        this.metadata.eventsReverseLookup = this.createReverseLookup(this.metadata.events);
        this.metadata.functionsReverseLookup = this.createReverseLookup(this.metadata.functions);
        this.metadata.locknamesReverseLookup = this.createReverseLookup(this.metadata.locknames);
    }
    
    return this.metadata;
};

/**
 * Returns all time intervals which exceed thresholdInterval
 */
DataProcessor.prototype.getCompressedRegions = function(fromTime, toTime, thresholdInterval) {
    var i,
        result = [],
        timeIntervalObj;
    
    for (i = 0; i < this.timeIntervals.length; i++) {
        timeIntervalObj = this.timeIntervals[i];
        if (timeIntervalObj.startTime < toTime &&
            timeIntervalObj.endTime > fromTime &&
            timeIntervalObj.endTime - timeIntervalObj.startTime > thresholdInterval) {
            result.push(timeIntervalObj);
        }
    }
    
    return result;    
};

/**
 * prepareProcessedEvents
 * This function must be called after all events have been processed from
 * the logfile. This converts all processed events into eventObj instances.
 * @returns number of events
 */
DataProcessor.prototype.prepareProcessedEvents = function () {
    var t = 0,
        metadata,
        threadEvents,
        threads = Object.keys(this.threads);
    
    // create cache if needed
    if (this.allProcessedEvents === undefined) {
        metadata = this.getMetadata();
        
        this.allProcessedEvents = [];
        for (t = 0; t < threads.length; t++) {
            threadEvents = this.threads[threads[t]].getProcessedEventsArray(metadata);
            // Garbage collect our thread processors
            this.threads[threads[t]] = null;
            this.allProcessedEvents = this.allProcessedEvents.concat(threadEvents);
        }
        
        // We no longer need our thread processors
        this.threads = null;
    }
    
    console.log("Prepared " + this.allProcessedEvents.length + " events");
    return this.allProcessedEvents.length;
};

/**
 * sift
 * Get all events which satisfy a sift query
 * @param query: a sift query object
 * @return: array of eventObj which satisfy the query
 */
DataProcessor.prototype.sift = function (query) {
    return sift(query, this.allProcessedEvents);
};
