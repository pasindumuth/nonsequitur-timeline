export interface Config {
    programConfig: ProgramConfig;
    threads: ThreadConfig[];
}

export interface ProgramConfig {
    RESOLUTION: number;
    RELATIVE_TIME_NUM_DIGITS: number;
    SAMPLING_RATIO: number;
    NUM_SAMPLES: number; 
}

export interface ThreadConfig {
    threadID: string;
    numTopPatterns : number;
    filePath: string;
}
