import $ from 'jquery';
import TimelineVis from './TimelineVis';
import Config from './Config';
import { AjaxData } from '../shapes';

import Renderer from './timesquared/frontend/Renderer';
import Database from './timesquared/frontend/Database';
import TransferrableEventObj from './timesquared/shared/TransferrableEventObj';

function render(result: AjaxData) {
    console.log("start rendering");
    let timeframePanelsRaw = result.timeframePanelsRaw;
    let program = result.program;

    let programRibbonData = new Array<number>();
    for (let thread of program.threads) {
        let patterns = thread.patterns;
        programRibbonData.push(patterns.length);
    }

    let width = $(window).width();
    let timelineVis = new TimelineVis(timeframePanelsRaw, programRibbonData, width);

    let rootDiv = $("#mainPatternRenderContainer");
    for (let canvas of timelineVis.canvas.panels) {
        let div = document.createElement("div");
        $(div).addClass("canvas-div");
        $(div).append(canvas);
        $(rootDiv).append(div);
    }

    let names = new Array<string>();
    for (let thread of program.threads) {
        names.push(thread.threadData.name);
    }
    
    console.log("start canvas drawing");

    timelineVis.drawTimelineBar();
    timelineVis.drawProgramData(program);
    timelineVis.drawNameSidebar(names);
    // timelineVis.setupMouseEvents(rootDiv);

    console.log("all done");
}


let dataProcessorWebWorker = new Worker("./js/backend/DataProcessorWebWorker.js"),
    gRenderer = new Renderer($('#mainRenderContainer')[0]),
    gMetadata = null,
    gStagedQueries = [],
    gStagedQueriesIndex = 0,
    gCompressedRegionThresholdFactor = 2000;

/**
 * Automatically runs once all DOM manipulation is complete.
 */
function main () {
    let query = "SELECT dir, func, tid, time FROM trace limit 500;";
    Database.rawQuery(decodeURI(query))
    .then(function (rawdata) {
        dataProcessorWebWorker.postMessage(["rawdata", rawdata]);
    })
    .catch(function (err) {
        $("#errorMessage").html("Error: ".bold() + err).show();
    });
}

$(document).ready( function () {
    $.ajax({url: "/data", success: render});
    
    /**
     * requestNextQuery
     * Sends the next query out of gStagedQueries
     */
    function requestNextQuery() {
        var nextQuery;
        
        if (gStagedQueriesIndex < gStagedQueries.length) {
            nextQuery = gStagedQueries[gStagedQueriesIndex];
            gStagedQueriesIndex++;
            dataProcessorWebWorker.postMessage(["sift", nextQuery]);
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
            break;
        
        case "metadata":
            gMetadata = e.data[1];
            
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
