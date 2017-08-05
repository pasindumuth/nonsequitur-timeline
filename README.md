# NonSequiturTimeline

## Setting Up

1. Clone this repository
2. `cd nonsequitur-timeline`
3. `npm install`
3. Place `trace.bin.*.patterns` files in `server/data/`
4. `npm run devstart` or `node index.js` to start the server (the former automatically restarts the server when a file is changed)

### Config

`server/config.json` contains configurations. Under `programConfig`, the `RESOLUTION` is the number of ns corresponding to one pixel. Under
`threads`, each object corresponds to a thread that wil be displayed in the viz. `numTopPatterns` is the number of patterns to show
for that thread.

### TimeSquared Queries

When the server responds to a request, a `server/queries.json` is created with SQL queries of samples of the patterns which were just requested.
These queries can be used in TimeSquared to see those patterns in detail.

### Canvas

The `public/Canvas.js` object is the main drawing interface for NonSequiturTimeline. At the top are constants that control the viz, such as
the ribbon height, spacing between threads, etc.