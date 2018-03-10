"use strict";

import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import main from './server/processor';
import tsdb from './server/TimeSquaredDB';

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
            for (i = 0; i < result.data.length; i++) {
                resultStr += result.data[i].join(" ");
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
  