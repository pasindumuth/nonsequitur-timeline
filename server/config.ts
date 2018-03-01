export interface Config {
    programConfig: ProgramConfig;
    threads: ThreadConfig[];
}

export interface ProgramConfig {
    RESOLUTION: number;
    RELATIVE_TIME_NUM_DIGITS: number;
    MAX_RELATIVE_TIME: number;
}

export interface ThreadConfig {
    name : string;
    threadID: number;
    numTopPatterns : number;
    filePath: string;
}