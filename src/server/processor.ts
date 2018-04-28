import fs from 'fs';
import path from 'path';
import stripJsonComments from 'strip-json-comments';
import { Config, ProgramConfig, ThreadConfig } from './config'
import { AjaxData, Program, ProgramData, Thread, ThreadData, Pattern, TimeframePanelRaw } from '../shared/shapes';
import Utils from '../shared/Utils'
import Constants from '../shared/Constants'

const config: Config = require('./config.json');

const QUERIES_PATH = "queries.json";
const NUM_QUERIES_FOR_PATTERN = 10;
 
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

    /**
     * Since DINAMITE has timestamps in nanoseconds, the integer values
     * of the timestamps are too large to hold in javascripts `number` type. Thus, we have to
     * split these timestamps into 2 strings. Because javascript can only safely hold 15 digits in it's `number` type,
     * we split the timestamps so that the second segmenet has a length of 15. We call the first string the 
     * 'absoluteTimePrefix', and the second string the 'absolutTimeSuffix'. We call 'absolueTimePrefix + absoluteTimeSuffix' 
     * the 'absoluteTime'. Importantly, we assume that the absoluteTimePrefix of all timestamps in the 
     * entire trace are the same. This is reasonable to assume, since 10e15 ns = 10e6 s. Since the traces
     * are only 60s long it's unlikely the timestamps will occur at the border for this 10e6 timewindow.
     */

     /**
      * We assume that the intervals in the pattern file are ordered by the start timestamps. And that the
      * intervals for a given pattern are disjoint.
      */
     
    static getPatterns(lines: string[]): {patterns: Pattern[], absTimePrefix: string } {
        let absTimePrefix = null;

        let i = 0;
        while (lines[i].charAt(0) != "#") {
            i++;
        }

        let patterns = new Array<Pattern>();
        while (lines[i].length > 0) {
            let j = i + 4;

            let intervals = [];
            let patternStart = Number.MAX_VALUE;
            let patternEnd = 0;
            while (lines[j].length > 0 && lines[j].charAt(0) != "#") {
                let line = lines[j],
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
                    patternShape: lines[i + 2],
                    start: patternStart,
                    end: patternEnd,
                    frequency: intervals.length,
                },
                patternIntervals: intervals
            })

            i = j;
        }

        return { patterns, absTimePrefix };
    }

    static getThreadData(patterns: Pattern[], threadConfig: ThreadConfig): ThreadData {
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
            threadID: threadConfig.threadID
        }
    }

    static getProgramData(threads: Thread[]): { start: number, end: number } {
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

    static getTopPatterns(patterns: Pattern[], numTopPatterns: number): Pattern [] {
        patterns.sort(function (a: Pattern, b: Pattern) {
            return b.patternData.frequency - a.patternData.frequency;
        });

        let topPatterns = new Array<Pattern>();
        for (let i = 0; i < numTopPatterns && i < patterns.length; i++) {
            topPatterns.push(patterns[i]);
        }

        return topPatterns;
    }

    static absoluteTimeToRelativeTime(program: Program): Program {
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

    static createQueries(program: Program): void {
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
                    let query = Utils.createQuery(program.programData.absoluteTimePrefix, interval[0], interval[1], thread.threadData.threadID);
                    patternQueries.push(query);
                }

                threadQueries.push(patternQueries);
            }

            queries.push(threadQueries);
        }

        fs.writeFileSync(path.join(__dirname, QUERIES_PATH), JSON.stringify(queries, null, 4));
    }

    static createTimeframePanelsRaw(program: Program): TimeframePanelRaw[] {
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
            if (pattern.patternData.patternShape.split(",").length > 1) {
                filteredPatterns.push(pattern);
            }
        }

        return filteredPatterns;
    }

    static filterByPatternFrequency(patterns: Pattern[], threshold: number) {
        let filteredPatterns = new Array<Pattern>();
        for (let pattern of patterns) {
            if (pattern.patternData.frequency >= threshold) {
                filteredPatterns.push(pattern);
            }
        }

        return filteredPatterns;
    }

    /**
     * Filters the given patterns based on a graph clustering approach. Each pattern is
     * considered as a node in a fully connect graph, where each edge has a weight that
     * measures the amount the two patterns are similar. We take the subset of patterns
     * that have the minimal average similarity. That is, considering all edges between
     * all nodes in the subset, if we were to take the average of the edge weights, then
     * the chosen subset results in the lowest such average.
     * 
     * The above criterion is a reasonable way to select a subset. We want to choose patterns
     * that have as little in common, so that we can visualize a diveristy of patterns in 
     * a limited amount of screen realestate. 
     * 
     * @param patterns patterns we want to take a meaningful subset of
     * @param subsetSize the size of the subset we want to select. subsetSize <= len(patterns)
     * @return filtered patterns
     */
    static filterBySim(patterns: Pattern[], subsetSize: number): Pattern[] {
    
        // Create a matrix with the similarity between the patterns.
        // Note we will now refer to patterns as nodes.
        let sim = new Array<number[]>();
        for (let pattern1 of patterns) {
            let simRow = new Array<number>();
            for (let pattern2 of patterns) {
                simRow.push(Filter.getPatternSim(pattern1, pattern2));
            }
            sim.push(simRow);
        }

        Utils.symmetrify(sim);

        // for (let i = 0; i < sim.length; i++) {
        //     console.log(sim[i][i]);
        // }

        // Initialize set of all nodes
        let nodes = new Set<number>();
        for (let i = 0; i < patterns.length; i++) {
            nodes.add(i);
        }

        // Initialize the subset of nodes with some random nodes.
        let subset = new Set<number>();
 
        let allNodes = new Array<number>();
        for (let i = 0; i < patterns.length; i++) {
            allNodes.push(i);
        }

        Utils.shuffle(allNodes);
        for (let i = 0; i < subsetSize; i++) {
            subset.add(allNodes[i]);
        }

        // Create an array that maps nodes to the sum of the edge weights
        // to the nodes in the subset. This is needed to make our algorithm fast. 
        // The values of this array summarize how similar a node is to the subset. 
        // Therefore, we shall call it subsetSimilarity.

        let subsetSimilariy = new Array<number>();
        for (let i = 0; i < nodes.size; i++) {
            subsetSimilariy.push(0);
            for (let n of subset) {
                subsetSimilariy[i] += sim[i][n];
            }
        }

        // Initialize the total subset similarity. This is simply the sum of the edge weights
        // between nodes in the subset. It is this intraSubsetSimilarity value that we want to minimize.

        let intraSubsetSimilarity = 0; 
        for (let n1 of subset) {
            for (let n2 of subset) {
                intraSubsetSimilarity += sim[n1][n2];
                if (n1 == n2) {
                    intraSubsetSimilarity += sim[n1][n2];
                }
            }
        }

        intraSubsetSimilarity /= 2; // the above code results in twice the desired value

        // Algorithm for minimizing the intraSubsetSimilarity
        // We iterate through all pairs of nodes (nodeInsideSubset, nodeOutsideSubset), and if
        // removing nodeInsideSubset from the subset and adding nodeOutsideSubset into the subset
        // results in a smaller intraSubsetSimiliarity, then we make the swap and restart the algorithm.
        // The algorithm terminates where there are no more swaps left that can lower the 
        // intraSubsetSimilarity.

        while (true) {
            let didSwap = false;
            for (let nodeInsideSubset of subset) {
                for (let nodeOutsideSubset of nodes) {
                    if (nodeOutsideSubset in subset) continue;

                    // Calculate intraSubsetSimilarity if nodeInsideSubset switches
                    // with nodeOutsideSubset
                    let newIntraSubsetSimilarty = intraSubsetSimilarity 
                                                - subsetSimilariy[nodeInsideSubset]
                                                + subsetSimilariy[nodeOutsideSubset]
                                                - sim[nodeInsideSubset][nodeOutsideSubset]
                                                + sim[nodeOutsideSubset][nodeOutsideSubset];

                    if (newIntraSubsetSimilarty < intraSubsetSimilarity) {
                        // Replace nodeInsideSubset with nodeOutsideSubset
                        subset.delete(nodeInsideSubset);
                        subset.add(nodeOutsideSubset);

                        intraSubsetSimilarity = newIntraSubsetSimilarty;
                        for (let i = 0; i < subsetSimilariy.length; i++) {
                            subsetSimilariy[i] += sim[i][nodeOutsideSubset]
                                                - sim[i][nodeInsideSubset];
                        }

                        didSwap = true;
                        break;
                    }
                }

                if (didSwap) break;
            }

            console.log(intraSubsetSimilarity);
            if (!didSwap) break;
        }

        let filteredPatterns = new Array<Pattern>();
        for (let n of subset) {
            filteredPatterns.push(patterns[n]);
        }

        return filteredPatterns;
    }



    /**
     * Similarity between 2 patterns is defined according as the ratio of the span
     * of their pattern intervals intersect, to the span of their pattern intervals union.
     * This similarity measure is symmetric
     * @param p1 first pattern
     * @param p2 second pattern
     */
    static getPatternSim(pattern1: Pattern, pattern2: Pattern) {
        let intervals1 = pattern1.patternIntervals;
        let intervals2 = pattern2.patternIntervals;

        let intersectSpan = Filter.calculateIntersectSpan(intervals1, intervals2);
        let span1 = 0; 
        for (let interval of intervals1) {
            span1 += interval[1] - interval[0];
        }

        let span2 = 0;
        for (let interval of intervals2) {
            span2 += interval[1] - interval[0];
        }

        let unionSpan = span1 + span2 - intersectSpan;

        let sim = intersectSpan / unionSpan;
        return sim;
    }

    /**
     * Finds the intersect of two sets of intervals. 
     * Each parameter is a set of intervals (with len(intervals) => 0), such that
     * for each interval [i, j], i <= j, and intervals[i][1] <= intervals[j][0] if and only if i <= j
     */
    static calculateIntersectSpan(intervals1: number[][], intervals2: number[][]): number {
        let i1 = 0;
        let i2 = 0; 

        let intersectSpan = 0;
        // TODO: figure out why this works
        while (i1 < intervals1.length && i2 < intervals2.length) {
            intersectSpan += Math.max(Math.min(intervals1[i1][1], intervals2[i2][1]) - Math.max(intervals1[i1][0], intervals2[i2][0]), 0);
            if (intervals1[i1][1] < intervals2[i2][1]) i1++;
            else i2++;
        }

        return intersectSpan;
    }
}


function main() {
    let threads = new Array<Thread>();
    let absoluteTimePrefix: string = null;
    
    let functions = fs.readFileSync(path.join(__dirname, Constants.FUNCTIONS_FILE), "utf-8").split("\n");
    
    for (let threadConfig of config.threads) {
        let lines = fs.readFileSync(path.join(__dirname, threadConfig.filePath), "utf-8").split("\n");
        let { patterns, absTimePrefix } = Processor.getPatterns(lines);
        if (absoluteTimePrefix == null) absoluteTimePrefix = absTimePrefix;

        // The pattern intervals are ordered
        patterns = Processor.getTopPatterns(patterns, threadConfig.numTopPatterns);

        let thread: Thread = {
            threadData: Processor.getThreadData(patterns, threadConfig),
            patterns: patterns
        }

        threads.push(thread);
    }

    let program: Program = {
        programData: { ...Processor.getProgramData(threads), ...{ absoluteTimePrefix } },
        threads: threads
    }

    let filter = new Filter(program);
    filter.filterThreads(5);

    let thread = program.threads[0];
    // let p1 = thread.patterns[2];
    // let p2 = thread.patterns[4];

    // let c1 = 0; 
    // for (let i of p1.patternIntervals) {
    //     c1 += i[1] - i[0];
    // }

    // let c2 = 0; 
    // for (let i of p2.patternIntervals) {
    //     c2 += i[1] - i[0];
    // }

    // console.log("spans: " + c1 + " " + c2);
    // console.log("spans: " + p1.patternData.patternID + " " + p2.patternData.patternID);
    // console.log("sim 3, 5", Filter.getPatternSim(thread.patterns[2], thread.patterns[4]));


    for (let threads of program.threads) {
        for (let pattern of threads.patterns) {
            console.log(pattern.patternData.patternID);
        }
    }

    Processor.createQueries(program);
    program = Processor.absoluteTimeToRelativeTime(program);
    let timeframePanelsRaw = Processor.createTimeframePanelsRaw(program);
    return {  
        program: program,
        functions: functions,
        timeframePanelsRaw: timeframePanelsRaw
    }
}

export default main;
