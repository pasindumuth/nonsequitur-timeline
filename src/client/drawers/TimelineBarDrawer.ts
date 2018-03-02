import Config from '../Config';
import Canvas from '../Canvas';

export default class TimelineBarDrawer {
    canvas: Canvas;
    timelineBarOriginX: number;
    timelineBarOriginY: number;

    constructor(canvas: Canvas) {
        this.canvas = canvas;
        this.timelineBarOriginX = this.canvas.programTimelineOriginX;
        this.timelineBarOriginY = this.canvas.programTimelineOriginY
                                + this.canvas.programTimelineHeight
                                + Config.PROGRAM_TIMELINE_BOTTOM_PADDING 
                                + Config.TIMELINE_MEASURE_BAR_TOP_PADDING;
                                
        for (let i = 0; i < this.canvas.panels.length; i++) {
            let panel = this.canvas.panels[i];
            let context = panel.getContext("2d");
            context.beginPath();
            context.rect(this.timelineBarOriginX, 
                         this.timelineBarOriginY, 
                         (i == this.canvas.panels.length - 1) ? this.canvas.totalPixelLength % this.canvas.programTimelineWidth 
                                                              : this.canvas.programTimelineWidth, 
                         Config.TIMELINE_MEASURE_BAR_LINE_HEIGHT);

            context.rect(this.timelineBarOriginX - Config.TIMELINE_MEASURE_BAR_LEFT_OVERFLOW, 
                         this.timelineBarOriginY, 
                         Config.TIMELINE_MEASURE_BAR_LEFT_OVERFLOW, 
                         Config.TIMELINE_MEASURE_BAR_LINE_HEIGHT);
                         
            context.fillStyle = Config.TIMELINE_MEASURE_BAR_COLOR;
            context.fill();
            context.closePath();
        }
    }

    drawTimelineBar(nextNotchTimeOffset: number, pixelOffset: number) {
        let indexOffset = this.canvas.getCanvasIndexAndOffset(pixelOffset);
        let canvasIndex = indexOffset.canvasIndex;
        let canvasOffset = indexOffset.canvasOffset;

        let panel = this.canvas.panels[canvasIndex];
        let context = panel.getContext("2d");
        context.beginPath();
        context.rect(this.timelineBarOriginX + canvasOffset, this.timelineBarOriginY, Config.TIMELINE_MEASURE_BAR_NOTCH_WIDTH, Config.TIMELINE_MEASURE_BAR_NOTCH_HEIGHT);
        context.fillStyle = Config.NOTCH_COLOR;
        context.fill();
        context.closePath();

        context.font = Config.TIMELINE_MEASURE_BAR_STRING_FONT_SIZE.toString() + "px" + " " + Config.TIMELINE_MEASURE_BAR_STRING_FONT;
        context.fillStyle = Config.TIMELINE_MEASURE_BAR_STRING_FONT_COLOR;
        context.textAlign = "center";
        context.fillText(Math.floor(nextNotchTimeOffset).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "ns", this.timelineBarOriginX + canvasOffset, this.timelineBarOriginY + 30);
    }
}
