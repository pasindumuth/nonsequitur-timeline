import Config from '../Config';
import Canvas from '../Canvas';

export default class SidebarDrawer {
    canvas: Canvas;

    constructor(canvas: Canvas) {
        this.canvas = canvas;
    }

    drawSidebar(threadIDs: string[]) {
        if (threadIDs.length != this.canvas.threadOffsets.length) return;
    
        let sidebarX = this.canvas.programTimelineOriginX - Config.NAME_SIDE_BAR_LEFT_OFFSET;
        let sidebarY = this.canvas.programTimelineOriginY;
    
        for (let i = 0; i < this.canvas.threadOffsets.length; i++) {
            let centerOffset = sidebarX + Config.NAME_SIDE_BAR_LEFT_OFFSET / 2;
            let centerHeight = sidebarY 
                             + this.canvas.threadOffsets[i]
                             + this.canvas.programRibbonData[i] * Config.RIBBON_HEIGHT / 2 
                             + Config.NAME_FONT_SIZE / 2;
    
            for (let canvas of this.canvas.panels) {
                let context = canvas.getContext("2d");
                context.font = Config.NAME_FONT_SIZE + "px" + " " + Config.NAME_FONT; 
                context.fillStyle = Config.NAME_FONT_COLOR; 
                context.textAlign = "center"; 
                context.fillText(threadIDs[i], centerOffset, centerHeight);
            }
        }
    }
}
