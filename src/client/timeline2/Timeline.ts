import { Program } from '../../shared/shapes';
import ColorPicker from './ColorPicker';
import ResolutionReducer, {LowResolutionPattern} from "./ResolutionReducer";
import Constants2 from "./Constants2";

export default class Timeline {

    canvas: HTMLCanvasElement;
    canvasWidth: number;
    canvasHeight: number;

    timelineWidth: number; // after left and right padding within the canvas is accounted for

    colorPicker: ColorPicker;
    program: Program;

    reducedResolutionPatterns: Map<string, LowResolutionPattern[][]>;
    threadHeightMap: Map<string, number>;

    // The windowWidth is the number of CSS pixels across the screen. On a Retina display, one CSS pixel
    // is 2x2 screen pixels. In order to increase the resolution of the canvas, we must fix the CSS width to the screen width,
    // but double the width property of the canvas. We do the same for height. All pixel values here (width and height)
    // will be relative to the increased resolution of the canvas.
    constructor(program: Program, windowWidth: number) {
        this.program = program;
        this.canvasWidth = windowWidth * 2;
        this.timelineWidth = this.canvasWidth - (Constants2.TIMELINE_LEFT_PADDING + Constants2.TIMELINE_RIGHT_PADDING);

        this.canvas = document.createElement("canvas");
        this.canvas.style.setProperty("width", windowWidth.toString() + "px"); // Fix CSS width so canvas doesn't resize.
        this.canvas.width = this.canvasWidth;
        let patternIds = new Set<number>();
        for (let thread of program.threads) {
            for (let pattern of thread.patterns) {
                patternIds.add(pattern.id);
            }
        }

        this.colorPicker = new ColorPicker(patternIds);

        let processor = new ResolutionReducer(program, this.timelineWidth);
        this.reducedResolutionPatterns = processor.intervalToPixelTransform();
        this.threadHeightMap = new Map<string, number>();
        for (let threadId of this.reducedResolutionPatterns.keys()) {
            this.threadHeightMap.set(threadId, this.reducedResolutionPatterns.get(threadId).length * Constants2.TIMELINE_RIBBON_HEIGHT);
            console.log(this.reducedResolutionPatterns.get(threadId).length);
        }

        let totalHeight = this.threadHeightMap.size * Constants2.TIMELINE_TOP_PADDING;
        console.log(this.threadHeightMap.size);
        for (let threadId of this.threadHeightMap.keys()) {
            totalHeight += this.threadHeightMap.get(threadId);
        }

        let canvasCssHeight = Math.floor(totalHeight / 2) + 200;
        this.canvas.style.setProperty("height", canvasCssHeight.toString() + "px");
        this.canvasHeight = canvasCssHeight * 2;
        this.canvas.height = this.canvasHeight;
    }

    render() {
        let context = this.canvas.getContext("2d");
        context.translate(Constants2.TIMELINE_LEFT_PADDING, 0);
        for (let thread of this.program.threads) {
            context.translate(0, Constants2.TIMELINE_TOP_PADDING);
            let patternsForThread = this.reducedResolutionPatterns.get(thread.id);
            for (let depth = 0; depth < patternsForThread.length; depth++) {
                let patternsAtDepth = patternsForThread[depth];
                let y = Constants2.TIMELINE_RIBBON_HEIGHT * depth;
                for (let pattern of patternsAtDepth) {
                    context.strokeStyle = this.colorPicker.patternIdToColor.get(pattern.id);
                    console.log(this.colorPicker.patternIdToColor.get(pattern.id));
                    console.log(y);
                    for (let x of pattern.pixelOffsets) {
                        context.beginPath();
                        context.moveTo(x, y);
                        context.lineTo(x, y + Constants2.TIMELINE_RIBBON_HEIGHT);
                        context.stroke();
                    }
                }
            }
            context.translate(0, Constants2.TIMELINE_TOP_PADDING + this.threadHeightMap.get(thread.id));
        }
    }

    //
    // drawTimelineBar() {
    //     let pixelOffset = 0;
    //     let numNotches = Math.floor(this.canvas.totalPixelLength / Config.TARGET_NOTCH_LENGTH);
    //     for (let timeframePanel of this.timeframePanels) {
    //         while (pixelOffset < timeframePanel.pixelEnd) {
    //             let nextNotchTime = (pixelOffset - timeframePanel.pixelStart) / (timeframePanel.pixelEnd - timeframePanel.pixelStart)
    //                 * (timeframePanel.end - timeframePanel.start) + timeframePanel.start;
    //             this.timelineBarDrawer.drawTimelineBar(nextNotchTime, pixelOffset);
    //             pixelOffset += Config.TARGET_NOTCH_LENGTH;
    //         }
    //     }
    // }
    //
    // drawNameSidebar(names: string[]) {
    //     this.sidebarDrawer.drawSidebar(names);
    // }
    //
    // setupTimeSquaredSampling(sampler: (interval: number[], thread: number) => void) {
    //     this.canvas.setupClickHandler((thread: number, pattern: number, pixelOffset: number) => {
    //         let start = 0;
    //         let end = this.timeframePanels.length;
    //         while (start != end) {
    //             let middle = Math.floor((start + end) / 2);
    //             if (pixelOffset < this.timeframePanels[middle].pixelStart) end = middle;
    //             else start = middle + 1;
    //         }
    //
    //         if (start == 0) return;
    //
    //         // will for sure be a valid time, since pixelOffset will surely be on the program timeline.
    //         let time = this.timeframePanels[start - 1].pixelToTime(pixelOffset);
    //
    //         let intervals = this.program.threads[thread].patterns[pattern].intervals;
    //         start = 0;
    //         end = intervals.length;
    //         while (start != end) {
    //             let middle = Math.floor((start + end) / 2);
    //             if (time < intervals[middle][0]) end = middle;
    //             else start = middle + 1;
    //         }
    //
    //         if (start == 0) return;
    //
    //         let sampleInterval = intervals[start - 1];
    //         sampler(sampleInterval, thread);
    //     });
    // }
}
