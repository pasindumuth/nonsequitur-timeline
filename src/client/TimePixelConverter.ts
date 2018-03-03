import { TimeframePanelRaw, TimeframePanel } from '../shapes';

export default class TimePixelConverter {
    timeframePanels: TimeframePanel[];

    constructor(timeframePanelsRaw: TimeframePanelRaw[]) {
        this.timeframePanels = TimePixelConverter.refineTimeframePanels(timeframePanelsRaw);
        console.log(JSON.stringify(this.timeframePanels));
    }

    static refineTimeframePanels = function (timeframePanelsRaw: TimeframePanelRaw[]): TimeframePanel[] {
        let pixelOffset = 0;
        let timeframePanels = new Array<TimeframePanel>();
    
        for (let rawPanel of timeframePanelsRaw) {
            let refinedPanel = new TimeframePanel();
            refinedPanel.start = rawPanel.start;
            refinedPanel.end = rawPanel.end;
            refinedPanel.resolution = rawPanel.resolution;
            refinedPanel.pixelStart = pixelOffset;

            pixelOffset += Math.floor((refinedPanel.end - refinedPanel.start) / refinedPanel.resolution);
            refinedPanel.pixelEnd = pixelOffset;
            timeframePanels.push(refinedPanel);
        }

        return timeframePanels;
    }

    getTotalPixelLength(): number {
        let totalPixelLength = 0;
        if (this.timeframePanels.length > 0) {
            totalPixelLength = this.timeframePanels[this.timeframePanels.length - 1].pixelEnd + 1;
        }
        
        return totalPixelLength;
    }


    getPixelOffset(time: number): { pixelOffset: number; panel: number } {
        if (this.timeframePanels.length == 0) return null;
        if (time < this.timeframePanels[0].start) return null;
        let start = 0; 
        let end = this.timeframePanels.length;
    
        while (start < end) {
            let middle = Math.floor((start + end) / 2);
            let curPanel = this.timeframePanels[middle];
    
            if (time <= curPanel.start) end = middle;
            else start = middle + 1;
        }

        let index;
        if (start == this.timeframePanels.length 
         || time < this.timeframePanels[start].start) {
            index = start - 1;
        } else {
            index = start;
        }

        let curPanel = this.timeframePanels[index];
        if ((curPanel.start <= time) && (time <= curPanel.end)) {
            let timeDelta = time - curPanel.start;
            let pixelDelta = Math.floor(timeDelta / curPanel.resolution);
            let pixelOffset = pixelDelta + curPanel.pixelStart;
            let panel = index;
            return { pixelOffset, panel };
        } else {
            return null;
        }
    }
}
