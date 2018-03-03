import $ from 'jquery';
import Config from './Config';

export default class Canvas {
    panels: HTMLCanvasElement[];
    totalPixelLength: number;
    programRibbonData: number[];
    threadOffsets: number[];

    panelWidth: number;
    panelHeight: number;
    programTimelineWidth: number;
    programTimelineHeight: number;

    programTimelineOriginX: number;
    programTimelineOriginY: number;

    constructor(programRibbonData: number[], totalPixelLength: number, width: number) {
        this.totalPixelLength = totalPixelLength;
        this.programRibbonData = programRibbonData;

        this.panelWidth = width;
        this.programTimelineHeight = Canvas.getTimelineHeight(programRibbonData);
        this.programTimelineWidth = this.panelWidth - Config.PROGRAM_TIMELINE_LEFT_PADDING - Config.PROGRAM_TIMELINE_RIGHT_PADDING;
        this.panelHeight = this.programTimelineHeight 
                          + Config.PROGRAM_TIMELINE_TOP_PADDING 
                          + Config.PROGRAM_TIMELINE_BOTTOM_PADDING
                          + Config.TIMELINE_MEASURE_BAR_HEIGHT
                          + Config.TIMELINE_MEASURE_BAR_TOP_PADDING
                          + Config.TIMELINE_MEASURE_BAR_BOTTOM_PADDING;


        let numCanvas = Math.ceil(this.totalPixelLength / this.programTimelineWidth);
        this.panels = Canvas.getPanels(numCanvas, this.panelWidth, this.panelHeight);
        this.threadOffsets = Canvas.getThreadOffsets(this.programRibbonData);

        this.programTimelineOriginX = Config.PROGRAM_TIMELINE_LEFT_PADDING;
        this.programTimelineOriginY = Config.PROGRAM_TIMELINE_TOP_PADDING;
    }

    static getTimelineHeight(programRibbonData: number[]): number {
        let programTimelineHeight = 0; 
        for (let ribbons of programRibbonData) {
            programTimelineHeight += ribbons * Config.RIBBON_HEIGHT;
        }

        if (programRibbonData.length > 0) {
            programTimelineHeight += (programRibbonData.length - 1) * Config.THREAD_TIMELINE_GAP;
        }

        return programTimelineHeight;
    }

    static getPanels(numCanvas: number, panelWidth: number, panelHeight: number): HTMLCanvasElement[] {
        let canvasList = new Array<HTMLCanvasElement>();

        for (let i = 0; i < numCanvas; i++) {
            let canvas = document.createElement("canvas");
            $(canvas).addClass("canvas");
            canvas.setAttribute("width", panelWidth.toString());
            canvas.setAttribute("height", panelHeight.toString());
            canvasList.push(canvas);
        }

        return canvasList;
    }

    static getThreadOffsets(programRibbonData: number[]): number[] {
        let sum = 0; 
        let threadOffsets = new Array<number>();
        for (let i = 0; i < programRibbonData.length; i++) {
            threadOffsets.push(sum);
            sum += programRibbonData[i] * Config.RIBBON_HEIGHT + Config.THREAD_TIMELINE_GAP;
        }
    
        return threadOffsets;
    }

    getCanvasIndexAndOffset(pixelOffset: number) {
        if (pixelOffset < 0 || pixelOffset >= this.totalPixelLength) return null;
    
        let canvasIndex = Math.floor(pixelOffset / this.programTimelineWidth);
        let canvasOffset = pixelOffset % this.programTimelineWidth;
    
        return {canvasIndex, canvasOffset};
    }
}
