import fs from 'fs';
import path from 'path';
import {Config} from './config'
import {Program, Thread, Pattern, TimeframePanelRaw, AjaxData, Metadata} from '../shared/shapes';
import Constants from '../shared/Constants'

const config: Config = require('./config.json');

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

 class Processor {

    static createTimeframePanelsRaw(program: Program): TimeframePanelRaw[] {
        let timeframePanelsRaw = new Array<TimeframePanelRaw>();
        let windowSize = Math.floor(program.duration / config.programConfig.NUM_SAMPLES);
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
}

class Filter {

    program: Program;

    constructor(program: Program) {
        this.program = program;
    }

    filterThreads(numPatternsToKeep: number) {
        for (let thread = 0; thread < this.program.threads.length; thread++) {
            this.filterThread(thread, numPatternsToKeep);
        }
    }

    /**
     * Some patterns from the pattern finding algorithm are not as important to show as others. 
     * Thus, we would like to select a subset of them for the purpose of visualization.
     * @param thread thread to filter the patterns of
     * @param numPatternsToKeep number of patterns to keep
     */
    filterThread(thread: number, numPatternsToKeep: number) {
        let patterns = this.program.threads[thread].patterns;
        console.log(patterns.length);
        patterns = Filter.filterByPatternFrequency(patterns, Constants.MIN_FREQUENCY);
        console.log(patterns.length);
        // patterns = Filter.filterBySim(patterns, numPatternsToKeep);
        patterns = Filter.filterByPatternShapeComplexity(patterns);
        console.log(patterns.length);
        this.program.threads[thread].patterns = patterns;
    }

    static filterByPatternShapeComplexity(patterns: Pattern[]): Pattern[] {
        let filteredPatterns = new Array<Pattern>();
        for (let pattern of patterns) {
            filteredPatterns.push(pattern);
        }

        return filteredPatterns;
    }

    static filterByPatternFrequency(patterns: Pattern[], threshold: number) {
        let filteredPatterns = new Array<Pattern>();
        for (let pattern of patterns) {
            if (pattern.intervals.length >= threshold) {
                filteredPatterns.push(pattern);
            }
        }

        return filteredPatterns;
    }
}


function main() : AjaxData {
    let threads = new Array<Thread>();
    let functions = fs.readFileSync(path.join(__dirname, Constants.FUNCTIONS_FILE), "utf-8").split("\n");
    
    for (let threadConfig of config.threads) {
        let threadFile = fs.readFileSync(path.join(__dirname, threadConfig.filePath), "utf-8");
        let patterns : Pattern[] = JSON.parse(threadFile);

        let thread: Thread = {
            id: threadConfig.threadID,
            patterns: patterns
        }

        threads.push(thread);
    }

    let metadataFile = fs.readFileSync(path.join(__dirname, config.programConfig.METADATA_PATH), "utf-8");
    let metadata : Metadata = JSON.parse(metadataFile);

    let program: Program = {
        absoluteStartTime: metadata.absoluteStartTime,
        duration: metadata.duration,
        threads: threads
    }

    let filter = new Filter(program);
    filter.filterThreads(5);

    let i = 1;
    for (let threads of program.threads) {
        for (let pattern of threads.patterns) {
            console.log(i.toString() + ": " + pattern.id);
            i++;
        }
    }

    let timeframePanelsRaw = Processor.createTimeframePanelsRaw(program);
    return {
        program: program,
        functions: functions,
        timeframePanelsRaw: timeframePanelsRaw
    }
}

export default main;
