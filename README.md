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

### Loading Data Into Postgres

First, install postgreSQL. The default database configurations are specified at the top of src/server/TimeSquaredDB.ts.

Create a schema 'sys', and create table 'trace' with: CREATE TABLE sys.trace ( "id" INTEGER, "dir" SMALLINT, "func" VARCHAR(255), "tid" SMALLINT, "time" BIGINT, "duration" BIGINT); 

We need to stream the data to copy into postgres, starting with the line with the COPY command. Use: 
tail -n +12 trace.txt | psql dinamite -c "COPY sys.trace (id, dir, func, tid, time, duration) FROM stdin"

Then, create an index to do range queries over time faster.
CREATE INDEX trace_index ON sys.trace (time);
