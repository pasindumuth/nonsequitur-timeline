export class AjaxData {
    program: Program;
    functions: string[];
    timeframePanelsRaw: TimeframePanelRaw[];
}

export class Program {
    absoluteStartTime: string;
    duration: number;
    threads: Thread[];
}

export class Thread {
    id: string;
    patterns: Pattern[];
}

export class Pattern {
    id: number;
    representation: PatternShape;
    intervals: number[][];
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

export class Metadata {
    absoluteStartTime: string;
    absoluteEndTime: string;
    duration: number;
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

