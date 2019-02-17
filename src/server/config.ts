export interface Config {
    programConfig: ProgramConfig;
    threads: ThreadConfig[];
}

export interface ProgramConfig {
    METADATA_PATH: string;
}

export interface ThreadConfig {
    threadID: string;
    filePath: string;
}
