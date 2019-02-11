import * as d3 from "d3";
import {colorHexstringToRgb, rgbToColorHexstring} from "../shared/Utils";

export default class FunctionData {
    functions: Array<string>;
    eventColors: { [p: string]: string; } = {};
    colToEvent: { [p: string]: string; } = {};

    constructor(functions: string[]) {
        for (let index = 0; index < functions.length; index++) {
            const func = functions[index];
            const colOffset = Math.floor(index / 20);
            const rgbEventColor = colorHexstringToRgb(d3.schemeCategory20[index % 20]);
            const eventColor = rgbToColorHexstring(
                rgbEventColor[0] - colOffset,
                rgbEventColor[1] - colOffset,
                rgbEventColor[2] - colOffset
            );
            this.eventColors[func] = eventColor;
            this.colToEvent[eventColor] = func;
        }

        this.functions = functions;
    }
}
