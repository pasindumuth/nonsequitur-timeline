class AjaxData {
    program: Program;
    timeframePanelsRaw: TimeframePanelRaw[];
}

class Program {
    programData: ProgramData;
    threads: Thread[];
}

class ProgramData {
    start: number;
    end: number;
}

class Thread {
    threadData: ThreadData;
    patterns: Pattern[];
}

class ThreadData {
    start: number;
    end: number;
    numPatterns: number;
    name: string;
    threadID: number;
}

class Pattern {
    patternData: PatternData;
    patternIntervals: number[][];
}

class PatternData {
    patternID: number;
    start: number;
    end: number;
    frequency: number;
    absTimePrefix: string;
}

class TimeframePanelRaw {
    start:number;
    end: number;
    resolution: number;
}

class TimeframePanel {
    start: number;
    end: number;
    resolution: number;
    pixelStart: number;
    pixelEnd: number;
}
