import fs from 'fs';
import path from 'path';
import {Config} from './config'
import {
    Program,
    Thread,
    Pattern,
    AjaxData,
    Metadata,
    StrippedPatternShape,
    StoredPattern,
    StoredThread,
    ShapeCluster
} from '../shared/shapes';
import Constants from '../shared/Constants'
import ShapeMath from "../shared/ShapeMath";
import ShapeClusterer from "../shared/ShapeClusterer";

const config: Config = require('./config.json');

class Filter {

    program: Program;

    constructor(program: Program) {
        this.program = program;
    }

    filterThreads() {
        // this.filterThreadsByFrequency();
        this.filterToTop4PatternsPerDepthPerThreadBySpan();
    }

    filterThreadsByFrequency() {
        for (let i = 0; i < this.program.threads.length; i++) {
            let filteredPatterns = new Array<Pattern>();
            for (let pattern of this.program.threads[i].patterns) {
                if (pattern.intervals.length >= Constants.MIN_FREQUENCY) {
                    filteredPatterns.push(pattern);
                }
            }
            this.program.threads[i].patterns = filteredPatterns;
        }
    }

    filterToTop4PatternsPerDepthPerThreadBySpan() {
        for (let thread of this.program.threads) {
            this.filterToTop4PatternsPerDepthBySpan(thread);
        }

        let max = 0;
        let maxThread = "";
        for (let thread of this.program.threads) {
            for (let pattern of thread.patterns) {
                for (let interval of pattern.intervals) {
                    if (interval[1] > max) {
                        max = interval[1];
                        maxThread = thread.id;
                    }
                }
            }
        }
    }

    /**
     * Since all instances of all patterns for a given depth occur on disjoint time intervals,
     * ranking by span is a sensible solution, since that indicated prominence.
     */
    filterToTop4PatternsPerDepthBySpan(thread: Thread) {
        let maxDepth = 0;
        let patternIdToTotalSpan = new Map<number, number>();
        let patternIdToDepth = new Map<number, number>();
        for (let pattern of thread.patterns) {
            let id = pattern.id;
            let depth = pattern.representation.depth;
            maxDepth = Math.max(maxDepth, depth);
            let curSpan = patternIdToTotalSpan.has(id) ? patternIdToTotalSpan.get(id) : 0;
            patternIdToTotalSpan.set(id, curSpan + Filter.span(pattern.intervals));
            if (!patternIdToDepth.has(id)) {
                patternIdToDepth.set(id, depth);
            }
        }

        let patternsByDepth = new Array<number[]>();
        for (let depth = 0; depth <= maxDepth; depth++) {
            patternsByDepth.push([]);
        }

        for (let id of patternIdToDepth.keys()) {
            patternsByDepth[patternIdToDepth.get(id)].push(id);
        }

        let patternIdsToInclude = new Set<number>();
        for (let depth = 0; depth <= maxDepth; depth++) {
            patternsByDepth[depth].sort((id1, id2) =>
                patternIdToTotalSpan.get(id2) - patternIdToTotalSpan.get(id1)
            );
            for (let id of patternsByDepth[depth].slice(0, Constants.PATTERNS_PER_DEPTH)) {
                patternIdsToInclude.add(id);
            }
        }

        let filteredPatterns = new Array<Pattern>();
        for (let pattern of thread.patterns) {
            if (patternIdsToInclude.has(pattern.id)) {
                filteredPatterns.push(pattern);
            }
        }

        filteredPatterns.sort((p1, p2) => p1.representation.depth - p2.representation.depth);
        thread.patterns = filteredPatterns;
    }

    /** The sum of the lengths of the intervals. */
    static span(intervals: number[][]): number {
        let span = 0;
        for (let interval of intervals) {
            span += interval[1] - interval[0];
        }
        return span;
    }
}

class StrippedPatternProcessor {
    /**
     * Recall that single function patterns are treated differently than other patterns.
     * They are ommited when writing to disk, and the patternId of a single function
     * pattern is the functionId of it's base (as a result, their IDs are below the base
     * pattern ID).
     */
    completeStrippedShapes(
        numFunctions: number,
        strippedShapeMap: Map<number, StrippedPatternShape>
    ): StrippedPatternShape[] {
        for (let functionId = 0; functionId < numFunctions; functionId++) {
            strippedShapeMap.set(functionId, {
                id: functionId,
                depth: 1,
                baseFunction: functionId,
                patternIds: [Constants.NULL_PATTERN_ID],
            });
        }
        return [{
            id: Constants.NULL_PATTERN_ID,
            depth: 0,
            baseFunction: Constants.NULL_FUNCTION_ID,
            patternIds: [Constants.NULL_PATTERN_ID],
        }, ...Array.from(strippedShapeMap.values())];
    }

    /**
     * Sorts the stripped shapes according to the ordering of the functionIds.
     */
    sortStrippedShapes(strippedShapes: StrippedPatternShape[], shapeMath: ShapeMath): void {
        strippedShapes.sort((s1, s2) => shapeMath.compare(s1.id, s2.id));
        for (const shape of strippedShapes) {
            shape.patternIds.sort(shapeMath.compare);
        }
    }
}

class PatternConverter {
    storedThreads: StoredThread[];
    strippedShapes: StrippedPatternShape[];

    indexedShapeClusters = new Map<number, ShapeCluster>();

    constructor(storedThreads: StoredThread[], strippedShapes: StrippedPatternShape[], shapeMath: ShapeMath) {
        this.storedThreads = storedThreads;
        this.strippedShapes = strippedShapes;

        const shapeClusterer = new ShapeClusterer(strippedShapes, shapeMath);
        for (const shapeCluster of shapeClusterer.shapeClusters) {
            for (const shapeInClusterId of shapeCluster.shapeIds) {
                this.indexedShapeClusters.set(shapeInClusterId, shapeCluster);
            }
        }
    }

    convertPatterns(): Thread[] {
        const threads = new Array<Thread>();
        for (const storedThread of this.storedThreads) {
            const thread = this.convertPatternsForThread(storedThread);
            threads.push(thread);
        }
        if (Constants.VERIFY) {
            this.verifyNonOverlapping(threads);
        }
        return threads;
    }

    /**
     * A ShapeCluster is essentially a set of shapes with a designated representative shape,
     * making up the ShapeCluster's ID. For a give thread, a Pattern is an instance of a
     * shape. The Id of the Pattern is the Id of the ShapeCluster. An instance of a different
     * shape that is still in that shape clusters will be considered an instance of the Pattern.
     */
    private convertPatternsForThread(storedThread: StoredThread): Thread {
        const indexedPatterns = new Map<number, Pattern>();
        for (const storedPattern of storedThread.patterns) {
            const shapeCluster = this.indexedShapeClusters.get(storedPattern.id);
            if (!indexedPatterns.has(shapeCluster.id)) {
                indexedPatterns.set(shapeCluster.id, {
                    id: shapeCluster.id,
                    representation: shapeCluster,
                    intervals: [],
                })
            }
            const pattern = indexedPatterns.get(shapeCluster.id);
            for (const newInterval of storedPattern.intervals) {
                pattern.intervals.push(newInterval);
            }
        }
        const patterns = new Array<Pattern>();
        for (const pattern of indexedPatterns.values()) {
            pattern.intervals.sort((i1, i2) => i1[0] - i2[0]);
            patterns.push(pattern);
        }
        patterns.sort((p1, p2) => p1.representation.depth - p2.representation.depth);
        return {
            id: storedThread.id,
            patterns: patterns,
        }
    }

    private verifyNonOverlapping(threads: Thread[]) {
        for (const thread of threads) {
            const patternsByDepth = new Map<number, Pattern[]>();
            for (const pattern of thread.patterns) {
                const depth = pattern.representation.depth;
                if (!patternsByDepth.has(depth)) {
                    patternsByDepth.set(depth, []);
                }
                patternsByDepth.get(depth).push(pattern);
            }
            for (const depth of patternsByDepth.keys()) {
                const patterns = patternsByDepth.get(depth);
                const allIntervals = new Array<Array<number>>();
                for (const pattern of patterns) {
                    for (const interval of pattern.intervals) {
                        allIntervals.push(interval);
                    }
                }
                allIntervals.sort((i1, i2) => i1[0] - i2[0]);
                for (let i = 1; i < allIntervals.length; i++) {
                    if (allIntervals[i][0] < allIntervals[i - 1][1]) {
                        console.error('Patterns with same depth have overlapping intervals');
                    }
                }
                const span = allIntervals.reduce((sum, i) => sum + i[1] - i[0], 0);
                console.log('span for (thread: ' + thread.id + ', depth: ' + depth + '): ' + span);
            }
        }
        console.log('Pattern overlapping properties verified.')
    }
}

function main() : AjaxData {
    const storedThreads = new Array<StoredThread>();
    const strippedShapeMap = new Map<number, StrippedPatternShape>();
    for (let threadConfig of config.threads) {
        const threadFile = fs.readFileSync(path.join(__dirname, threadConfig.filePath), "utf-8");
        const patterns : StoredPattern[] = JSON.parse(threadFile);
        const thread: StoredThread = {
            id: threadConfig.threadID,
            patterns: patterns
        };
        storedThreads.push(thread);

        for (const pattern of patterns) {
            if (!strippedShapeMap.has(pattern.id)) {
                const shape = pattern.representation;
                const baseFunctions = shape.baseFunctions.map(val => val.baseFunction);
                const patternIds = shape.patternIds.map(val => val.patternId);
                strippedShapeMap.set(pattern.id, {
                    id: pattern.id,
                    depth: shape.depth,
                    baseFunction: baseFunctions[0],
                    patternIds: [Constants.NULL_PATTERN_ID, ...patternIds],
                });
            }
        }
    }

    const functionsFile = fs.readFileSync(path.join(__dirname, Constants.FUNCTIONS_FILE), "utf-8");
    const functions : string[] = JSON.parse(functionsFile);

    const strippedPatternProcessor = new StrippedPatternProcessor();
    const strippedShapes = strippedPatternProcessor.completeStrippedShapes(functions.length, strippedShapeMap);
    const shapeMath = new ShapeMath(strippedShapes);
    strippedPatternProcessor.sortStrippedShapes(strippedShapes, shapeMath);

    const patternConverter = new PatternConverter(storedThreads, strippedShapes, shapeMath);
    const threads = patternConverter.convertPatterns();

    let metadataFile = fs.readFileSync(path.join(__dirname, config.programConfig.METADATA_PATH), "utf-8");
    let metadata : Metadata = JSON.parse(metadataFile);
    let program: Program = {
        absoluteStartTime: metadata.absoluteStartTime,
        duration: metadata.duration,
        threads: threads
    };

    let filter = new Filter(program);
    filter.filterThreads();

    console.log('done processing');

    return {
        program: program,
        functions: functions,
        strippedPatternShapes: strippedShapes,
    }
}

export default main;
