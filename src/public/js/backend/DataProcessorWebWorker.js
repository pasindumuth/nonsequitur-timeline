/*jslint node: true */
"use strict";

var window = self;
importScripts(
    "../lib/sift.min.js",
    "ThreadProcessor.js",
    "../shared/EventObj.js",
    "DataProcessor.js",
    "../shared/TransferrableEventObj.js"
);

var DP;

var processRawData = function(data) {
    var i,
        progress,
        datalines = data.split("\n");
    
    console.log("Starting Data Processor...");
    DP = new DataProcessor();
    for (i = 0; i < datalines.length - 1; i++) {
        if (i % 10000 === 0) {
            progress = Math.floor(i * 100 / datalines.length);
            postMessage(["progressUpdate", progress]);
        }
        DP.processLine(datalines[i]);
    }
    
    console.log("Sending metadata...");
    postMessage(["metadata", DP.getMetadata()]);
    
    console.log("Processing events...");
    DP.prepareProcessedEvents();
};

onmessage = function(e) {
    var eventObjArray,
        nextEvent,
        fromTime,
        toTime,
        threshold,
        query;
    
    switch(e.data[0]) {
    case "rawdata":
        processRawData(e.data[1]);
        break;
		
    case "queryRawData":
        processQueryRawData(e.data[1]);
        break;
        
    case "requestCompressedRegions":
        fromTime = e.data[1];
        toTime = e.data[2];
        threshold = e.data[3];
        postMessage(["compressedRegions", DP.getCompressedRegions(fromTime, toTime, threshold)]);
        break;
    
    case "sift":
        query = e.data[1];
        eventObjArray = DP.sift(query);
        nextEvent = TransferrableEventObj.toTransferrableArray(eventObjArray);
        postMessage(nextEvent.buffer, [nextEvent.buffer]);
        break;
    
    default:
        console.log("Unexpected message: " + e.data[0]);
    }
};

console.log("WebWorker: Loaded and ready");
