/*jslint node: true */
"use strict";

var dataProcessorWebWorker = new Worker("../js/backend/DataProcessorWebWorker.js"),
    gRenderer = new Renderer($('#mainRenderContainer')[0]),
    gMetadata = null,
    gStagedQueries = [],
    gStagedQueriesIndex = 0,
    gCompressedRegionThresholdFactor = 2000,
    gProgressBar = $("#ProgressBar");

/**
 * updateProgressBar
 * @param width: String with percentage for the width of the progress bar
 * @param html: Optional param. Text contents for the progress bar
 */
function updateProgressBar(width, html) {
    var htmlContent = html !== undefined ? html : width;
    gProgressBar.width(width);
    gProgressBar.html(htmlContent);
}


/**
 * Automatically runs once all DOM manipulation is complete.
 */
function main () {
    // If we have a query string, then automatically send it to the backend
    var url = window.location.href.split('?'),
        query;
    if (url.length > 1) {
        query = url[1];
        if (query.length === 0) {
            query = "SELECT dir, func, tid, time FROM trace limit 500";
        }
        
        $("#filenameHeader").html(decodeURI(query));
        
        Database.rawQuery(decodeURI(query))
        .then(function (rawdata) {
            // transitionUI(decodeURI(query));
            dataProcessorWebWorker.postMessage(["rawdata", rawdata]);
            updateProgressBar("100%", "First-pass through logfile...");
        })
        .catch(function (err) {
            $("#errorMessage").html("Error: ".bold() + err).show();
        });
    }
}

$(document).ready( function () {
    if (window.Worker) {
        console.log("WebWorkers supported!");
    } else {
        console.log("WebWorkers not supported");
    }
    
    /**
     * requestNextQuery
     * Sends the next query out of gStagedQueries
     */
    function requestNextQuery() {
        var nextQuery,
            progress;
        
        if (gStagedQueriesIndex < gStagedQueries.length) {
            nextQuery = gStagedQueries[gStagedQueriesIndex];
            gStagedQueriesIndex++;
            dataProcessorWebWorker.postMessage(["sift", nextQuery]);
            
            // Update the progress bar
            progress = Math.ceil(gStagedQueriesIndex * 100 / gStagedQueries.length);
            updateProgressBar(progress.toString() + "%");
        } else {
            updateProgressBar("100%", "Done.");
            $('#ProgressBarWrapper').hide();
        }
    }
    
    /**
     * Message handler for WebWorker
     * @param e: message event
     */
    dataProcessorWebWorker.onmessage = function(e) {
        var i, events;
        
        switch(e.data[0]) {
        case "progressUpdate":
            updateProgressBar(e.data[1].toString() + "%");
            break;
        
        case "metadata":
            gMetadata = e.data[1];
            
            $("#ProgressBar")
                .width("100%")
                .html("Processing parsed events...");
            
            dataProcessorWebWorker.postMessage([
                "requestCompressedRegions",
                gMetadata.startTime,
                gMetadata.endTime,
                gCompressedRegionThresholdFactor * gMetadata.minElapsedTime
            ]);
            
            break;
        
        case "compressedRegions":
            // Draw the metadata and the compressed regions
			gRenderer.renderMetadata(gMetadata, e.data);
            
            // Next step: start sending queries
			gStagedQueries = gRenderer.getQueryObjects();
            gStagedQueriesIndex = 0;
            requestNextQuery();
            break;
            
        default:
            // We were sent events.
            
            // Get the next query staged while we draw this one...
            requestNextQuery();
            
            // Draw the events
            events = TransferrableEventObj.fromTransferrableArray(new Uint32Array(e.data));
            for (i = 0; i < events.length; i++) {
				gRenderer.renderEvent(gMetadata, events[i]);
            }
            
            break;
        }
    };
    
    main();
});
