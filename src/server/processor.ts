import fs from 'fs';
import path from 'path';
import stripJsonComments from 'strip-json-comments';
import { Config, ProgramConfig, ThreadConfig } from './config'
import { AjaxData, Program, ProgramData, Thread, ThreadData, Pattern, TimeframePanelRaw } from '../shapes';

const config: Config = require('./config.json');

const QUERIES_PATH = "queries.json";
const NUM_QUERIES_FOR_PATTERN = 10;

/**
 * Since the absolute time is larger that the maximum possible javascript number, we assume 
 * that all the digits prior to the last 15 stay the same for the whole trace 
 * (which is all reasonable assumption to make, since 15 digits correspond to 10000 seconds). 
 * However, this leaves the possilibty for this parsing algorithm to break if by any chance, 
 * the last 15 digits are close to the max value, resulting in a wrap around later in the trace. 
 * 
 * We must fix this at some point.
 */

/**
 * Analysis of sampling: 
 * SAMPLING_RATIO and NUM_SAMPLES reduce the compressed timewindow by x1000. The duration of the
 * execution is 60G ns. Our RESOLUTION is 2M ns. We see that if we increase our NUM_SAMPLES by
 * another x10, then our compressed window will only 6M ns. This results in a lot of data loss
 * due to rounding error of the 3rd pixel (since 6M / 2M is 3). 
 * 
 * This phenomenon is unavoidable; the fundamental tension is between having a lot of pixels per
 * frame, and having a lots of frames (as samples). We cannot have both; we need to chose a balance.
 * 
 * One thing to help with reducing data loss is to choose these values dynamically such that dataloss
 * is minimized.
 */


function getPatterns(filePath: string): {patterns: Pattern[], absTimePrefix: string } {
    let data = fs.readFileSync(path.join(__dirname, filePath), "utf-8");
    let lines = data.split("\n");

    let absTimePrefix = null;

    let i = 0;
    while (lines[i].charAt(0) != "#") {
        i++;
    }

    let patterns = new Array<Pattern>();
    while (lines[i].length > 0) {
        let k = i + 4,
            j = 0;

        let intervals = [];
        let patternStart = Number.MAX_VALUE;
        let patternEnd = 0;
        while (lines[k + j].length > 0 && lines[k + j].charAt(0) != "#") {
            let line = lines[k + j],
                interval = [];

            let pair = line.split(" : "),
                start = pair[0];
            
            if (start.length >= config.programConfig.RELATIVE_TIME_NUM_DIGITS) {
                let oldStart = start;
                start = oldStart.substring(oldStart.length - config.programConfig.RELATIVE_TIME_NUM_DIGITS, oldStart.length);
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
            },
            patternIntervals: intervals
        })

        i = k + j;
    }

    return { patterns, absTimePrefix };
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

function getProgramData(threads: Thread[]): { start: number, end: number } {
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

function absoluteTimeToRelativeTime(program: Program): Program {
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

    // We leave programStart and programEnd alone, since we
    // don't want to lose all information about the former aboslute time.
    
    return program;
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

function createQueries(program: Program): void {
    let threads = program.threads;
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
                let query = createQuery(program.programData.absoluteTimePrefix, interval[0], interval[1], thread.threadData.threadID);
                patternQueries.push(query);
            }

            threadQueries.push(patternQueries);
        }

        queries.push(threadQueries);
    }

    fs.writeFileSync(path.join(__dirname, QUERIES_PATH), JSON.stringify(queries, null, 4));
}

function createTimeframePanelsRaw(program: Program): TimeframePanelRaw[] {
    let timeframePanelsRaw = new Array<TimeframePanelRaw>();
    let windowSize = Math.floor((program.programData.end - program.programData.start) / config.programConfig.NUM_SAMPLES);
    let compressedWindowSize = Math.floor(windowSize * config.programConfig.SAMPLING_RATIO);

    for (let i = 0; i < config.programConfig.NUM_SAMPLES; i++) {
        timeframePanelsRaw.push({
            start: i * windowSize,
            end: i * windowSize + compressedWindowSize,
            resolution: config.programConfig.RESOLUTION
        });
    }

    return timeframePanelsRaw;
}

function main(): AjaxData {
    let threads = new Array<Thread>();
    let absoluteTimePrefix: string = null;
    for (let threadConfig of config.threads) {
        let { patterns, absTimePrefix } = getPatterns(threadConfig.filePath);
        console.log(absTimePrefix);
        if (absoluteTimePrefix == null) absoluteTimePrefix = absTimePrefix;
        patterns = getTopPatterns(patterns, threadConfig.numTopPatterns);

        let thread: Thread = {
            threadData: getThreadData(patterns, threadConfig),
            patterns: patterns
        }

        threads.push(thread);
    }

    let program: Program = {
        programData: { ...getProgramData(threads), ...{ absoluteTimePrefix } },
        threads: threads
    }

    createQueries(program);
    program = absoluteTimeToRelativeTime(program);
    let timeframePanelsRaw = createTimeframePanelsRaw(program);
    return {program, timeframePanelsRaw};
}

export default main;
