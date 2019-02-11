export class AjaxData {
    program: Program;
    functions: string[];
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
