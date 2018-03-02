import { TimeframePanelRaw, TimeframePanel } from '../shapes';

export default class TimePixelConverter {
    timeframePanels: TimeframePanel[];

    constructor(timeframePanelsRaw: TimeframePanelRaw[]) {
        this.timeframePanels = TimePixelConverter.refineTimeframePanels(timeframePanelsRaw);
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
            refinedPanel.pixelEnd = pixelOffset + Math.floor((refinedPanel.end - refinedPanel.start) / refinedPanel.resolution);
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
        let timeframePanels = this.timeframePanels;
        let firstPanel = timeframePanels[0];
        if (time < firstPanel.start) return null;
    
        let start = 0; 
        let end = timeframePanels.length - 1;
    
        while (start != end) {
            let middle = Math.floor((start + end) / 2);
            let curPanel = timeframePanels[middle];
    
            if (curPanel.start <= time) end = middle;
            else start = middle + 1;
        }
    
        let curPanel = timeframePanels[start];
        if ((curPanel.start <= time) && (time <= curPanel.end)) {
            let timeDelta = time - curPanel.start;
            let pixelDelta = Math.floor(timeDelta / curPanel.resolution);
            let pixelOffset = pixelDelta + curPanel.pixelStart;
            let panel = start;
            return {pixelOffset, panel};
        } else {
            return null;
        }
    }
}
