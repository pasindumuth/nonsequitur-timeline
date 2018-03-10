"use strict";

var MDB = require('monetdb')();
var MDB_OPTIONS = {
    host     : 'localhost', 
    port     : 50000, 
    dbname   : 'dinamite', 
    user     : 'monetdb', 
    password : 'monetdb'
};

var rawQuery = function (query) {
    var conn = new MDB(MDB_OPTIONS);
    return new Promise(function (resolve, reject) {
        conn.connect();
        conn.query(query)
            .then(function (result) {
                resolve(result);
            })
            .catch(function (err) {
                reject(err);
            });
        conn.close();
    });
};

/**
 * Private method.
 * Creates a reverse lookup for an array
 * @param list: List to create reverse lookup
 * @return dict object for reverse lookup
 */
var createReverseLookup = function(list) {
    var i,
        dict = {};
    
    for (i = 0; i < list.length; i++) {
        dict[list[i]] = i;
    }
    
    return dict;
};

module.exports = {
    rawQuery: rawQuery,
    
    getMetadata: function () {
        return new Promise(function (resolve, reject) {
            var metadata = {},
                queries = [
                    new Promise(function (resolve, reject) {
                        rawQuery("SELECT MIN(time) AS startTime, MAX(time) AS endTime FROM trace")
                            .then(function (result) {
                                metadata.startTime = result.data[0][0];
                                metadata.endTime = result.data[0][1];
                                resolve();
                            })
                            .catch(function (err) {
                                reject(err);
                            });
                    }),
                    new Promise(function (resolve, reject) {
                        rawQuery("SELECT DISTINCT tid FROM trace ORDER BY tid")
                            .then(function (result) {
                                var threadNames = [],
                                    i;
                                for (i = 0; i < result.data.length; i++) {
                                    threadNames = threadNames.concat(result.data[i]);
                                }
                                metadata.threads = threadNames;
                                resolve();
                            })
                            .catch(function(err) {
                                reject(err);
                            });
                    }),
                    new Promise(function (resolve, reject) {
                        rawQuery("SELECT DISTINCT func FROM trace ORDER BY func")
                            .then(function (result) {
                                var funcNames = [],
                                    i;
                                for (i = 0; i < result.data.length; i++) {
                                    funcNames = funcNames.concat(result.data[i]);
                                }
                                metadata.functions = funcNames;
                                resolve();
                            })
                            .catch(function(err) {
                                reject(err);
                            });
                    }),
                    new Promise(function (resolve, reject) {
                        rawQuery("SELECT DISTINCT lock FROM trace ORDER BY lock")
                            .then(function (result) {
                                var lockNames = [],
                                    i;
                                for (i = 0; i < result.data.length; i++) {
                                    lockNames = lockNames.concat(result.data[i]);
                                }
                                metadata.locknames = lockNames;
                                resolve();
                            })
                            .catch(function(err) {
                                reject(err);
                            });
                    }),
                    new Promise(function (resolve, reject) {
                        rawQuery("SELECT func, lock FROM event GROUP BY func, lock")
                            .then(function (result) {
                                var events = [],
                                    eventName,
                                    i;
                                for (i = 0; i < result.data.length; i++) {
                                    eventName = result.data[i][1] ? result.data[i].join(":::") : result.data[i][0];
                                    events = events.concat(eventName);
                                }
                                metadata.events = events;
                                resolve();
                            })
                            .catch(function(err) {
                                reject(err);
                            });
                    }),
                    new Promise(function (resolve, reject) {
                        rawQuery("SELECT MAX(stackdepth) FROM stackdepth")
                            .then(function (result) {
                                metadata.maxStackDepth = result.data[0][0];
                                resolve();
                            })
                            .catch(function(err) {
                                reject(err);
                            });
                    })
                ];
            
            Promise.all(queries)
                .then(function () {
                    metadata.minElapsedTime = 512;
                    metadata.eventsReverseLookup = createReverseLookup(metadata.events);
                    metadata.functionsReverseLookup = createReverseLookup(metadata.functions);
                    metadata.locknamesReverseLookup = createReverseLookup(metadata.locknames);
                    resolve(metadata);
                })
                .catch(function (reason) {
                    console.log("Rejected for reason" + reason);
                    reject(reason);
                });
        });
    },
    
    getEvents: function() {
        return new Promise(function (resolve, reject) {
            rawQuery("SELECT * FROM eventdata")
                .then(function (result) {
                    var events = [],
                        i;
                    for (i = 0; i < result.data.length; i++) {
                        events.push({
                            "threadName": result.data[i][0],
                            "functionName": result.data[i][1],
                            "startTime": result.data[i][2],
                            "endTime": result.data[i][3],
                            "lockName":result.data[i][4],
                            "stackDepth": result.data[i][5],
                            "denormalized": true
                        });
                    }
                    resolve(events);
                })
                .catch(function(err) {
                    console.log("Error:" + err);
                    reject(err);
                });
        });
    }
};