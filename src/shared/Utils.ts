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
