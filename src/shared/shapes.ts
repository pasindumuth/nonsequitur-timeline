export class AjaxData {
    program: Program;
    functions: string[];
    timeframePanelsRaw: TimeframePanelRaw[];
}

export class Program {
    programData: ProgramData;
    threads: Thread[];
}

export class ProgramData {
    start: number;
    end: number;
    absoluteTimePrefix: string;
}

export class Thread {
    threadData: ThreadData;
    patterns: Pattern[];
}

export class ThreadData {
    start: number;
    end: number;
    numPatterns: number;
    threadID: string;
}

export class Pattern {
    patternData: PatternData;
    patternIntervals: number[][];
}

export class PatternData {
    start: number;
    end: number;
    patternShape: PatternShape;
    frequency: number;
    patternID: number;
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

    /**
     * @param pixelOffset: the pixel offset on the canvas
     * @returns: time that the pixel refers to
     */
    pixelToTime(pixelOffset: number): number{
        if (!(this.pixelStart <= pixelOffset && pixelOffset < this.pixelEnd)) return null;
        return Math.floor((this.end - this.start) * (pixelOffset - this.pixelStart) 
                        / (this.pixelEnd - this.pixelStart)) + this.start;
    }
}

export class PatternShape {
    depth: number;
    baseFunctions: {
        baseFunction: number;
        count: number
    }[];
    patternIds: {
        patternId: number;
        count: number
    }[];
}

