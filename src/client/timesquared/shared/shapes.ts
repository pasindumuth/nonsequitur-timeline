export class MetaData {
    startTime: number;
    endTime: number;
    minElapsedTime: number;
    maxStackDepth: number;
    threads: number[];
    events: string[];
    functions: string[];
    locknames: string[];
}

export class Event{
    threadName: string;
    functionName: string;
    lockName: string;
    startTime: number;
    endTime: number;
    stackDepth: number;
}