import Config from '../Config';
import Canvas from '../Canvas';

export default class ProgramTimelineDrawer {
    canvas: Canvas;

    constructor(canvas: Canvas) {
        this.canvas = canvas;
    }

    drawInterval(threadNum: number, ribbonNum: number, pixelStart: number, pixelEnd: number, color: string) {
        if (!(0 <= threadNum && threadNum < this.canvas.programRibbonData.length)
         || !(0 <= ribbonNum && ribbonNum < this.canvas.programRibbonData[threadNum])
         || pixelEnd < pixelStart) {
            throw new RangeError("The threadNum and Ribbon num is out of range for the given programRibbonData");
        };

        let startY = this.canvas.programTimelineOriginY 
                   + this.canvas.threadOffsets[threadNum]
                   + ribbonNum * Config.RIBBON_HEIGHT;
                    
        let canvasStartXObj = this.getCanvasIndexAndOffset(pixelStart);
        let startPanel = canvasStartXObj.canvasIndex;
        let startOffset = canvasStartXObj.canvasOffset;
    
        let canvasEndXObj = this.getCanvasIndexAndOffset(pixelEnd); 
        let endPanel = canvasEndXObj.canvasIndex;
        let endOffset = canvasEndXObj.canvasOffset;
    
        if (startPanel == endPanel) {
            this.drawIntervalOnCanvas(startPanel, startOffset, endOffset, startY, color);
        } else {
            this.drawIntervalOnCanvas(startPanel, startOffset, this.canvas.programTimelineWidth, startY, color); 
            for (let i = startPanel + 1; i < endPanel; i++) {
                this.drawIntervalOnCanvas(i, 0, this.canvas.programTimelineWidth, startY, color);
            }
            this.drawIntervalOnCanvas(endPanel, 0, endOffset, startY, color);                
        }
    }

    getCanvasIndexAndOffset(pixelOffset: number): {canvasIndex: number, canvasOffset: number } {
        if (pixelOffset < 0 || pixelOffset >= this.canvas.totalPixelLength) {
            throw new RangeError("pixelOffset is out of range");
        }
    
        let canvasIndex = Math.floor(pixelOffset / this.canvas.programTimelineWidth);
        let canvasOffset = pixelOffset % this.canvas.programTimelineWidth;
    
        return {canvasIndex, canvasOffset};
    }
    
    drawIntervalOnCanvas(panel, startOffset, endOffset, y, color) {
        let htmlCanvas = this.canvas.panels[panel];
        let context = htmlCanvas.getContext("2d");
        context.beginPath();
        context.rect(startOffset + this.canvas.programTimelineOriginX, y, endOffset - startOffset + 1, Config.RIBBON_HEIGHT);
        context.fillStyle = color;
        context.fill();
        context.closePath();    
    }
}
