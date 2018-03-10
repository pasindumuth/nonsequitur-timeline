"use strict";

var Database = {};

var databaseSendPost = function (url, params, successCallback, errCallback) {
    var request = new XMLHttpRequest();
    request.open('POST', url, true);
    request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    request.send(params);
    request.onreadystatechange = function () {
        if (request.readyState === 4 && request.status === 200) {
            var type = request.getResponseHeader('Content-Type');
            if (type.indexOf("text") !== 1) {
                successCallback(request.responseText);
            }
        } else if (request.readyState === 4 && request.status === 500) {
            errCallback("Database Error");
        }
    };
};

Database.rawQuery = function (query) {
    return new Promise (function (resolve, reject) {
        function successCallback (data) {
            resolve(data);
        }
        function errCallback () {
            reject("Database Error");
        }
        databaseSendPost('/db', "query=" + encodeURIComponent(query), successCallback, errCallback);
    });
};

Database.getMetadata = function () {
    return new Promise (function (resolve, reject) {
        var timeQuery = 
            "SELECT MIN(time), MAX(time) \
            FROM trace",
            timeQueryPromise = new Promise (function (resolve, reject) {
                function successCallback (data) {
                    if (!data) {
                        reject("No values");
                    }
                    
                    var info = data.split(" ");
                    resolve({
                        startTime: info[0],
                        endTime: info[1].trim()
                    });
                }
                function errCallback () {
                    reject("Database Error");
                }
                databaseSendPost('/db', "query="+timeQuery, successCallback, errCallback);
            }),
            tidQuery = 
                "SELECT COUNT(*) \
                FROM (SELECT DISTINCT tid FROM trace) tids",
            tidQueryPromise = new Promise (function (resolve, reject) {
                function successCallback (data) {
                    if (!data) {
                        reject("No values");
                    }
                    
                    var info = data.split(" ");
                    resolve({
                        numThreads: info[0],
                    });
                }
                function errCallback () {
                    reject("Database Error");
                }
                databaseSendPost('/db', "query="+tidQuery, successCallback, errCallback);
            }),
            eventsQuery = 
                "SELECT COUNT(*) \
                FROM trace",
            eventsQueryPromise = new Promise (function (resolve, reject) {
                function successCallback (data) {
                    if (!data) {
                        reject("No values");
                    }
                    
                    var info = data.split(" ");
                    resolve({
                        numEvents: info[0],
                    });
                }
                function errCallback () {
                    reject("Database Error");
                }
                databaseSendPost('/db', "query="+eventsQuery, successCallback, errCallback);
            });
        
        Promise.all([timeQueryPromise, tidQueryPromise, eventsQueryPromise])
            .then(function (values) {
                resolve(Object.assign(values[0], values[1], values[2]));
            })
            .catch(function (err) {
                reject(err);
            });
    });
};

Database.getEventStats = function (tid, func, time) {
    return new Promise (function (resolve, reject) {
        var avgStdevQuery = 
            "SELECT stdev, avg\
            FROM avg_stdev \
            WHERE func = '" + func + "' LIMIT 1",
            avgStdevPromise = new Promise (function (resolve, reject) {
                function successCallback (data) {
                    if (!data) {
                        reject("No values");
                    }
                    
                    var info = data.split(" ");
                    resolve({
                        avg: parseInt(info[0], 10),
                        stddev: parseInt(info[1], 10)
                    });
                }
                function errCallback () {
                    reject("Database Error");
                }
                databaseSendPost('/db', "query="+avgStdevQuery, successCallback, errCallback);
            }),
            // TODO: Clean this up
            // May 4 2017: Derek Chan
            // Sasha had an issue where her database associated all durations 
            // with the t1.dir=1 tuple (ie. the exit event in the trace)
            //
            // The purpose of this query is:
            // Input: The user's mouse location on the screen, translated to absolute time, function name, and thread number
            // Output: The matching trace event ID and duration associated with that mouse location
            //
            // The top eventQuery finds the matching ENTER event (-->) and extracts
            // the event ID and duration from that tuple
            //
            // The second eventQuery finds the matching EXIT event (<--) and extracts
            // the event ID and duration from that tuple
            //
            // To fix Sasha's issue, the second query is only used.
            // Some smarter logic would probably run both queries and determine
            // which query is correct (it's not as trivial as you may think)

            // TODO: May 4 2017: unused. 
            eventQuery = 
                "SELECT t1.id, t1.duration \
                FROM trace t1 \
                WHERE t1.dir = 0 \
                AND t1.func = '" + func + "' \
                AND t1.tid = '" + tid + "' \
                AND t1.time <= " + time + "\
                ORDER BY t1.time DESC LIMIT 1",
            // TODO: May 4 2017: used.
            eventQuery = 
                "SELECT t1.id, t1.duration \
                FROM trace t1 \
                WHERE t1.dir = 1 \
                AND t1.func = '" + func + "' \
                AND t1.tid = '" + tid + "' \
                AND t1.time >= " + time + "\
                ORDER BY t1.time ASC LIMIT 1",
            eventPromise = new Promise (function (resolve, reject) {
                function successCallback (data) {
                    if (!data) {
                        reject("No values");
                    }
                    
                    var info = data.split(" ");
                    resolve({
                        id: parseInt(info[0], 10),
                        duration: parseInt(info[1], 10)
                    });
                }
                function errCallback () {
                    reject("Database Error");
                }
                databaseSendPost('/db', "query="+eventQuery, successCallback, errCallback);
            });
        
        Promise.all([avgStdevPromise, eventPromise])
            .then(function (values) {
                resolve(Object.assign(values[0], values[1]));
            })
            .catch(function (err) {
                reject(err);
            });
    });
    
};
