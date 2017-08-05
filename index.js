"use strict";

let express = require('express');
let bodyParser = require('body-parser');
let app = express();
let http = require('http').Server(app);

let main = require("./server/processor").main;
let program = main();


app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('./public'));

app.get("/data", function (request, response) {
    response.writeHead(200, {"Content-Type": "application/json"});
    response.write(JSON.stringify(program));
    response.end();    
});

let server = http.listen(4000, function () {
    let host = server.address().address,
        port = server.address().port;

    console.log('NonSequiturTimeline Vizualization hosted on http://%s:%s', host, port);
});
