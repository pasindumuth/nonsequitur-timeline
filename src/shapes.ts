export class AjaxData {
    program: Program;
    timeframePanelsRaw: TimeframePanelRaw[];
}

export class Program {
    programData: ProgramData;
    threads: Thread[];
}

export class ProgramData {
    start: number;
    end: number;
}

export class Thread {
    threadData: ThreadData;
    patterns: Pattern[];
}

export class ThreadData {
    start: number;
    end: number;
    numPatterns: number;
    name: string;
    threadID: number;
}

export class Pattern {
    patternData: PatternData;
    patternIntervals: number[][];
}

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
