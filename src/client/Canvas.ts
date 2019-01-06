import $ from 'jquery';
import Config from './Config';

export default class Canvas {
    /**
     * Terminology: 
     * 
     * ribbon - the ribbon that displays a single pattern for a single thread
     * thread timeline - the set of all ribbons for a given thread
     * program timeline - the set of all thread timelines, including the separating space between threads
     * timeline bar - the bar underneath the program timeline with notches indicating time
     * canvas - the set of all html canvas elements where the program timelines are drawn,
     *          as well as the timeline bar, and the sidebar
     * panel - a single html canvas element in the whole canvas
     */

    panels: HTMLCanvasElement[];
    totalPixelLength: number;
    threadRibbonLength: number[];
    threadOffsets: number[];

    panelWidth: number;
    panelHeight: number;
    programTimelineWidth: number;
    programTimelineHeight: number;

    programTimelineOriginX: number;
    programTimelineOriginY: number;

    constructor(threadRibbonLength: number[], totalPixelLength: number, width: number) {
        this.totalPixelLength = totalPixelLength;
        this.threadRibbonLength = threadRibbonLength;

        this.panelWidth = width;
        this.programTimelineHeight = Canvas.getTimelineHeight(threadRibbonLength);
        this.programTimelineWidth = this.panelWidth - Config.PROGRAM_TIMELINE_LEFT_PADDING - Config.PROGRAM_TIMELINE_RIGHT_PADDING;
        this.panelHeight = this.programTimelineHeight 
                          + Config.PROGRAM_TIMELINE_TOP_PADDING 
                          + Config.PROGRAM_TIMELINE_BOTTOM_PADDING
                          + Config.TIMELINE_MEASURE_BAR_HEIGHT
                          + Config.TIMELINE_MEASURE_BAR_TOP_PADDING
                          + Config.TIMELINE_MEASURE_BAR_BOTTOM_PADDING;

        let numCanvas = Math.ceil(this.totalPixelLength / this.programTimelineWidth);
        this.panels = Canvas.getPanels(numCanvas, this.panelWidth, this.panelHeight);
        this.threadOffsets = Canvas.getThreadOffsets(this.threadRibbonLength);

        this.programTimelineOriginX = Config.PROGRAM_TIMELINE_LEFT_PADDING;
        this.programTimelineOriginY = Config.PROGRAM_TIMELINE_TOP_PADDING;
    }

    static getTimelineHeight(threadRibbonLength: number[]): number {
        let programTimelineHeight = 0; 
        for (let ribbons of threadRibbonLength) {
            programTimelineHeight += ribbons * Config.RIBBON_HEIGHT;
        }

        if (threadRibbonLength.length > 0) {
            programTimelineHeight += (threadRibbonLength.length - 1) * Config.THREAD_TIMELINE_GAP;
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

    static getThreadOffsets(threadRibbonLength: number[]): number[] {
        let sum = 0; 
        let threadOffsets = new Array<number>();
        for (let i = 0; i < threadRibbonLength.length; i++) {
            threadOffsets.push(sum);
            sum += threadRibbonLength[i] * Config.RIBBON_HEIGHT + Config.THREAD_TIMELINE_GAP;
        }
    
        return threadOffsets;
    }

    getCanvasIndexAndOffset(pixelOffset: number) {
        if (pixelOffset < 0 || pixelOffset >= this.totalPixelLength) return null;
    
        let canvasIndex = Math.floor(pixelOffset / this.programTimelineWidth);
        let canvasOffset = pixelOffset % this.programTimelineWidth;
    
        return {canvasIndex, canvasOffset};
    }

    setupClickHandler(clickHandler: (thread: number, pattern: number, pixelOffset: number) => void): void {
        for (let panelIndex = 0; panelIndex < this.panels.length; panelIndex++) {
            let panel = this.panels[panelIndex];
            $(panel).on("click", (e) => {
                if (!(this.programTimelineOriginX <= e.offsetX && e.offsetX < this.programTimelineOriginX + this.programTimelineWidth
                   && this.programTimelineOriginY <= e.offsetY && e.offsetY < this.programTimelineOriginY + this.programTimelineHeight)) {
                    return;                    
                }

                let x = e.offsetX - this.programTimelineOriginX;
                let y = e.offsetY - this.programTimelineOriginY;

                let thread;
                for (thread = 0; thread < this.threadOffsets.length; thread++) {
                    if (this.threadOffsets[thread] > y) break;
                }

                thread--;
                let pattern = Math.floor((y - this.threadOffsets[thread]) / Config.RIBBON_HEIGHT);
                if (pattern >= this.threadRibbonLength[thread]) return;
                
                let pixelOffset = panelIndex * this.programTimelineWidth + x;
                
                clickHandler(thread, pattern, pixelOffset);
            });
        }
    }
}
