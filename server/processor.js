"use strict";

let fs = require("fs");
let path = require("path");
let stripJsonComments = require("strip-json-comments");

let CONFIG_PATH = "config.json";
let config;
let programConfig;

let QUERIES_PATH = "queries.json";
let NUM_QUERIES_FOR_PATTERN = 10;

/**
 * Since the absolute time is larger that the masximum possible javascript number, we assume 
 * that all the digits prior to the last 15 stay the same for the whole trace 
 * (which is all reasonable assumption to make, since 15 digits correspond to 10000 seconds). 
 * However, this leaves the possilibty for this parsing algorithm to break if by any chance, 
 * the last 15 digits are close to the max value, resulting in a wrap around later in the trace. 
 * 
 * We must fix this at some point, since this is a big flaw.
 */

let Program = function () {
    this.programData = {};
    this.threads = [];
}

let Thread = function () {
    this.threadData = {};
    this.patterns = [];
}

let Pattern = function () {
    this.patternData = {};
    this.patternIntervals = [];
}

let processThreadRaw = function (filePath) {
    let data = fs.readFileSync(path.join(__dirname, filePath), "utf-8");
    let lines = data.split("\n");
    let thread = new Thread();

    let i = 0;
    while (lines[i].charAt(0) != "#") {
        i++;
    }

    while (lines[i].length > 0) {
        let pattern = new Pattern();
        let patternStart = Number.MAX_SAFE_INTEGER;
        let patternEnd = 0;

        pattern.patternData.patternID = parseInt(lines[i + 1]);

        let k = i + 4,
            j = 0;

        while (lines[k + j].length > 0 && lines[k + j].charAt(0) != "#") {
            let line = lines[k + j],
                interval = [];

            let pair = line.split(" : "),
                start = pair[0];
            
            if (start.length >= programConfig.RELATIVE_TIME_NUM_DIGITS) {
                let oldStart = start;
                start = oldStart.substring(start.length - programConfig.RELATIVE_TIME_NUM_DIGITS, start.length);
                pattern.patternData.absTimePrefix = oldStart.substring(0, oldStart.length - programConfig.RELATIVE_TIME_NUM_DIGITS);
            } else {
                pattern.patternData.absTimePrefix = "";
            }

            let startInt = parseInt(start);
            let endInt = startInt + parseInt(pair[1]);
            interval.push(startInt);
            interval.push(endInt);
            pattern.patternIntervals.push(interval);

            if (startInt < patternStart) patternStart = startInt;
            if (endInt > patternEnd) patternEnd = endInt;

            j++;
        }

        pattern.patternData.frequency = pattern.patternIntervals.length;
        pattern.patternData.start = patternStart;
        pattern.patternData.end = patternEnd;
        thread.patterns.push(pattern);

        i = k + j;
    }

    thread.threadData = getThreadData(thread.patterns);

    return thread;
}

let getThreadData = function (patterns) {
    let threadData = {};
    let threadStart = Number.MAX_SAFE_INTEGER;
    let threadEnd = 0; 

    for (let pattern of patterns) {
        if (pattern.patternData.start < threadStart) threadStart = pattern.patternData.start;
        if (pattern.patternData.end > threadEnd) threadEnd = pattern.patternData.end;
    }

    threadData.start = threadStart;
    threadData.end = threadEnd;
    threadData.numPatterns = patterns.length;

    return threadData;
}

let getProgramData = function (threads) {
    let programData = {};
    let programStart = Number.MAX_SAFE_INTEGER;
    let programEnd = 0; 

    for (let thread of threads) {
        if (thread.threadData.start < programStart) programStart = thread.threadData.start;
        if (thread.threadData.end > programEnd) programEnd = thread.threadData.end;
    }

    programData.start = programStart;
    programData.end = programEnd;

    return programData;
}

/**
 * Selection policy is based on frequency
 */

let getTopPatterns = function (thread, numTopPatterns) {
    let patterns = thread.patterns;
    patterns.sort(function (a, b) {
        return b.patternData.frequency - a.patternData.frequency;
    });

    let topPatterns = [];
    for (let i = 0; i < numTopPatterns && i < patterns.length; i++) {
        topPatterns.push(patterns[i]);
    }

    let newThread = new Thread();
    newThread.threadData = getThreadData(topPatterns);
    newThread.patterns = topPatterns;

    return newThread;
}

let absoluteTimeToRelativeTime = function (program) {
    let programStart = program.programData.start;
    
    for (let thread of program.threads) {
        for (let pattern of thread.patterns) {
            for (let interval of pattern.patternIntervals) {
                interval[0] -= programStart;
                interval[1] -= programStart;
            }

            pattern.patternData.start -= programStart;
            pattern.patternData.end -= programStart;
        }

        thread.threadData.start -= programStart;
        thread.threadData.end -= programStart;
    }

    program.programData.start -= programStart;
    program.programData.end -= programStart;
}

let filterIntervals = function (program, maxRelativeTime) {

    for (let thread of program.threads) {
        for (let pattern of thread.patterns) {
            let newPatternIntervals = [];
            for (let interval of pattern.patternIntervals) {
                if (interval[1] > maxRelativeTime) break;
                newPatternIntervals.push(interval);
            }

            pattern.patternIntervals = newPatternIntervals;
        }
    }
}

let createQuery = function (absTimePrefix, timeStart, timeEnd, threadNum) {
    return "SELECT dir, func, tid, time FROM trace "
         + "WHERE " 
         + absTimePrefix + timeStart.toString() 
         + " <= time AND time <= " 
         + absTimePrefix + timeStart.toString() + " + " + (timeEnd - timeStart).toString() 
         + " and tid = " + threadNum.toString() 
         + ";";
}

let createQueries = function (program) {
    let queries = [];
    for (let i = 0; i < program.threads.length; i++) {
        let threadQueries = [];

        let thread = program.threads[i];
        for (let j = 0; j < thread.patterns.length; j++) {
            let patternQueries = [];

            let pattern = thread.patterns[j];
            let intervals = pattern.patternIntervals;
            for (let k = 0; k < intervals.length && k < NUM_QUERIES_FOR_PATTERN; k++) {
                let interval = intervals[k];
                let query = createQuery(pattern.patternData.absTimePrefix, interval[0], interval[1], thread.threadData.threadID);
                patternQueries.push(query);
            }

            threadQueries.push(patternQueries);
        }

        queries.push(threadQueries);
    }

    fs.writeFileSync(path.join(__dirname, QUERIES_PATH), JSON.stringify(queries, null, 4));
}


let main = function () {
    config = JSON.parse(stripJsonComments(fs.readFileSync(path.join(__dirname, CONFIG_PATH), "utf-8")));
    programConfig = config.programConfig;
    
    let program = new Program();

    for (let threadProcessData of config.threads) {
        let thread = processThreadRaw(threadProcessData.filePath);
        thread = getTopPatterns(thread, threadProcessData.numTopPatterns);

        //hack: fix later
        thread.threadData.name = threadProcessData.name;
        thread.threadData.threadID = threadProcessData.threadID;

        program.threads.push(thread);
    }

    createQueries(program);

    program.programData = getProgramData(program.threads);
    absoluteTimeToRelativeTime(program);

    let timeframePanelsRaw = [];
    let panel = {};
    panel.start = program.programData.start;
    panel.end = program.programData.end;
    panel.resolution = programConfig.RESOLUTION;
    timeframePanelsRaw.push(panel);

    return {program, timeframePanelsRaw};
}


module.exports = {
    main: main
}