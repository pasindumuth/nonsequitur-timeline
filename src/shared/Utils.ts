import Constants from "./Constants";

/**
 * Creates a SQL query that gets all the events in the trace between startTime
 * and endTime for the given thread. This is mainly used to get the events in a pattern.
 * @param absTimePrefix absoluteTimePrefix of the trace
 * @param timeStart absoluteTimeSuffix of the start timestamps
 * @param timeEnd absoluteTimeSuffix of the end timestamps
 * @param threadID id whose events we want
 *
 */
export function createQuery(absTimePrefix: string, timeStart: number, timeEnd: number, threadID: string): string {
    return "SELECT dir, func, tid, time FROM sys.trace "
        + "WHERE "
        + absTimePrefix + timeStart.toString()
        + " <= time AND time <= "
        + absTimePrefix + timeStart.toString() + " + " + (timeEnd - timeStart).toString()
        + " and tid = " + threadID
        + ";";
}

export function byte2Hex (n: number): string {
    let str = n.toString(16);
    return "00".substr(str.length) + str;
}

export function rgbToColorHexstring (r: number, g: number, b: number): string {
    return '#' + byte2Hex(r) + byte2Hex(g) + byte2Hex(b);
}

export function colorHexstringToRgb (hex: string): number[] {
    let col = [],
        i;
    for (i = 1; i < 7; i+=2) {
        col.push(parseInt(hex.substr(i, 2), 16));
    }
    return col;
}

export function isNullPattern(patternId: number) {
    return patternId == Constants.NULL_PATTERN_ID;
}

export function e(name: string, classNames: string[], text?: string) {
    const element = document.createElement(name);
    element.classList.add(...classNames);
    if (text) {
        element.appendChild(document.createTextNode(text));
    }
    return element;
}