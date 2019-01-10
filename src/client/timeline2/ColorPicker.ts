import Config from '../Config';

export default class ColorPicker {
    patternIdToColor: Map<number, string>;

    constructor(patternIds: Set<number>) {
        this.patternIdToColor = new Map<number, string>();
        this.setupThreadColors(patternIds);
    }

    setupThreadColors(patternIds: Set<number>) {
        let index = 0;
        for (let patternId of patternIds) {
            this.patternIdToColor.set(patternId, Config.ALL_COLORS[index]);
            index++;
        }
    }
}
