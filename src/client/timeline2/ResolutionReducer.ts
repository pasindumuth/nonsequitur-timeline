import {Pattern, PatternShape, Program} from "../../shared/shapes";

export default class ResolutionReducer {

    program: Program;
    width: number;

    /** The mined data, and the width of the (high resolution) canvas (about 2000px). */
    constructor(program: Program, width: number) {
        this.program = program;
        this.width = width;
    }

    /**
     * The pattern intervals are in the space of nanoseconds over the course of 60 seconds, which is
     * far to granular to display across the screen on an HTML Canvas, which has a width of about 2000 pixels.
     * This algorithm partitions the time space into as many pixels there are in the width, and intelligently
     * chooses which pattern to show per partition, in an attempt to convey what is happening in general.
     */
    intervalToPixelTransform(): Map<string, LowResolutionPattern[][]> {
        let patternsPerDepthPerThread = new Map<string, Pattern[][]>();
        for (let thread of this.program.threads) {
            let maxDepth = 0;
            for (let pattern of thread.patterns) {
                maxDepth = Math.max(maxDepth, pattern.representation.depth);
            }
            let patternsByDepth = new Array<Pattern[]>();
            for (let i = 0; i <= maxDepth; i++) {
                patternsByDepth.push([]);
            }
            for (let pattern of thread.patterns) {
                patternsByDepth[pattern.representation.depth].push(pattern);
            }
            patternsPerDepthPerThread.set(thread.id, patternsByDepth);
        }

        let reducedResolutedProgram = new Map<string, LowResolutionPattern[][]>();
        for (let thread of this.program.threads) {
            let reducedResolutionThread = new Array<LowResolutionPattern[]>();
            let patternsByDepth = patternsPerDepthPerThread.get(thread.id);
            for (let depth = 0; depth < patternsByDepth.length; depth++) {
                reducedResolutionThread.push(this.computeOffsets(patternsByDepth[depth]));
            }
            reducedResolutedProgram.set(thread.id, reducedResolutionThread)
        }
        return reducedResolutedProgram;
    }

    /**
     *  We have a set of patterns for a given depth in a given thread. For every time partition,
     *  we simply choose the pattern that has the largest span in the partition.
     */
    computeOffsets(patterns: Pattern[]) : LowResolutionPattern[] {
        let result = new Array<LowResolutionPattern>();
        // for each pattern, we calculate and store its span for each partition.
        let spanPerPartitionPerPattern = new Array<number[]>();
        let totalTimePerPartition = Math.floor(this.program.duration / this.width); // time is always an integer
        for (let pattern of patterns) {
            let spanPerPartition = new Array<number>();
            let intervals = pattern.intervals;
            let currentIntervalIndex = 0;
            for (let i = 0; i < this.width; i++) {
                // calculate the span in the current partition.
                let partitionStartTime = totalTimePerPartition * i;
                let partitionEndTime = partitionStartTime + partitionStartTime;
                let span = 0;

                // move the current interval until the end is passed the current partition, adding the lengths
                // of all intervals (clamped by the partition) to the partitions span.
                for (; currentIntervalIndex < intervals.length &&
                       intervals[currentIntervalIndex][1] <= partitionEndTime; currentIntervalIndex++) {
                    let interval = intervals[currentIntervalIndex];
                    let clampedStartTime = Math.min(Math.max(partitionStartTime, interval[0]), partitionEndTime);
                    let clampedEndTime = Math.max(Math.min(partitionEndTime, interval[1]), partitionStartTime);
                    span += clampedEndTime - clampedStartTime;
                }
                spanPerPartition.push(span);
            }
            spanPerPartitionPerPattern.push(spanPerPartition);
        }

        if (patterns.length == 0) {
            return result;
        }

        // The pattern we chose for each partition will be the one with the largest span there.
        let offsets = new Array<number[]>(); // the pixel offsets for each pattern
        for (let i = 0; i < patterns.length; i++) {
            offsets.push([]);
        }
        for (let i = 0; i < this.width; i++) {
            let maxPatternIndex = 0;
            let maxSpan = 0;
            for (let j = 0; j < patterns.length; j++) {
                if (spanPerPartitionPerPattern[j][i] > maxSpan) {
                    maxPatternIndex = j;
                    maxSpan = spanPerPartitionPerPattern[j][i];
                }
            }
            offsets[maxPatternIndex].push(i);
        }

        for (let i = 0; i < patterns.length; i++) {
            result.push({
                id: patterns[i].id,
                representation: patterns[i].representation,
                pixelOffsets: offsets[i]
            });
        }
        return result;
    }
}

export class LowResolutionPattern {
    id: number;
    representation: PatternShape;
    pixelOffsets: number[];
}

export class ProcessedPattern {
    threadId: string;
    depth: number;
    patternId: number;
    offsets: number[];
}