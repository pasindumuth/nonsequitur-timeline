/*jslint node: true */
"use strict";

var dataProcessorWebWorker = new Worker("js/backend/DataProcessorWebWorker.js"),
    gRenderer = new Renderer($('#mainRenderContainer')[0]),
    gMetadata = null,
    gStagedQueries = [],
    gStagedQueriesIndex = 0,
    gCompressedRegionThresholdFactor = 250,
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
 * transitionUI
 * Call this function when a user inputs data to the interface.
 * This function hides uneeded DOM elements and prepares the
 * page for the rendering layout.
 # @param filename: Unprocessed filename
 */
function transitionUI(filename) {
    var label;
    
    // Change the UI
    $('#InputGroup').hide();
    $("#Db").hide();
    $('#ProgressBarWrapper').show();
    $('#reloadButton').show();
    
    // Print the filename in the textfield
    label = filename.replace(/\\/g, '/').replace(/.*\//, '');
    document.getElementById("InputFileText").value = label;
    
    $("#title").hide();
    $("#filenameHeader").html(label).show();
}

$(document).ready( function () {
    if (window.Worker) {
        console.log("WebWorkers supported!");
    } else {
        console.log("WebWorkers not supported");
    }
    
    // Enable tooltips
    $('#smSample').popover({
        html: true,
        container: 'body',
        content: $('#smSamplePopover').html()
    });
    $('#mdSample').popover({
        html: true,
        container: 'body',
        content: $('#mdSamplePopover').html()
    });
    $('#dbDashboard').popover({
        html: true,
        container: 'body',
        content: $('#dbDashboardPopover').html()
    });
    
    /**
     * Handler to process a local file
     */
    $("#InputFile").on('change', function(evt) {
        var reader = new FileReader();
        
        transitionUI($(this).val());
        
        // Read the file and send it to the WebWorker
        reader.onload = function(evt) {
            dataProcessorWebWorker.postMessage(["rawdata", evt.target.result]);
            updateProgressBar("100%", "First-pass through logfile...");
        };

        reader.readAsText(evt.target.files[0]);
    });
	
    /**
     * Handler to process a file hosted on a server
     */
    $(".sampleButton").on('click', function() {
        var request = new XMLHttpRequest(),
            filename = $(this).attr('link');
        
        transitionUI(filename);
        
        // read text from URL location and send it to the WebWorker
        request.open('GET', filename, true);
        request.send(null);
        request.onreadystatechange = function () {
            if (request.readyState === 4 && request.status === 200) {
                var type = request.getResponseHeader('Content-Type');
                if (type.indexOf("text") !== 1) {
                    dataProcessorWebWorker.postMessage(["rawdata", request.responseText]);
                    updateProgressBar("100%", "First-pass through logfile...");
                }
            }
        };
    });
    
    // /**
    //  * Callback chain for retrieving metadata and events from database
    //  */
    // function dbGetEvents() {
    //     Database.getEvents()
    //     .then(function (events) {
    //         var i;
    //         for (i = 0; i < events.length; i++) {
    //             gRenderer.renderEvent(gMetadata, events[i]);
    //         }
    //         updateProgressBar("100%", "Done.");
    //         $('#ProgressBarWrapper').hide();
    //     });
    // }
    // function dbGetMetadata() {
    //     Database.getMetadata()
    //     .then(function (metadata) {
    //         transitionUI("Database Query");
    //         updateProgressBar("100%", "Processing events...");
    //         gMetadata = metadata;
    //         gRenderer.renderMetadata(gMetadata);
    //         dbGetEvents();
    //     });
    // }
    // $("#dbAll").on('click', function() {
    //     dbGetMetadata();
    // });
    
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
});
