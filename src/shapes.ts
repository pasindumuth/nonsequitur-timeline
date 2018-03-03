export class AjaxData {
    program: Program;
    timeframePanelsRaw: TimeframePanelRaw[];
}

/**
 * There should at least be 1 thread.
 */
export class Program {
    programData: ProgramData;
    threads: Thread[];
}

/**
 * Because of the above, start < end.
 */
export class ProgramData {
    start: number;
    end: number;
}

/**
 * There should be at least 1 pattern.
 */
export class Thread {
    threadData: ThreadData;
    patterns: Pattern[];
}

/** 
 * Because of the above, start < end, 
 * and num Patterns > 0
 */
export class ThreadData {
    start: number;
    end: number;
    numPatterns: number;
    name: string;
    threadID: number;
}

/** 
 * There should be at least 1 interval, and
 * each interval is such that start < end.
 */
export class Pattern {
    patternData: PatternData;
    patternIntervals: number[][];
}

/** 
 * Because of the above, start < end, 
 * and frequency > 0.
 */
export class PatternData {
    patternID: number;
    start: number;
    end: number;
    frequency: number;
    absTimePrefix: string;
}

export class TimeframePanelRaw {
    start:number;
    end: number;
    resolution: number;
}

export class TimeframePanel {
    start: number;
    end: number;
    resolution: number;
    pixelStart: number;
    pixelEnd: number;
}
