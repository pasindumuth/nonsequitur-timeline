export interface Config {
    programConfig: ProgramConfig;
    threads: ThreadConfig[];
}

export interface ProgramConfig {
    RESOLUTION: number; // nanoseconds per pixel
    RELATIVE_TIME_NUM_DIGITS: number;
    // Sampling the timeline we divide it up into NUM_SAMPLE intervals, and take a SAMPLE_RATIO fraction of it for display.
    SAMPLING_RATIO: number;
    NUM_SAMPLES: number; 
}

export interface ThreadConfig {
    threadID: string;
    numTopPatterns : number;
    filePath: string;
}
