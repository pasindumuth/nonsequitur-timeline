import $ from 'jquery';

// UI constants
// we refer to a single ribbon as a "timeline", as well as the set of all ribbons
let RIBBON_HEIGHT: number = 6;
let THREAD_GAP: number = 20;
let TIMELINE_TOP_PADDING: number = 15;
let TIMELINE_BOTTOM_PADDING: number = 10;
let TIMELINE_LEFT_PADDING: number = 100;
let TIMELINE_RIGHT_PADDING: number = 100;

let CANVAS_MARGIN: number = 50;

let TIMELINE_BAR_HEIGHT: number = 25;
let TIMELINE_BAR_LEFT_OVERFLOW: number = 40;
let TIMELINE_BAR_TOP_PADDING: number = 10;
let TIMELINE_BAR_BOTTOM_PADDING: number = 10;
let TIMELINE_BAR_LINE_HEIGHT: number = 15;
let TIMELINE_BAR_TIME_GAP: number = TIMELINE_BAR_HEIGHT - TIMELINE_BAR_LINE_HEIGHT;
let TIMELINE_COLOR: string = "#eaeaea";
    
let TARGET_NOTCH_LENGTH: number = 500;
let TIMELINE_BAR_NOTCH_WIDTH: number = 1;
let TIMELINE_BAR_NOTCH_HEIGHT: number = TIMELINE_BAR_LINE_HEIGHT;
let NOTCH_COLOR: string = "#888888";
let TIME_STRING_FONT: string = "Arial";
let TIME_STRING_FONT_SIZE: number = 10;
let TIME_STRING_FONT_COLOR: string = "#000000";

let NAME_SIDE_BAR_LEFT_OFFSET: number = TIMELINE_BAR_LEFT_OVERFLOW;
let NAME_FONT: string = "Arial";
let NAME_FONT_SIZE: number = 15;
let NAME_FONT_COLOR: string = "#000000";


// Extended color set. use the commented out colors if they are more suitable.
let ALL_COLORS = ["#969664","#fa0064","#9632c8","#3264fa","#966464","#32c864","#fa6496",
"#6432c8","#c864c8","#96c896","#c800c8","#fa3232","#64fa64","#6432fa","#00fafa","#00c8fa",
"#0032fa","#00fac8","#32c896","#3200fa","#fa9696","#643296","#64fac8","#96fa64","#fa6432",
"#64c800","#6400fa","#96fa00","#9600c8","#6496c8","#0064fa","#32c8fa","#6464c8","#32fafa",
"#00fa64","#fafa96","#fa64fa","#c8fa96","#c8c8fa","#00fa32","#c832fa","#c83264","#c8c832",
"#fafac8","#64c864","#00fa96","#fac832","#32c832","#fa3296","#00c8c8","#c80064","#fafa32",
"#96c8c8","#3296c8","#32fa96","#fa0096","#009696","#9632fa","#64fa96","#c8c864","#c86400",
"#c896fa","#fa32fa","#c8fa64","#329664","#963296","#c89696","#96fafa","#32fa32","#96c8fa",
"#c89664","#963264","#fa9600","#6400c8","#96fa32","#c86432","#64fafa","#9600fa","#fa3200",
"#fa9632","#32fac8","#96c800","#c8fa32","#c83296","#c8fafa","#c896c8","#fa6464","#96fac8",
"#646464","#c800fa","#fac8fa","#32fa64","#fa96fa","#fafa00","#6496fa","#969600","#c83232",
"#fa64c8","#64c8c8","#fa9664","#96fa96","#0064c8","#64fa00","#64c8fa","#c864fa","#fa32c8",
"#969696","#3232c8","#fafa64","#329696","#96c832","#00c896","#64c832","#c8fa00","#966432",
"#960096","#c86464","#fac800","#966496","#969632","#6464fa","#c8fac8","#32c8c8","#fa00c8",
"#3232fa","#9664c8","#c8c800","#3264c8","#fa96c8","#9696fa","#fa3264","#fac864","#fa00fa",
"#646496","#64fa32","#0096c8","#649664","#326496","#649632"];

// let ALL_COLORS = ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", 
//                   "#dd4477", "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99",
//                   "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262",
//                   "#5574a6", "#3b3eac"];

export default class Canvas {
    timelineData: number[];
    
    canvasWidth: number;
    canvasHeight: number;
    timelineWidth: number;
    timelineHeight: number;

    timeframePanels: TimeframePanel[];

    timelineTimeStart: number;
    timelineTimeEnd: number;

    totalPixelLength: number;
    canvasList: HTMLCanvasElement[];

    timelineStartX: number;
    timelineStartY: number;
    threadOffsets: number[];

    threadPatternToColor: Map<number, string>;
    colorToThreadPattern: Map<string, number>;

    constructor(timeframePanelsRaw: TimeframePanelRaw[], timelineData: number[], width: number) {
        this.timelineData = timelineData;

        this.canvasWidth = width - CANVAS_MARGIN;
        this.timelineWidth = this.canvasWidth - TIMELINE_LEFT_PADDING - TIMELINE_RIGHT_PADDING;
        this.timelineHeight = Canvas.getTimelineHeight(this.timelineData);
        this.canvasHeight = this.timelineHeight 
                          + TIMELINE_TOP_PADDING 
                          + TIMELINE_BOTTOM_PADDING
                          + TIMELINE_BAR_HEIGHT
                          + TIMELINE_BAR_TOP_PADDING
                          + TIMELINE_BAR_BOTTOM_PADDING;

        this.timeframePanels = Canvas.refineTimeframePanels(timeframePanelsRaw);
        this.setGlobalStartEnd();

        this.totalPixelLength = Canvas.getTotalPixelLength(this.timeframePanels);
        this.canvasList = Canvas.getCanvasList(this.totalPixelLength, this.timelineWidth, this.canvasWidth, this.canvasHeight);
        
        this.timelineStartX = TIMELINE_LEFT_PADDING;
        this.timelineStartY = TIMELINE_TOP_PADDING;
        this.threadOffsets = Canvas.getThreadOffsets(this.timelineData);
    
        this.threadPatternToColor = new Map<number, string>();
        this.colorToThreadPattern = new Map<string, number>();
        this.setupThreadColors();
    }
    
    static getTimelineHeight(timelineData: number[]): number {
        let timelineHeight = 0; 
        for (let ribbons of timelineData) {
            timelineHeight += ribbons * RIBBON_HEIGHT;
        }

        if (timelineData.length > 0) {
            timelineHeight += (timelineData.length - 1) * THREAD_GAP;
        }

        return timelineHeight;
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

        this.timelineTimeStart = timeStart;
        this.timelineTimeEnd = timeEnd;
    }

    static getTotalPixelLength(timeframePanels: TimeframePanel[]): number {
        let totalPixelLength = 0;
        if (timeframePanels.length > 0) {
            totalPixelLength = timeframePanels[timeframePanels.length - 1].pixelEnd + 1;
        }
        
        return totalPixelLength;
    }

    static getCanvasList(totalPixelLength: number, timelineWidth: number, canvasWidth: number, canvasHeight: number): HTMLCanvasElement[] {
        let numCanvas = Math.ceil(totalPixelLength / timelineWidth);
        let canvasList = new Array<HTMLCanvasElement>();

        for (let i = 0; i < numCanvas; i++) {
            let canvas = document.createElement("canvas");
            $(canvas).addClass("canvas");
            canvas.setAttribute("width", canvasWidth.toString());
            canvas.setAttribute("height", canvasHeight.toString());
            canvasList.push(canvas);
        }

        return canvasList;
    }

    static getThreadOffsets(timelineData: number[]): number[] {
        let sum = 0; 
        let threadOffsets = new Array<number>();
        for (let i = 0; i < timelineData.length; i++) {
            threadOffsets.push(sum);
            sum += timelineData[i];
        }
    
        return threadOffsets;
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
    
    getCanvasIndexAndOffset(pixelOffset): {canvasIndex: number, canvasOffset: number } {
        if (pixelOffset < 0 || pixelOffset >= this.totalPixelLength) return null;
    
        let canvasIndex = Math.floor(pixelOffset / this.timelineWidth);
        let canvasOffset = pixelOffset % this.timelineWidth;
    
        return {canvasIndex, canvasOffset};
        
    }
    
    drawIntervalOnCanvas(startXIndex, startXOffset, endXOffset, startY, color) {
        let canvas = this.canvasList[startXIndex];
        let context = canvas.getContext("2d");
        context.beginPath();
        context.rect(startXOffset + this.timelineStartX, startY, endXOffset - startXOffset + 1, RIBBON_HEIGHT);
        context.fillStyle = color;
        context.fill();
        context.closePath();    
    }
    
    /**
     * Draws the time interval if it exists in the Canvas' range.
     */
    drawInterval(threadNum, ribbonNum, timeStart, timeEnd, color) {
        if (!(0 <= threadNum && threadNum < this.timelineData.length)) return;
        if (!(0 <= ribbonNum && ribbonNum < this.timelineData[threadNum])) return;
        if (timeEnd < timeStart) return;
    
        let startY = this.timelineStartY 
                   + this.threadOffsets[threadNum] * RIBBON_HEIGHT
                   + THREAD_GAP * threadNum
                   + ribbonNum * RIBBON_HEIGHT;
    
        let startXObj = this.getPixelOffset(timeStart);
        let startX, startPanel;
        if (startXObj != null) {
            startX = startXObj.pixelOffset;
            startPanel = startXObj.panel;
        }
    
        let endXObj = this.getPixelOffset(timeEnd);
        let endX, endPanel;
        if (endXObj != null) {
            endPanel = endXObj.panel;
            endX = endXObj.pixelOffset;
        }
    
        if (startX == undefined && endX == undefined) return;
        if (startX == undefined) startX = this.timeframePanels[endPanel].pixelStart;
        if (endX == undefined) endX = this.timeframePanels[startPanel].pixelEnd;
    
        let canvasStartXObj = this.getCanvasIndexAndOffset(startX);
        let startXIndex = canvasStartXObj.canvasIndex;
        let startXOffset = canvasStartXObj.canvasOffset;
    
        let canvasEndXObj = this.getCanvasIndexAndOffset(endX); 
        let endXIndex = canvasEndXObj.canvasIndex;
        let endXOffset = canvasEndXObj.canvasOffset;
    
        if (startXIndex == endXIndex) {
            this.drawIntervalOnCanvas(startXIndex, startXOffset, endXOffset, startY, color);
        } else {
            this.drawIntervalOnCanvas(startXIndex, startXOffset, this.timelineWidth, startY, color); 
            for (let i = startXIndex + 1; i < endXIndex; i++) {
                this.drawIntervalOnCanvas(i, 0, this.timelineWidth, startY, color);
            }
            this.drawIntervalOnCanvas(endXIndex, 0, endXOffset, startY, color);                
        }
    }
    
    setupThreadColors() {
        for (let i = 0; i < this.timelineData.length; i++) {
            let ribbons = this.timelineData[i];
            for (let j = 0; j < ribbons; j++) {
                let color = ALL_COLORS[this.threadOffsets[i] + j]; 
                // assume 100 is a valid namespace base for the threads
                let hash = i * 100 + j; 
                this.threadPatternToColor.set(hash, color); 
                this.colorToThreadPattern.set(color, hash);
            }
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

    drawTimelineBar() {
        let barOriginX = this.timelineStartX;
        let barOriginY = this.timelineStartY
                       + this.timelineHeight
                       + TIMELINE_BOTTOM_PADDING 
                       + TIMELINE_BAR_TOP_PADDING;
    
        for (let canvas of this.canvasList) {
            let context = canvas.getContext("2d");
            context.beginPath();
            context.rect(barOriginX, barOriginY, this.timelineWidth, TIMELINE_BAR_LINE_HEIGHT);
            context.rect(barOriginX - TIMELINE_BAR_LEFT_OVERFLOW, barOriginY, TIMELINE_BAR_LEFT_OVERFLOW, TIMELINE_BAR_LINE_HEIGHT);
            context.fillStyle = TIMELINE_COLOR;
            context.fill();
            context.closePath();
        }
    
        // draw the notches on the timeline
        for (let timeframePanel of this.timeframePanels) {
            let pixelStart = timeframePanel.pixelStart;
            let pixelEnd = timeframePanel.pixelEnd;
            let start = timeframePanel.start;
            let end = timeframePanel.end;
    
            let numNotches = Math.ceil((pixelEnd - pixelStart) / TARGET_NOTCH_LENGTH); 
            let notchLength = (end - start) / numNotches;
    
            for (let i = 0; i <= numNotches; i++) {
                let nextNotchTimeOffset = notchLength * i + start;
                let pixelOffset = this.getPixelOffset(nextNotchTimeOffset).pixelOffset; // inefficient
                let indexOffset = this.getCanvasIndexAndOffset(pixelOffset);
                let canvasIndex = indexOffset.canvasIndex;
                let canvasOffset = indexOffset.canvasOffset;
    
                let canvas = this.canvasList[canvasIndex];
                let context = canvas.getContext("2d");
                context.beginPath();
                context.rect(barOriginX + canvasOffset, barOriginY, TIMELINE_BAR_NOTCH_WIDTH, TIMELINE_BAR_NOTCH_HEIGHT);
                context.fillStyle = NOTCH_COLOR;
                context.fill();
                context.closePath();
    
                context.font = TIME_STRING_FONT_SIZE.toString() + "px" + " " + TIME_STRING_FONT;
                context.fillStyle = TIME_STRING_FONT_COLOR;
                context.textAlign = "center";
                context.fillText(Math.floor(nextNotchTimeOffset).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "ns", barOriginX + canvasOffset, barOriginY + 30);
            }
        }
    }

    drawNameSidebar(names: string[]) {
        if (names.length != this.threadOffsets.length) return;
    
        let sidebarX = this.timelineStartX - NAME_SIDE_BAR_LEFT_OFFSET;
        let sidebarY = this.timelineStartY;
    
        for (let i = 0; i < this.threadOffsets.length; i++) {
            let centerOffset = sidebarX + NAME_SIDE_BAR_LEFT_OFFSET / 2;
            let centerHeight = sidebarY 
                             + this.threadOffsets[i] * RIBBON_HEIGHT 
                             + i * THREAD_GAP 
                             + this.timelineData[i] * RIBBON_HEIGHT / 2 
                             + NAME_FONT_SIZE / 2;
    
            for (let canvas of this.canvasList) {
                let context = canvas.getContext("2d");
                context.font = NAME_FONT_SIZE + "px" + " " + NAME_FONT; 
                context.fillStyle = NAME_FONT_COLOR; 
                context.textAlign = "center"; 
                context.fillText(names[i], centerOffset, centerHeight);
            }
        }
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
