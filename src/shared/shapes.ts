export class AjaxData {
    program: Program;
    functions: string[];
    strippedPatternShapes: StrippedPatternShape[];
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
    representation: ShapeCluster;
    intervals: number[][];
}

export class ShapeCluster {
    id: number;
    depth: number;
    baseFunction: number;
    shapeIds: number[];
}

/**
 * This class fixes some of the problems with the patterns passed in.
 * We reintroduce singleFunctionPatterns, and we include the null pattern's
 * Occurance in the constituent patterns.
 */
export class StrippedPatternShape {
    readonly id: number;
    readonly depth: number;
    readonly baseFunction: number;
    readonly patternIds: number[];
}

// STORED DATA

export class StoredThread {
    id: string;
    patterns: StoredPattern[];
}

export class StoredPattern {
    id: number;
    representation: StoredPatternShape;
    intervals: number[][];
}

/**
 * The shape passed in omits the null pattern, omits single function
 * patterns, and ids of single function patterns is just the base
 * function id.
 */
export class StoredPatternShape {
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
