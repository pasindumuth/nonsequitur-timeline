import {Program, Thread} from '../shared/shapes';
import ColorPicker from './ColorPicker';
import ResolutionReducer from './ResolutionReducer';
import Constants from './Constants';
import $ from 'jquery';
import ShapeRenderer from './ShapeRenderer';

export default class Timeline {

    mainContainer: HTMLDivElement;
    windowWidth: number;

    canvasList = new Array<HTMLCanvasElement>();
    threadByCanvasIndex = new Array<string>();
    canvasWidthPx: number;
    canvasWidth: number;
    timelineWidth: number; // after left and right padding within the canvas is accounted for

    colorPicker: ColorPicker;
    program: Program;
    shapeRenderer: ShapeRenderer;

    processor: ResolutionReducer;
    threadHeightMap = new Map<string, number>();

    infoBox: HTMLDivElement;

    // The windowWidth is the number of CSS pixels across the screen. On a Retina display, one CSS pixel
    // is 2x2 screen pixels. In order to increase the resolution of the canvas, we must fix the CSS width to the screen width,
    // but double the width property of the canvas. We do the same for height. All pixel values here (width and height)
    // will be relative to the increased resolution of the canvas.
    constructor(program: Program, windowWidth: number, shapeRenderer: ShapeRenderer) {
        this.program = program;
        this.windowWidth = windowWidth;
        this.canvasWidthPx = windowWidth - Constants.THREAD_INFO_BOX_WIDTH;
        this.canvasWidth = this.canvasWidthPx * 2;
        this.timelineWidth = this.canvasWidth - (Constants.TIMELINE_LEFT_PADDING + Constants.TIMELINE_RIGHT_PADDING);

        this.shapeRenderer = shapeRenderer;

        let patternIds = new Set<number>();
        program.threads.forEach(
            thread => thread.patterns.forEach(
                pattern => patternIds.add(pattern.id)));

        this.colorPicker = new ColorPicker(patternIds);

        this.processor = new ResolutionReducer(program, this.timelineWidth);
        for (let threadId of this.processor.reducedResolutionProgram.keys()) {
            this.threadHeightMap.set(threadId, this.processor.reducedResolutionProgram.get(threadId).length * Constants.TIMELINE_RIBBON_HEIGHT);
        }

        this.infoBox = <HTMLDivElement>document.getElementsByClassName('timeline-info-box')[0];
        this.mainContainer = document.createElement('div');
    }

    render() {
        for (let thread of this.program.threads) {
            this.mainContainer.appendChild(this.renderThread(thread));
        }
    }

    renderThread(thread: Thread): HTMLDivElement {
        const threadInfo = document.createElement('div');
        $(threadInfo)
            .html(`<div>Thread ID: ${thread.id}</div>`)
            .css({
                'display': 'flex',
                'justify-content': 'center',
                'width': Constants.THREAD_INFO_BOX_WIDTH,
            });

        const canvas = document.createElement('canvas');
        const canvasHeight = Constants.TIMELINE_VERTICAL_PADDING
            + this.threadHeightMap.get(thread.id)
            + Constants.TIMELINE_VERTICAL_PADDING;
        canvas.width = this.canvasWidth;
        canvas.height = canvasHeight;
        this.canvasList.push(canvas);
        this.threadByCanvasIndex.push(thread.id);

        // Fixes the CSS width so the canvas doesn't resize.
        $(canvas).css({
            'height': canvasHeight / 2,
            'width': this.canvasWidthPx,
        });

        this.renderThreadIntoCanvas(thread, canvas);

        const canvasContainer = document.createElement('div');
        $(canvasContainer)
            .css({ 'cursor': 'crosshair' })
            .append(canvas);

        const container = document.createElement('div');
        $(container)
            .css({
                'align-items': 'center',
                'display': 'flex',
            })
            .append(threadInfo)
            .append(canvasContainer);

        return container;
    }

    renderThreadIntoCanvas(thread: Thread, canvas: HTMLCanvasElement) {
        const context = canvas.getContext('2d');
        context.translate(Constants.TIMELINE_LEFT_PADDING, Constants.TIMELINE_VERTICAL_PADDING);
        const patternsForThread = this.processor.reducedResolutionProgram.get(thread.id);
        for (let depth = 0; depth < patternsForThread.length; depth++) {
            const patternsAtDepth = patternsForThread[depth];
            const y = Constants.TIMELINE_RIBBON_HEIGHT * depth;
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
    }

    setupHoverBehaviour() {
        for (let canvasIndex = 0; canvasIndex < this.canvasList.length; canvasIndex++) {
            const canvas = this.canvasList[canvasIndex];
            $(canvas).mousemove(e => {
                const rect = canvas.getBoundingClientRect();
                const coordX = e.pageX - rect.left;
                const coordY = e.pageY - rect.top;
                let canvasXCoordinate = coordX * 2;
                let canvasYCoordinate = coordY * 2;
                let timelineOffsetX = canvasXCoordinate - Constants.TIMELINE_LEFT_PADDING;
                let timelineOffsetY = canvasYCoordinate - Constants.TIMELINE_VERTICAL_PADDING;
                const threadId = this.threadByCanvasIndex[canvasIndex];

                // Guarentee that the Canvas X and Y Coordinates are in the space of a thread's timeline.
                if (0 <= timelineOffsetY && timelineOffsetY < this.threadHeightMap.get(threadId)
                 && 0 <= timelineOffsetX && timelineOffsetX < this.timelineWidth) {
                    let depth = Math.floor(timelineOffsetY / Constants.TIMELINE_RIBBON_HEIGHT);
                    let pattern = this.processor.patternPerOffsetPerDepthPerThread.get(threadId)[depth][timelineOffsetX];
                    if (pattern) {
                        // An interval is defined for this point on the canvas
                        this.shapeRenderer.showRenderedShapesInDiv(pattern.representation.shapeIds, this.infoBox);
                        $(this.infoBox).css({
                            'visibility': 'visible',
                            'border-width': 5,
                            'border-color': (this.colorPicker.patternIdToColor.get(pattern.id)),
                            'left': e.pageX,
                            'top': e.pageY + 2
                        });
                        return;
                    }
                }

                $(this.infoBox).css({
                    'visibility': 'hidden',
                });
            });
        }
    }

    setupTimeSquaredSampling(sampler: (interval: number[], threadId: string) => void) {
        for (let canvasIndex = 0; canvasIndex < this.canvasList.length; canvasIndex++) {
            const canvas = this.canvasList[canvasIndex];
            $(canvas).click(e => {
                const rect = canvas.getBoundingClientRect();
                const coordX = e.pageX - rect.left;
                const coordY = e.pageY - rect.top;
                let canvasXCoordinate = coordX * 2;
                let canvasYCoordinate = coordY * 2;
                let timelineOffsetX = canvasXCoordinate - Constants.TIMELINE_LEFT_PADDING;
                let timelineOffsetY = canvasYCoordinate - Constants.TIMELINE_VERTICAL_PADDING;
                const threadId = this.threadByCanvasIndex[canvasIndex];

                // Guarentee that the Canvas X and Y Coordinates are in the space of a thread's timeline.
                if (0 <= timelineOffsetY && timelineOffsetY < this.threadHeightMap.get(threadId)
                 && 0 <= timelineOffsetX && timelineOffsetX < this.timelineWidth) {
                    let depth = Math.floor(timelineOffsetY / Constants.TIMELINE_RIBBON_HEIGHT);
                    let sampleInterval = this.processor.sampleIntervalPerOffsetPerDepthPerThread.get(threadId)[depth][timelineOffsetX];
                    if (sampleInterval) {
                        sampler(sampleInterval, threadId)
                    }
                }
            });
        }
    }
}
