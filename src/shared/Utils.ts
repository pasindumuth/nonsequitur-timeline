export default class Utils {

    /**
     * Creates a SQL query that gets all the events in the trace between startTime 
     * and endTime for the given thread. This is mainly used to get the events in a pattern.
     * @param absTimePrefix absoluteTimePrefix of the trace
     * @param timeStart absoluteTimeSuffix of the start timestamps
     * @param timeEnd absoluteTimeSuffix of the end timestamps
     * @param threadID threadID whose events we want
     * 
     */
    static createQuery(absTimePrefix: string, timeStart: number, timeEnd: number, threadID: string): string {
        return "SELECT dir, func, tid, time FROM sys.trace "
            + "WHERE " 
            + absTimePrefix + timeStart.toString() 
            + " <= time AND time <= " 
            + absTimePrefix + timeStart.toString() + " + " + (timeEnd - timeStart).toString() 
            + " and tid = " + threadID
            + ";";
    }

    /**
     * Fisher-Yates algorithm for shuffling an array
     * @param array array to shuffle
     */
    static shuffle(array: any[]) {
        let counter = array.length;
    
        // While there are elements in the array
        while (counter > 0) {
            // Pick a random index
            let index = Math.floor(Math.random() * counter);
    
            // Decrease counter by 1
            counter--;
    
            // And swap the last element with it
            let temp = array[counter];
            array[counter] = array[index];
            array[index] = temp;
        }
    }

    /**
     * Makes a matrix symmetric by taking the average of symmetric elements (two elements are symmetric
     * if their coordinates are (i, j) and (j, i)).
     * @param matrix matrix to symmetrify
     */
    static symmetrify(matrix: any[][]) {
        for (let i = 0; i < matrix.length; i++) {
            for (let j = i + 1; j < matrix.length; j++) {
                let avg = (matrix[i][j] + matrix[j][i]) / 2;
                matrix[i][j] = avg;
                matrix[j][i] = avg;
            }
        }
    }
}
