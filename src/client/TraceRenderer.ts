import FunctionData from "./FunctionData";
import Constants from "./Constants";

export default class TraceRenderer {
    readonly MAX_DEPTH = 16;

    functionData: FunctionData;
    traceEvents: TraceEvent[];
    canvas: HTMLCanvasElement;

    constructor(rawTraceEvents: string[], functionData: FunctionData) {
        this.functionData = functionData;
        this.traceEvents = this.extractTraceEvents(rawTraceEvents);
        this.canvas = document.createElement('canvas');

        const numEvents = this.traceEvents.length;
        const coordinateWidth = 2 * Constants.PATTERN_VIS_PADDING + numEvents * Constants.PATTERN_VIS_PX_PER_UNIT;
        const coordinateHeight = 2 * Constants.PATTERN_VIS_PADDING + this.MAX_DEPTH * Constants.PATTERN_VIS_PX_PER_UNIT;
        this.canvas.width = coordinateWidth;
        this.canvas.height = coordinateHeight;
        // Fix CSS width so canvas doesn't resize.
        this.canvas.style.setProperty('width', (coordinateWidth / 2).toString() + 'px');
        this.canvas.style.setProperty('height', (coordinateHeight / 2).toString() + 'px');
    }

    private extractTraceEvents(rawTraceEvents: string[]): TraceEvent[] {
        const traceEvents = new Array<TraceEvent>();
        for (const event of rawTraceEvents) {
            const parsedEvent = event.split(' ');
            if (event.length < 2) {
                console.log('malformed event: ' + event);
                continue;
            }
            const functionName = parsedEvent[1].substring(1, parsedEvent[1].length - 1);
            if (this.functionData.functionToId.has(functionName)) {
                // There might be functions that we filtered out from the original trace.
                // We can ignore these here if we encouter them.
                traceEvents.push({
                    entrance: parseInt(parsedEvent[0]) === 0,
                    functionId: this.functionData.functionToId.get(functionName),
                });
            }
        }
        return traceEvents;
    }

    render() {
        // Assume that 16 is the max depth.
        const x = Constants.PATTERN_VIS_PADDING;
        const y = Constants.PATTERN_VIS_PADDING + this.MAX_DEPTH * Constants.PATTERN_VIS_PX_PER_UNIT;
        this.renderInstance(0, x, y);
    }

    /**
     * Renders the function call instance of traceEvents[index] (an entrance event) with the bottom let
     * corner being x, y, and return the index which the function call instances ends
     */
    private renderInstance(index: number, x: number, y: number): {
        endIndex: number,
        endX: number,
    } {
        const childrenY = y - Constants.PATTERN_VIS_PX_PER_UNIT;
        let currentIndex = index + 1;
        let currentX = x + Constants.PATTERN_VIS_PX_PER_UNIT;
        while (this.traceEvents[currentIndex].entrance) {
            const { endIndex, endX } = this.renderInstance(currentIndex, currentX, childrenY);
            currentIndex = endIndex;
            currentX = endX;
        }
        // We have reached the end of the function call
        const context = this.canvas.getContext('2d');
        const event = this.traceEvents[index];
        context.fillStyle = this.functionData.functionIdToColor.get(event.functionId);
        context.fillRect(x, childrenY, currentX - x, Constants.PATTERN_VIS_PX_PER_UNIT);
        return {
            endIndex: currentIndex + 1,
            endX: currentX + Constants.PATTERN_VIS_PX_PER_UNIT,
        }
    }
}

class TraceEvent {
    entrance: boolean;
    functionId: number;
}