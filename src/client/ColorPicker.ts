import Config from './Config';
import Canvas from './Canvas';

export default class ColorPicker {
    threadPatternToColor: Map<number, string>;
    colorToThreadPattern: Map<string, number>;

    constructor(programRibbonData: number[]) {
        this.threadPatternToColor = new Map<number, string>();
        this.colorToThreadPattern = new Map<string, number>();
        this.setupThreadColors(programRibbonData);
    }

    setupThreadColors(programRibbonData: number[]) {
        let index = 0;
        for (let i = 0; i < programRibbonData.length; i++) {
            let ribbons = programRibbonData[i];
            for (let j = 0; j < ribbons; j++) {
                let color = Config.ALL_COLORS[index]; 
                // assume 100 is a valid namespace base for the threads
                this.threadPatternToColor.set(ColorPicker.hash(i, j), color); 
                this.colorToThreadPattern.set(color, ColorPicker.hash(i, j));
                index++;
            }
        }
    }

    // getThreadPattern(color: string) {
    //     let hash = this.colorToThreadPattern.get(color);
    //     let threadPattern: any = {};
    //     threadPattern.threadNum = hash / 100;
    //     threadPattern.ribbonNum = hash % 100;
    //     return threadPattern;
    // }

    getColor(threadNum: number, ribbonNum: number): string {
        return this.threadPatternToColor.get(ColorPicker.hash(threadNum, ribbonNum));
    }

    static hash(threadNum: number, ribbonNum: number): number {
        return threadNum * 100 + ribbonNum;
    }
}
