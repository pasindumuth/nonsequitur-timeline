import $ from 'jquery';
import Config from './Config';
import { Program, TimeframePanelRaw, TimeframePanel } from '../shared/shapes';
import Canvas from './Canvas';
import ProgramTimelineDrawer from './drawers/ProgramTimelineDrawer';
import TimelineBarDrawer from './drawers/TimelineBarDrawer';
import SidebarDrawer from './drawers/SidebarDrawer';
import ColorPicker from './ColorPicker';

export default class TimelineVis {
    timeframePanels: TimeframePanel[];

    canvas: Canvas;
    programTimelineDrawer: ProgramTimelineDrawer;
    timelineBarDrawer: TimelineBarDrawer;
    sidebarDrawer: SidebarDrawer;
    colorPicker: ColorPicker;

    program: Program;

    constructor(timeframePanelsRaw: TimeframePanelRaw[], programRibbonToPatternID: number[][], width: number, program: Program) {
        this.timeframePanels = TimelineVis.refineTimeframePanels(timeframePanelsRaw);

        let threadRibbonLength = new Array<number>();
        for (let threadRibbonToPatternID of programRibbonToPatternID)
            threadRibbonLength.push(threadRibbonToPatternID.length);

        this.canvas = new Canvas(threadRibbonLength, this.getTotalPixelLength(), width - Config.CANVAS_MARGIN);
        this.programTimelineDrawer = new ProgramTimelineDrawer(this.canvas);
        this.timelineBarDrawer = new TimelineBarDrawer(this.canvas);
        this.sidebarDrawer = new SidebarDrawer(this.canvas);

        let patternIDs = new Set<number>();
        for (let threadRibbonToPatternID of programRibbonToPatternID)
            for (let patternID of threadRibbonToPatternID)
                patternIDs.add(patternID);

        this.colorPicker = new ColorPicker(programRibbonToPatternID, patternIDs);
        this.program = program;
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

    drawProgramData() {
        let intervalsDrawn = 0;
        for (let i = 0; i < this.program.threads.length; i++) {
            let thread = this.program.threads[i];
            for (let j = 0; j < thread.patterns.length; j++) {
                let pattern = thread.patterns[j];
                let pixelStart: number;
                let pixelEnd: number;
                let panel: TimeframePanel;

                let k = 0; 
                for (let interval of pattern.patternIntervals) {
                    while (this.timeframePanels[k].end < interval[0]) {
                        k++;
                        if (k == this.timeframePanels.length) break;
                    }

                    if (k == this.timeframePanels.length) break; // Move onto next pattern

                    panel = this.timeframePanels[k];
                    if (interval[0] < panel.start) {
                        pixelStart = panel.pixelStart;
                    } else {
                        pixelStart = Math.floor((interval[0] - panel.start) / panel.resolution) + panel.pixelStart;
                    }

                    while (this.timeframePanels[k].end < interval[1]) {
                        k++;
                        if (k == this.timeframePanels.length) break;
                    }

                    if (k == this.timeframePanels.length) {
                        pixelEnd = this.timeframePanels[k - 1].pixelEnd;
                        this.programTimelineDrawer.drawInterval(i, j, pixelStart, pixelEnd, this.colorPicker.getColor(i, j));
                        break; // Move onto next pattern
                    } else {
                        panel = this.timeframePanels[k]
                        if (interval[1] < panel.start) {
                            pixelEnd = panel.pixelStart;
                        } else {
                            pixelEnd = Math.floor((interval[1] - panel.start) / panel.resolution) + panel.pixelStart;
                        }
                        this.programTimelineDrawer.drawInterval(i, j, pixelStart, pixelEnd, this.colorPicker.getColor(i, j));
                    }
                }
            }
        }
    }

    drawTimelineBar() {
        let pixelOffset = 0;
        let numNotches = Math.floor(this.canvas.totalPixelLength / Config.TARGET_NOTCH_LENGTH);
        for (let timeframePanel of this.timeframePanels) {
            while (pixelOffset < timeframePanel.pixelEnd) {
                let nextNotchTime = (pixelOffset - timeframePanel.pixelStart) / (timeframePanel.pixelEnd - timeframePanel.pixelStart)
                                  * (timeframePanel.end - timeframePanel.start) + timeframePanel.start;
                this.timelineBarDrawer.drawTimelineBar(nextNotchTime, pixelOffset);
                pixelOffset += Config.TARGET_NOTCH_LENGTH;
            }
        }
    }
    
    drawNameSidebar(names: string[]) {
        this.sidebarDrawer.drawSidebar(names);
    }

    setupTimeSquaredSampling(sampler: (interval: number[], thread: number) => void) {
        this.canvas.setupClickHandler((thread: number, pattern: number, pixelOffset: number) => {
            let start = 0;
            let end = this.timeframePanels.length;
            while (start != end) {
                let middle = Math.floor((start + end) / 2);
                if (pixelOffset < this.timeframePanels[middle].pixelStart) end = middle;
                else start = middle + 1;
            }

            if (start == 0) return;

            // will for sure be a valid time, since pixelOffset will surely be on the program timeline.
            let time = this.timeframePanels[start - 1].pixelToTime(pixelOffset);

            let patternIntervals = this.program.threads[thread].patterns[pattern].patternIntervals;
            start = 0; 
            end = patternIntervals.length;
            while (start != end) {
                let middle = Math.floor((start + end) / 2);
                if (time < patternIntervals[middle][0]) end = middle;
                else start = middle + 1;
            }

            if (start == 0) return;

            let sampleInterval = patternIntervals[start - 1];
            sampler(sampleInterval, thread);
        });
    }
}
