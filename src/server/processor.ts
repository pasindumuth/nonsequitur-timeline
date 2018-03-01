import fs from 'fs';
import path from 'path';
import stripJsonComments from 'strip-json-comments';
import { Config, ProgramConfig, ThreadConfig } from './config'

const config: Config = require('./config.json');

const QUERIES_PATH = "queries.json";
const NUM_QUERIES_FOR_PATTERN = 10;

/**
 * TODO: write queries to better place
 * Need to avoid initialization errors...
 */

function getPatterns(filePath: string): Pattern[] {
    let data = fs.readFileSync(path.join(__dirname, filePath), "utf-8");
    let lines = data.split("\n");

    let i = 0;
    while (lines[i].charAt(0) != "#") {
        i++;
    }

    let patterns = new Array<Pattern>();
    while (lines[i].length > 0) {
        let k = i + 4,
            j = 0;

        let intervals = [];
        let absTimePrefix = "";
        let patternStart = Number.MAX_VALUE;
        let patternEnd = 0;
        while (lines[k + j].length > 0 && lines[k + j].charAt(0) != "#") {
            let line = lines[k + j],
                interval = [];

            let pair = line.split(" : "),
                start = pair[0];

            /**
             * Since the absolute time is larger that the maximum possible javascript number, we assume 
             * that all the digits prior to the last 15 stay the same for the whole trace 
             * (which is all reasonable assumption to make, since 15 digits correspond to 10000 seconds). 
             * However, this leaves the possilibty for this parsing algorithm to break if by any chance, 
             * the last 15 digits are close to the max value, resulting in a wrap around later in the trace. 
             * 
             * We must fix this at some point.
             */
            
            if (start.length >= config.programConfig.RELATIVE_TIME_NUM_DIGITS) {
                let oldStart = start;
                start = oldStart.substring(start.length - config.programConfig.RELATIVE_TIME_NUM_DIGITS, start.length);
                absTimePrefix = oldStart.substring(0, oldStart.length - config.programConfig.RELATIVE_TIME_NUM_DIGITS);
            }

            let startInt = parseInt(start);
            let endInt = startInt + parseInt(pair[1]);
            interval.push(startInt);
            interval.push(endInt);
            intervals.push(interval);

            if (startInt < patternStart) patternStart = startInt;
            if (endInt > patternEnd) patternEnd = endInt;

            j++;
        }

        patterns.push({
            patternData: {
                patternID: parseInt(lines[i + 1]),
                start: patternStart,
                end: patternEnd,
                frequency: intervals.length,
                absTimePrefix: absTimePrefix
            },
            patternIntervals: intervals
        })

        i = k + j;
    }

    return patterns;
}

function getThreadData(patterns: Pattern[], threadConfig: ThreadConfig): ThreadData {
    let threadStart = Number.MAX_VALUE;
    let threadEnd = 0; 

    for (let pattern of patterns) {
        if (pattern.patternData.start < threadStart) threadStart = pattern.patternData.start;
        if (pattern.patternData.end > threadEnd) threadEnd = pattern.patternData.end;
    }

    return {
        start: threadStart,
        end: threadEnd,
        numPatterns: patterns.length,
        name: threadConfig.name,
        threadID: threadConfig.threadID
    }
}

function getProgramData(threads: Thread[]): ProgramData {
    let programStart = Number.MAX_VALUE;
    let programEnd = 0; 

    for (let thread of threads) {
        if (thread.threadData.start < programStart) programStart = thread.threadData.start;
        if (thread.threadData.end > programEnd) programEnd = thread.threadData.end;
    }

    return {
        start: programStart,
        end: programEnd
    };
}

/**
 * Selection policy is based on frequency
 */

function getTopPatterns (patterns: Pattern[], numTopPatterns: number): Pattern [] {
    patterns.sort(function (a: Pattern, b: Pattern) {
        return b.patternData.frequency - a.patternData.frequency;
    });

    let topPatterns = new Array<Pattern>();
    for (let i = 0; i < numTopPatterns && i < patterns.length; i++) {
        topPatterns.push(patterns[i]);
    }

    return topPatterns;
}

function absoluteTimeToRelativeTime(program: Program) {
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

// let filterIntervals = function (program, maxRelativeTime) {

//     for (let thread of program.threads) {
//         for (let pattern of thread.patterns) {
//             let newPatternIntervals = [];
//             for (let interval of pattern.patternIntervals) {
//                 if (interval[1] > maxRelativeTime) break;
//                 newPatternIntervals.push(interval);
//             }

//             pattern.patternIntervals = newPatternIntervals;
//         }
//     }
// }

function createQuery(absTimePrefix: string, timeStart: number, timeEnd: number, threadNum: number): string {
    return "SELECT dir, func, tid, time FROM trace "
         + "WHERE " 
         + absTimePrefix + timeStart.toString() 
         + " <= time AND time <= " 
         + absTimePrefix + timeStart.toString() + " + " + (timeEnd - timeStart).toString() 
         + " and tid = " + threadNum.toString() 
         + ";";
}

function createQueries(threads: Thread[]): void {
    let queries = [];
    for (let i = 0; i < threads.length; i++) {
        let threadQueries = [];

        let thread = threads[i];
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

function main(): AjaxData {
    let threads = new Array<Thread>();
    for (let threadConfig of config.threads) {
        let patterns = getPatterns(threadConfig.filePath);
        patterns = getTopPatterns(patterns, threadConfig.numTopPatterns);

        let thread: Thread = {
            threadData: getThreadData(patterns, threadConfig),
            patterns: patterns
        }

        threads.push(thread);
    }

    let program: Program = {
        programData: getProgramData(threads),
        threads: threads
    }

    createQueries(threads);
    absoluteTimeToRelativeTime(program);

    let timeframePanelsRaw = new Array<TimeframePanelRaw>();
    timeframePanelsRaw.push({
        start: program.programData.start,
        end: program.programData.end,
        resolution: config.programConfig.RESOLUTION
    })

    return {program, timeframePanelsRaw};
}

export default main;