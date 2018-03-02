import $ from 'jquery';
import Canvas from './Canvas';
import Config from './Config';
import ProgramTimelineDrawer from './drawers/ProgramTimelineDrawer';
import TimelineBarDrawer from './drawers/TimelineBarDrawer';
import SidebarDrawer from './drawers/SidebarDrawer';

export default class TimelineVis {
    canvas: Canvas;
    programTimelineDrawer: ProgramTimelineDrawer;
    timelineBarDrawer: TimelineBarDrawer;
    sidebarDrawer: SidebarDrawer;

    timeframePanels: TimeframePanel[];

    timelineStartTime: number;
    timelineEndTime: number;

    threadPatternToColor: Map<number, string>;
    colorToThreadPattern: Map<string, number>;

    constructor(timeframePanelsRaw: TimeframePanelRaw[], programRibbonData: number[], width: number) {
        this.timeframePanels = TimelineVis.refineTimeframePanels(timeframePanelsRaw);
        let totalPixelLength = TimelineVis.getTotalPixelLength(this.timeframePanels);

        this.canvas = new Canvas(programRibbonData, totalPixelLength, width - Config.CANVAS_MARGIN);
        this.programTimelineDrawer = new ProgramTimelineDrawer(this.canvas);
        this.timelineBarDrawer = new TimelineBarDrawer(this.canvas);
        this.sidebarDrawer = new SidebarDrawer(this.canvas);

        this.setGlobalStartEnd();
        
        this.threadPatternToColor = new Map<number, string>();
        this.colorToThreadPattern = new Map<string, number>();
        this.setupThreadColors(programRibbonData);
    }

    static refineTimeframePanels = function (timeframePanelsRaw: TimeframePanelRaw[]): TimeframePanel[] {
        let pixelOffset = 0;
        let timeframePanels = new Array<TimeframePanel>();
    
        for (let rawPanel of timeframePanelsRaw) {
            let refinedPanel: any = {}
            refinedPanel.start = rawPanel.start;
            refinedPanel.end = rawPanel.end;
            refinedPanel.resolution = rawPanel.resolution;
            refinedPanel.pixelStart = pixelOffset;
            refinedPanel.pixelEnd = pixelOffset + Math.floor((refinedPanel.end - refinedPanel.start) / refinedPanel.resolution);
            timeframePanels.push(refinedPanel);
    
        }
    
        return timeframePanels;
    }

    static getTotalPixelLength(timeframePanels: TimeframePanel[]): number {
        let totalPixelLength = 0;
        if (timeframePanels.length > 0) {
            totalPixelLength = timeframePanels[timeframePanels.length - 1].pixelEnd + 1;
        }
        
        return totalPixelLength;
    }

    setGlobalStartEnd(): void {
        let timeStart = Number.MAX_SAFE_INTEGER; 
        let timeEnd = 0;

        for (let refinedPanel of this.timeframePanels) {
            if (timeEnd < refinedPanel.end) {
                timeEnd = refinedPanel.end;
            }

            if (timeStart > refinedPanel.start) {
                timeStart = refinedPanel.start;
            }
        }

        this.timelineStartTime = timeStart;
        this.timelineEndTime = timeEnd;
    }

    
    setupThreadColors(programRibbonData: number[]) {
        let index = 0;
        for (let i = 0; i < programRibbonData.length; i++) {
            let ribbons = programRibbonData[i];
            for (let j = 0; j < ribbons; j++) {
                let color = Config.ALL_COLORS[index]; 
                // assume 100 is a valid namespace base for the threads
                let hash = i * 100 + j; 
                this.threadPatternToColor.set(hash, color); 
                this.colorToThreadPattern.set(color, hash);
                index++;
            }
        }
    }

    // Done construction

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

    getColor(threadNum, ribbonNum) {
        return this.threadPatternToColor.get(threadNum * 100 + ribbonNum);
    }
    
    // getThreadPattern(color) {
    //     let hash = this.colorToThreadPattern.get(color);
    //     let threadPattern: any = {};
    //     threadPattern.threadNum = hash / 100;
    //     threadPattern.ribbonNum = hash % 100;
    //     return threadPattern;
    // }

    drawInterval(threadNum: number, ribbonNum: number, timeStart: number, timeEnd: number, color: string) {
        let startXObj = this.getPixelOffset(timeStart);
        let pixelStart, startPanel;
        if (startXObj != null) {
            pixelStart = startXObj.pixelOffset;
            startPanel = startXObj.panel;
        }
    
        let endXObj = this.getPixelOffset(timeEnd);
        let pixelEnd, endPanel;
        if (endXObj != null) {
            endPanel = endXObj.panel;
            pixelEnd = endXObj.pixelOffset;
        }
    
        if (pixelStart == undefined && pixelEnd == undefined) return;
        if (pixelStart == undefined) pixelStart = this.timeframePanels[endPanel].pixelStart;
        if (pixelEnd == undefined) pixelEnd = this.timeframePanels[startPanel].pixelEnd;
    
        this.programTimelineDrawer.drawInterval(threadNum, ribbonNum, pixelStart, pixelEnd, color);
    }

    drawTimelineBar() {
        for (let timeframePanel of this.timeframePanels) {
            let numNotches = Math.ceil((timeframePanel.pixelEnd - timeframePanel.pixelStart) / Config.TARGET_NOTCH_LENGTH); 
            let notchLength = (timeframePanel.end - timeframePanel.start) / numNotches;
    
            for (let i = 0; i <= numNotches; i++) {
                let nextNotchTimeOffset = notchLength * i + timeframePanel.start;
                let pixelOffset = this.getPixelOffset(nextNotchTimeOffset).pixelOffset; // inefficient
                this.timelineBarDrawer.drawTimelineBar(nextNotchTimeOffset, pixelOffset);
            }
        }
    }
    
    drawNameSidebar(names: string[]) {
        this.sidebarDrawer.drawNameSidebar(names);
    }
 
    // setupMouseEvents(rootDiv) {
    //     function byte2Hex (n) {
    //         var str = n.toString(16);
    //         return "00".substr(str.length) + str;
    //     }
    
    //     function rgbToColorHexstring(r,g,b) {
    //         return '#' + byte2Hex(r) + byte2Hex(g) + byte2Hex(b);
    //     };
    
    //     $(rootDiv).on("mousemove", function (e) {
    //         let x = e.pageX;
    //         let y = e.pageY; 
    
    //         let element = document.elementFromPoint(x, y) as HTMLCanvasElement;
    //         if (element.tagName == "CANVAS") {
    //             let xCanvas = x - element.offsetLeft;
    //             let yCanvas = y - element.offsetTop;
    //             let context = element.getContext("2d");
    //             let color = context.getImageData(xCanvas, yCanvas, 1, 1).data;
    //             let threadHexColor = rgbToColorHexstring(color[0], color[1], color[2]);
    //         }
    //     });
    // }
}
