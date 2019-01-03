"use strict";

// import { Client}  from 'pg';

// const PGDB_OPTIONS = {
//     user: 'pasindumuthukuda',
//     host: 'localhost',
//     database: 'dinamite',
//     password: '',
//     port: 5432,
// }

// let query = "SELECT * FROM sys.trace LIMIT 2;";
// let conn = new Client(PGDB_OPTIONS);
// conn.connect();
// conn.query(query, (err, result) => {
//     console.log(err, result);
//     conn.end()
// });

// function rawQuery (query: string) {
//     let conn = new Client(PGDB_OPTIONS);
//     return new Promise(function (resolve, reject) {
//         conn.connect();
//         conn.query(query, (err, result) => {
//             console.log("BLAHBLAH");
//             if (result) {
//                 console.log(result);
//                 resolve(result);
//             } else {
//                 reject(err);
//             }
//             conn.end()
//         });
//     });
// };

// rawQuery("SELECT * FROM sys.trace LIMIT 2")
//     .then(function(result) {
//         console.log(result);
//     })
//     .catch(function (err) {
//         console.log(err);
//     });

import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import tsdb from './server/TimeSquaredDB';
import main from './server/processor'

let app = express();
let program = main();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get("/data", function (request, response) {
    response.writeHead(200, {"Content-Type": "application/json"});
    response.write(JSON.stringify(program));
    response.end();    
});

app.post('/db', function(req, res) {
    var query = req.body.query;
    console.log("Executing database query:\n\t" + query);
    tsdb.rawQuery(query)
        .then(function(result: any) {
            // Brute force with existing implementation: Format the output
            // to ressemble the current text-file format
            var resultStr = "",
                i;
            // for (i = 0; i < result.data.length; i++) {
            //     resultStr += result.data[i].join(" ");
            //     resultStr += "\n";
            // }

            for (i = 0; i < result.data.length; i++) {
                resultStr += result.data[i].dir ? 1 : 0;
                resultStr += " " + result.data[i].func;
                resultStr += " " + result.data[i].tid;
                resultStr += " " + result.data[i].time;
                resultStr += "\n";
            }
            res.send(resultStr);
            console.log("Sent " + result.data.length + " tuples");
        })
        .catch(function(err) {
            res.sendStatus(500);
            console.log(err);
        });
});

app.post('/db/metadata', function(req, res) {
    tsdb.getMetadata()
        .then(function(result) {
            res.send(result);
        })
        .catch(function(err) {
            res.sendStatus(500);
            console.log(err);
        });
});

app.post('/db/events', function(req, res) {
    tsdb.getEvents()
        .then(function(result) {
            res.send(result);
        })
        .catch(function(err) {
            res.sendStatus(500);
            console.log(err);
        });
});


const server = app.listen(4000, () => {
    console.log(
        "  App is running at http://localhost:%",
        4000,
    );
    console.log("  Press CTRL-C to stop\n");
});
  