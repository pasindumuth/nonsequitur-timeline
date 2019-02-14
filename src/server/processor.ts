import { cloneDeep } from 'lodash';
import fs from 'fs';
import path from 'path';
import {Config} from './config'
import {Program, Thread, Pattern, AjaxData, Metadata, StrippedPatternShape} from '../shared/shapes';
import Constants from '../shared/Constants'

const config: Config = require('./config.json');

class Filter {

    program: Program;

    constructor(program: Program) {
        this.program = program;
    }

    filterThreads() {
        this.filterThreadsByFrequency();
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
    // Ordering relation for patterns, -1, 0, 1 for <, =, > respectively.
    comparison = new Map<number, Map<number, number>>();

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
    sortStrippedShapes(strippedShapes: StrippedPatternShape[]): void {
        this.computeOrderingRelation(strippedShapes);
        strippedShapes.sort((s1, s2) => this.compare(s1.id, s2.id));
        for (const shape of strippedShapes) {
            shape.patternIds.sort(this.compare);
        }
    }

    computeOrderingRelation(strippedShapes: StrippedPatternShape[]): void {
        const shapes = cloneDeep(strippedShapes);
        shapes.sort((s1, s2) => s1.depth - s2.depth);
        for (const shape of shapes) {
            this.comparison.set(shape.id, new Map());
            this.comparison.get(shape.id).set(shape.id, 0);
        }
        for (let i1 = 0; i1 < shapes.length; i1++) {
            const shape1 = shapes[i1];
            shape1.patternIds.sort(this.compare);
            for (let i2 = 0; i2 < i1; i2++) {
                const shape2 = shapes[i2];
                shape2.patternIds.sort(this.compare);
                let comparedValue = this.compareFunction(shape1.baseFunction, shape2.baseFunction);
                if (comparedValue === 0) {
                    for (let i = 0;; i++) {
                        if (i === shape2.patternIds.length) {
                            comparedValue = 1;
                        } else if (i === shape1.patternIds.length) {
                            comparedValue = -1;
                        } else {
                            const childComparedValue = this.compare(shape1.patternIds[i], shape2.patternIds[i]);
                            if (childComparedValue === 0) {
                                continue;
                            } else {
                                comparedValue = childComparedValue;
                            }
                        }
                        break;
                    }
                }
                this.comparison.get(shape1.id).set(shape2.id, comparedValue);
                this.comparison.get(shape2.id).set(shape1.id, -comparedValue);
            }
        }
        this.verifyOrderingRelation()
    }

    compare = (patternId1: number, patternId2: number): number => {
        return this.comparison.get(patternId1).get(patternId2);
    };

    private compareFunction(functionId1: number, functionId2: number): number {
        if (functionId1 < functionId2) {
            return -1;
        } else if (functionId1 === functionId2) {
            return 0;
        } else {
            return 1;
        }
    }

    verifyOrderingRelation() {
        const patternIds = Array.from(this.comparison.keys());
        patternIds.sort(this.compare);
        for (let patternId of patternIds) {
            if (this.compare(patternId, patternId) !== 0) {
                console.error("Same patterns are equal according to the ordering relation.")
            }
        }
        for (let i1 = 0; i1 < patternIds.length; i1++) {
            for (let i2 = 0; i2 < i1; i2++) {
                if (this.compare(patternIds[i1], patternIds[i2]) !== 1
                 || this.compare(patternIds[i2], patternIds[i1]) !== -1) {
                    console.error("Patterns couldn't be linearized as it should be with the equivalence relation.");
                }
            }
        }
        console.log("Verified Ordering Relation.");
    }
}

function main() : AjaxData {
    const threads = new Array<Thread>();
    const strippedShapeMap = new Map<number, StrippedPatternShape>();
    for (let threadConfig of config.threads) {
        const threadFile = fs.readFileSync(path.join(__dirname, threadConfig.filePath), "utf-8");
        const patterns : Pattern[] = JSON.parse(threadFile);
        const thread: Thread = {
            id: threadConfig.threadID,
            patterns: patterns
        };
        threads.push(thread);

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

    let metadataFile = fs.readFileSync(path.join(__dirname, config.programConfig.METADATA_PATH), "utf-8");
    let metadata : Metadata = JSON.parse(metadataFile);
    let program: Program = {
        absoluteStartTime: metadata.absoluteStartTime,
        duration: metadata.duration,
        threads: threads
    };

    let filter = new Filter(program);
    filter.filterThreads();

    let i = 1;
    for (let threads of program.threads) {
        for (let pattern of threads.patterns) {
            console.log(i.toString() + ": " + pattern.id);
            i++;
        }
    }

    const functionsFile = fs.readFileSync(path.join(__dirname, Constants.FUNCTIONS_FILE), "utf-8");
    const functions : string[] = JSON.parse(functionsFile);
    const strippedPatternProcessor = new StrippedPatternProcessor();
    const strippedShapes = strippedPatternProcessor.completeStrippedShapes(functions.length, strippedShapeMap);
    strippedPatternProcessor.sortStrippedShapes(strippedShapes);
    return {
        program: program,
        functions: functions,
        strippedPatternShapes: strippedShapes,
    }
}

export default main;
