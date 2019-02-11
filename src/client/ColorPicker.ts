import Constants from "./Constants";

export default class ColorPicker {
    patternIdToColor: Map<number, string> = new Map<number, string>();

    constructor(patternIds: Set<number>) {
        let index = 0;
        for (let patternId of patternIds) {
            this.patternIdToColor.set(patternId, Constants.ALL_COLORS[index]);
            index++;
        }
    }
}
