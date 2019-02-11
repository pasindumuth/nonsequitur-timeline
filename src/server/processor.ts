import fs from 'fs';
import path from 'path';
import {Config} from './config'
import {Program, Thread, Pattern, AjaxData, Metadata} from '../shared/shapes';
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


function main() : AjaxData {
    let threads = new Array<Thread>();
    for (let threadConfig of config.threads) {
        let threadFile = fs.readFileSync(path.join(__dirname, threadConfig.filePath), "utf-8");
        let patterns : Pattern[] = JSON.parse(threadFile);
        let thread: Thread = {
            id: threadConfig.threadID,
            patterns: patterns
        };

        threads.push(thread);
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

    let functionsFile = fs.readFileSync(path.join(__dirname, Constants.FUNCTIONS_FILE), "utf-8");
    let functions : string[] = JSON.parse(functionsFile);
    return {
        program: program,
        functions: functions,
    }
}

export default main;
