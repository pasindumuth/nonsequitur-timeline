import {Pattern, Program, ShapeCluster} from "../shared/shapes";

export default class ResolutionReducer {
    program: Program;
    width: number;

    // COMPUTE VALUES
    reducedResolutionProgram = new Map<string, LowResolutionPattern[][]>();

    // first index in the value is depth, second is horizontal offset, and the third is the interval
    sampleIntervalPerOffsetPerDepthPerThread = new Map<string, number[][][]>();
    patternPerOffsetPerDepthPerThread = new Map<string, Pattern[][]>();


    /**
     * The mined data, and the width of the (high resolution) canvas (about 2000px).
     * The pattern intervals are in the space of nanoseconds over the course of 60 seconds, which is
     * far too granular to display across the screen on an HTML Canvas, which has a width of about 2000 pixels.
     * This algorithm partitions the time space into as many pixels there are in the width, and intelligently
     * chooses which pattern to show per partition, in an attempt to convey what is happening in general.
     */
    constructor(program: Program, width: number) {
        this.program = program;
        this.width = width;

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

        for (let thread of this.program.threads) {
            let reducedResolutionThread = new Array<LowResolutionPattern[]>();
            let sampleIntervalPerOffsetPerDepth = new Array<number[][]>();
            let patternPerOffsetPerThread = new Array<Pattern[]>();
            let patternsByDepth = patternsPerDepthPerThread.get(thread.id);
            for (let depth = 0; depth < patternsByDepth.length; depth++) {
                let result = this.computeOffsets(patternsByDepth[depth]);
                reducedResolutionThread.push(result.reducedResolutionPatterns);
                sampleIntervalPerOffsetPerDepth.push(result.sampleIntervalPerOffset);
                patternPerOffsetPerThread.push(result.patternPerOffset);
            }
            this.reducedResolutionProgram.set(thread.id, reducedResolutionThread)
            this.sampleIntervalPerOffsetPerDepthPerThread.set(thread.id, sampleIntervalPerOffsetPerDepth);
            this.patternPerOffsetPerDepthPerThread.set(thread.id, patternPerOffsetPerThread);
        }
    }

    /**
     *  We have a set of patterns for a given depth in a given thread. For every time partition,
     *  we simply choose the pattern that has the largest span in the partition.
     */
    computeOffsets(patterns: Pattern[]): {
        reducedResolutionPatterns: LowResolutionPattern[],
        sampleIntervalPerOffset: number[][],
        patternPerOffset: Pattern[]
    } {
        let reducedResolutionPatterns = new Array<LowResolutionPattern>();
        let sampleIntervalPerOffset = new Array<number[]>();
        let patternPerOffset = new Array<Pattern>();
        let result = {
            reducedResolutionPatterns: reducedResolutionPatterns,
            sampleIntervalPerOffset: sampleIntervalPerOffset,
            patternPerOffset: patternPerOffset
        };
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
                let partitionEndTime = partitionStartTime + totalTimePerPartition;
                let span = 0;

                // move the current interval until the end is passed the current partition, adding the lengths
                // of all intervals (clamped by the partition) to the partitions span.
                for (; currentIntervalIndex < intervals.length &&
                       intervals[currentIntervalIndex][1] < partitionEndTime; currentIntervalIndex++) {
                    let interval = intervals[currentIntervalIndex];
                    let clampedStartTime = Math.min(Math.max(partitionStartTime, interval[0]), partitionEndTime);
                    let clampedEndTime = Math.max(Math.min(partitionEndTime, interval[1]), partitionStartTime);
                    span += clampedEndTime - clampedStartTime;
                }
                if (currentIntervalIndex < intervals.length) {
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

        let offsets = new Array<number[]>(); // the pixel offsets for each pattern
        for (let i = 0; i < patterns.length; i++) {
            offsets.push([]);
        }

        // To choose a pattern, we create a distribution (including lack of pattern), scale by some
        // upscale function, and randomly sample.
        let numberCycle: Cycle0To1 = new Cycle0To1();
        for (let i = 0; i < this.width; i++) {
            let originalDistribution = new Array<number>();
            let nonEmptySpanOfPartition = 0;
            for (let j = 0; j < patterns.length; j++) {
                originalDistribution.push(spanPerPartitionPerPattern[j][i] / totalTimePerPartition);
                nonEmptySpanOfPartition += spanPerPartitionPerPattern[j][i];
            }
            originalDistribution.push((totalTimePerPartition - nonEmptySpanOfPartition) / totalTimePerPartition);

            // Distribution where values are square rooted and normalized.
            let root: number[] = originalDistribution.map(v => Math.pow(v, 1/4));
            let normal: number = root.reduce((a, b) => a + b, 0);
            let normalizedRoot: number[] = root.map(v => v / normal);

            let next = numberCycle.next();
            let j = 0;
            for (; j < normalizedRoot.length - 1 && normalizedRoot[j] <= next; j++) {
                next -= normalizedRoot[j];
            }
            if (j < patterns.length) {
                // We hit a pattern
                offsets[j].push(i);
                sampleIntervalPerOffset[i] = this.findSampleInterval(patterns[j], totalTimePerPartition * (i + 1));
                patternPerOffset[i] = patterns[j];
            }
        }

        for (let i = 0; i < patterns.length; i++) {
            reducedResolutionPatterns.push({
                id: patterns[i].id,
                representation: patterns[i].representation,
                pixelOffsets: offsets[i]
            });
        }
        return result;
    }

    /** Finds the latest interval that started strictly before the provided time. */
    findSampleInterval(pattern: Pattern, time: number): number[] {
        let intervals = pattern.intervals;
        // perform binary search
        let start = 0;
        let end = intervals.length;
        while (start < end) {
            let middle = Math.floor((start + end) / 2);
            if (intervals[middle][0] < time) {
                start = middle + 1;
            } else {
                end = middle;
            }
        }
        return intervals[start];
    }
}

class Cycle0To1 {
    random = 0;

    // Returns a uniformly distributed number between 1 - 100. This isn't random
    // because it's a cycle, but the generated numbers are evenly spaced out.
    next(): number {
        this.random = (this.random + 31) % 100;
        return this.random / 100;
    }
}

export class LowResolutionPattern {
    id: number;
    representation: ShapeCluster;
    pixelOffsets: number[];
}
