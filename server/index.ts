"use strict";

import express from 'express';
import bodyParser from 'body-parser';
import main from "./processor";

let app = express();
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

const server = app.listen(4000, () => {
    console.log(
        "  App is running at http://localhost:%",
        4000,
    );
    console.log("  Press CTRL-C to stop\n");
});
  