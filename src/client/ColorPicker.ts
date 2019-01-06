import Config from './Config';

export default class ColorPicker {
    programRibbonToPatternID: number[][];
    patternIDToColor: Map<number, string>;

    constructor(programRibbonToPatternID: number[][], patternIDs: Set<number>) {
        this.patternIDToColor = new Map<number, string>();
        this.programRibbonToPatternID = programRibbonToPatternID;
        this.setupThreadColors(patternIDs);
    }

    setupThreadColors(patternIDs: Set<number>) {
        let index = 0;
        for (let patternID of patternIDs) {
            this.patternIDToColor.set(patternID, Config.ALL_COLORS[index]);
            index++;
        }
    }

    getColor(threadNum: number, ribbonNum: number): string {
        return this.patternIDToColor.get(this.programRibbonToPatternID[threadNum][ribbonNum]);
    }
}
