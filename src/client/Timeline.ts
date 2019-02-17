import { Program } from '../shared/shapes';
import ColorPicker from './ColorPicker';
import ResolutionReducer from "./ResolutionReducer";
import Constants from "./Constants";
import $ from "jquery";
import ShapeRenderer from "./ShapeRenderer";

export default class Timeline {

    canvas: HTMLCanvasElement;
    canvasWidth: number;
    canvasHeight: number;

    timelineWidth: number; // after left and right padding within the canvas is accounted for

    colorPicker: ColorPicker;
    program: Program;
    shapeRenderer: ShapeRenderer;

    processor: ResolutionReducer;
    threadHeightMap = new Map<string, number>();
    threadYOffsets = new Map<string, number>();

    infoBox: HTMLDivElement;
    text: HTMLDivElement;

    // The windowWidth is the number of CSS pixels across the screen. On a Retina display, one CSS pixel
    // is 2x2 screen pixels. In order to increase the resolution of the canvas, we must fix the CSS width to the screen width,
    // but double the width property of the canvas. We do the same for height. All pixel values here (width and height)
    // will be relative to the increased resolution of the canvas.
    constructor(program: Program, windowWidth: number, shapeRenderer: ShapeRenderer) {
        this.program = program;
        this.canvasWidth = windowWidth * 2;
        this.shapeRenderer = shapeRenderer;
        this.timelineWidth = this.canvasWidth - (Constants.TIMELINE_LEFT_PADDING + Constants.TIMELINE_RIGHT_PADDING);

        this.canvas = document.createElement("canvas");
        this.canvas.className = "timeline";
        this.canvas.style.setProperty("width", windowWidth.toString() + "px"); // Fix CSS width so canvas doesn't resize.
        this.canvas.width = this.canvasWidth;
        let patternIds = new Set<number>();
        for (let thread of program.threads) {
            for (let pattern of thread.patterns) {
                patternIds.add(pattern.id);
            }
        }

        this.colorPicker = new ColorPicker(patternIds);

        this.processor = new ResolutionReducer(program, this.timelineWidth);
        for (let threadId of this.processor.reducedResolutionProgram.keys()) {
            this.threadHeightMap.set(threadId, this.processor.reducedResolutionProgram.get(threadId).length * Constants.TIMELINE_RIBBON_HEIGHT);
        }

        let totalHeight = 0;
        for (let thread of this.program.threads) {
            totalHeight += Constants.TIMELINE_TOP_PADDING;
            this.threadYOffsets.set(thread.id, totalHeight);
            totalHeight += this.threadHeightMap.get(thread.id);
        }

        let canvasCssHeight = Math.floor(totalHeight / 2) + 200;
        this.canvas.style.setProperty("height", canvasCssHeight.toString() + "px");
        this.canvasHeight = canvasCssHeight * 2;
        this.canvas.height = this.canvasHeight;

        // Info box. Create a hidden div. When it is needed, make it visible, translate it, style it, and set it's contents as
        // necessary.
        this.text = document.createElement("div");
        this.text.className = "infoBox-text";

        this.infoBox = document.createElement("div");
        this.infoBox.className = "infoBox";
        this.infoBox.appendChild(this.text);

        $(this.infoBox).css({
            "visibility": "hidden",
            "z-index" : 5,
            "overflow": "scroll",
            "width": Constants.INFO_BOX_WIDTH,
            "height": Constants.INFO_BOX_HEIGHT,
        });

        let rootDiv = $("#mainPatternRenderContainer");
        $(rootDiv).append(this.infoBox);
    }

    render() {
        let context = this.canvas.getContext("2d");
        context.translate(Constants.TIMELINE_LEFT_PADDING, 0);
        for (let thread of this.program.threads) {
            context.translate(0, Constants.TIMELINE_TOP_PADDING);
            let patternsForThread = this.processor.reducedResolutionProgram.get(thread.id);
            for (let depth = 0; depth < patternsForThread.length; depth++) {
                let patternsAtDepth = patternsForThread[depth];
                let y = Constants.TIMELINE_RIBBON_HEIGHT * depth;
                for (let pattern of patternsAtDepth) {
                    context.strokeStyle = this.colorPicker.patternIdToColor.get(pattern.id);
                    for (let x of pattern.pixelOffsets) {
                        context.beginPath();
                        context.moveTo(x, y);
                        context.lineTo(x, y + Constants.TIMELINE_RIBBON_HEIGHT);
                        context.stroke();
                    }
                }
            }
            context.translate(0, this.threadHeightMap.get(thread.id));
        }
    }

    setupHoverBehaviour() {
        $(this.canvas).mousemove(e => {
            let canvasXCoordinate = e.offsetX * 2;
            let canvasYCoordinate = e.offsetY * 2;
            let threadId = this.findThreadForHeight(canvasYCoordinate);
            let timelineOffsetX = canvasXCoordinate - Constants.TIMELINE_LEFT_PADDING;
            let timelineOffsetY = canvasYCoordinate - this.threadYOffsets.get(threadId);

            // Guarentee that the Canvas X and Y Coordinates are in the space of a thread's timeline.
            if (0 <= timelineOffsetY && timelineOffsetY < this.threadHeightMap.get(threadId)
             && 0 <= timelineOffsetX && timelineOffsetX < this.timelineWidth) {
                let depth = Math.floor(timelineOffsetY / Constants.TIMELINE_RIBBON_HEIGHT);
                let pattern = this.processor.patternPerOffsetPerDepthPerThread.get(threadId)[depth][timelineOffsetX];
                if (pattern) {
                    // An interval is defined for this point on the canvas
                    this.shapeRenderer.showRenderedShapesInDiv(pattern.representation.shapeIds, this.infoBox);
                    $(this.infoBox).css({
                        "visibility": "visible",
                        "border-width": 5,
                        "border-color": (this.colorPicker.patternIdToColor.get(pattern.id)),
                        "left": e.offsetX,
                        "top": e.offsetY + 2
                    });
                    return;
                }
            }

            $(this.infoBox).css({
                "visibility": "hidden",
            });
        })
    }

    /** Given a y offset in the canvas (in coordinate space, not CSS offset), find the thread id of the y resides in. */
    findThreadForHeight(offsetY: number): string {
        let threadId = this.program.threads[0].id;
        for (let i = 1; i < this.program.threads.length; i++) {
            let thread = this.program.threads[i];
            let nextHeight = this.threadYOffsets.get(thread.id);
            if (nextHeight > offsetY) {
                break;
            } else {
                threadId = thread.id;
            }
        }
        return threadId;
    }

    setupTimeSquaredSampling(sampler: (interval: number[], threadId: string) => void) {
        $(this.canvas).click(e => {
            let canvasXCoordinate = e.offsetX * 2;
            let canvasYCoordinate = e.offsetY * 2;
            let threadId = this.findThreadForHeight(canvasYCoordinate);
            let timelineOffsetX = canvasXCoordinate - Constants.TIMELINE_LEFT_PADDING;
            let timelineOffsetY = canvasYCoordinate - this.threadYOffsets.get(threadId);

            // Guarentee that the Canvas X and Y Coordinates are in the space of a thread's timeline.
            if (0 <= timelineOffsetY && timelineOffsetY < this.threadHeightMap.get(threadId)
             && 0 <= timelineOffsetX && timelineOffsetX < this.timelineWidth) {
                let depth = Math.floor(timelineOffsetY / Constants.TIMELINE_RIBBON_HEIGHT);
                let sampleInterval = this.processor.sampleIntervalPerOffsetPerDepthPerThread.get(threadId)[depth][timelineOffsetX];
                if (sampleInterval) {
                    sampler(sampleInterval, threadId)
                }
            }
        })
    }
}
