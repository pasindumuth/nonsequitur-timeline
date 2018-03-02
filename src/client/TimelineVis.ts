import $ from 'jquery';
import Config from './Config';
import { Program, TimeframePanelRaw, TimeframePanel } from '../shapes';
import Canvas from './Canvas';
import ProgramTimelineDrawer from './drawers/ProgramTimelineDrawer';
import TimelineBarDrawer from './drawers/TimelineBarDrawer';
import SidebarDrawer from './drawers/SidebarDrawer';
import ColorPicker from './ColorPicker';
import TimePixelConverter from './TimePixelConverter';

export default class TimelineVis {
    canvas: Canvas;
    timePixelConverter: TimePixelConverter;
    programTimelineDrawer: ProgramTimelineDrawer;
    timelineBarDrawer: TimelineBarDrawer;
    sidebarDrawer: SidebarDrawer;
    colorPicker: ColorPicker;

    constructor(timeframePanelsRaw: TimeframePanelRaw[], programRibbonData: number[], width: number) {
        this.timePixelConverter = new TimePixelConverter(timeframePanelsRaw);
        this.canvas = new Canvas(programRibbonData, this.timePixelConverter.getTotalPixelLength(), width - Config.CANVAS_MARGIN);
        this.programTimelineDrawer = new ProgramTimelineDrawer(this.canvas);
        this.timelineBarDrawer = new TimelineBarDrawer(this.canvas);
        this.sidebarDrawer = new SidebarDrawer(this.canvas);
        this.colorPicker = new ColorPicker(programRibbonData);
    }

    // Done construction

    drawProgramData(program: Program) {
        let intervalsDrawn = 0;
        for (let i = 0; i < program.threads.length; i++) {
            let thread = program.threads[i];
            for (let j = 0; j < thread.patterns.length; j++) {
                let pattern = thread.patterns[j];
                for (let interval of pattern.patternIntervals) {
                    this.drawInterval(i, j, interval[0], interval[1], this.colorPicker.getColor(i, j));
                    intervalsDrawn++;
                }
            }
        }
    }

    drawInterval(threadNum: number, ribbonNum: number, timeStart: number, timeEnd: number, color: string) {
        let startXObj = this.timePixelConverter.getPixelOffset(timeStart);
        let pixelStart, startPanel;
        if (startXObj != null) {
            pixelStart = startXObj.pixelOffset;
            startPanel = startXObj.panel;
        }
    
        let endXObj = this.timePixelConverter.getPixelOffset(timeEnd);
        let pixelEnd, endPanel;
        if (endXObj != null) {
            endPanel = endXObj.panel;
            pixelEnd = endXObj.pixelOffset;
        }
    
        if (pixelStart == undefined && pixelEnd == undefined) return;
        if (pixelStart == undefined) pixelStart = this.timePixelConverter.timeframePanels[endPanel].pixelStart;
        if (pixelEnd == undefined) pixelEnd = this.timePixelConverter.timeframePanels[startPanel].pixelEnd;
    
        this.programTimelineDrawer.drawInterval(threadNum, ribbonNum, pixelStart, pixelEnd, color);
    }

    drawTimelineBar() {
        for (let timeframePanel of this.timePixelConverter.timeframePanels) {
            let numNotches = Math.ceil((timeframePanel.pixelEnd - timeframePanel.pixelStart) / Config.TARGET_NOTCH_LENGTH); 
            let notchLength = (timeframePanel.end - timeframePanel.start) / numNotches;
    
            for (let i = 0; i <= numNotches; i++) {
                let nextNotchTimeOffset = notchLength * i + timeframePanel.start;
                let pixelOffset = this.timePixelConverter.getPixelOffset(nextNotchTimeOffset).pixelOffset; // inefficient
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
