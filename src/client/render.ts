import $ from 'jquery';
import TimelineVis from './TimelineVis';
import Timeline from './timeline2/Timeline';
import Config from './Config';
import { AjaxData } from '../shared/shapes';
import Utils from '../shared/Utils';

import { FunctionData, Renderer } from './timesquared/frontend/Renderer';
import Database from './timesquared/frontend/Database';
import TransferrableEventObj from './timesquared/shared/TransferrableEventObj';


let dataProcessorWebWorker = new Worker("./js/backend/DataProcessorWebWorker.js");
let gRenderer: Renderer = null;
let functionData: FunctionData;
let gMetadata = null,
    gStagedQueries = [],
    gStagedQueriesIndex = 0,
    gCompressedRegionThresholdFactor = 2000;


function render(result: AjaxData) {
    console.log("start rendering");
    let timeframePanelsRaw = result.timeframePanelsRaw;
    let program = result.program;

    let programRibbonToPatternID = new Array<number[]>();
    for (let thread of program.threads) {
        let threadRibbonToPatternID = new Array<number>();
        for (let pattern of thread.patterns) {
            threadRibbonToPatternID.push(pattern.id);
        }
        programRibbonToPatternID.push(threadRibbonToPatternID);
    }

    console.log(programRibbonToPatternID);

    let width = $(window).width();
    let timelineVis = new TimelineVis(timeframePanelsRaw, programRibbonToPatternID, width, program);

    let rootDiv = $("#mainPatternRenderContainer");
    for (let canvas of timelineVis.canvas.panels) {
        let div = document.createElement("div");
        $(div).addClass("canvas-div");
        $(div).append(canvas);
        $(rootDiv).append(div);
    }

    let threadIDs = new Array<string>();
    for (let thread of program.threads) {
        threadIDs.push(thread.id);
    }
    
    console.log("start canvas drawing");

    timelineVis.drawTimelineBar();
    timelineVis.drawProgramData();
    timelineVis.drawNameSidebar(threadIDs);

    timelineVis.setupTimeSquaredSampling((interval: number[], thread: number) => {
        if (interval[1] - interval[0] > Config.MAX_SAMPLE_INTERVAL_SIZE) return;
        let tid = program.threads[thread].id;
        let absoluteTime = program.absoluteStartTime;
        let absoluteTimePrefix = absoluteTime.substring(0, absoluteTime.length - 15);
        let absoluteTimeOffset = absoluteTime.substring(absoluteTime.length - 15, absoluteTime.length);
        let timeStart = interval[0] + parseInt(absoluteTimeOffset);
        let timeEnd = interval[1] + parseInt(absoluteTimeOffset);
        let query = Utils.createQuery(absoluteTimePrefix, timeStart, timeEnd, tid);
        executeQuery(query);
    });

    functionData = new FunctionData(result.functions);
    gRenderer = new Renderer($('#mainRenderContainer').get(0), functionData);

    console.log("all done");
}
//
// function render2(result: AjaxData) {
//     console.log("start rendering");
//     let program = result.program;
//
//     let width = $(window).width() * 2;
//     let timeline = new Timeline(program);
//
//     let rootDiv = $("#mainPatternRenderContainer");
//     for (let canvas of timeline.canvas.panels) {
//         let div = document.createElement("div");
//         $(div).addClass("canvas-div");
//         $(div).append(canvas);
//         $(rootDiv).append(div);
//     }
//
//     let threadIDs = new Array<string>();
//     for (let thread of program.threads) {
//         threadIDs.push(thread.threadData.id);
//     }
//
//     console.log("start canvas drawing");
//
//     timeline.drawTimelineBar();
//     timeline.drawProgramData();
//     timeline.drawNameSidebar(threadIDs);
//
//     timeline.setupTimeSquaredSampling((interval: number[], thread: number) => {
//         if (interval[1] - interval[0] > Config.MAX_SAMPLE_INTERVAL_SIZE) return;
//         let tid = program.threads[thread].threadData.id;
//         let timeStart = interval[0] + program.programData.start;
//         let timeEnd = interval[1] + program.programData.start;
//         let query = Utils.createQuery(program.programData.absoluteTimePrefix, timeStart, timeEnd, tid);
//         executeQuery(query);
//
//     });
//
//     functionData = new FunctionData(result.functions);
//     gRenderer = new Renderer($('#mainRenderContainer').get(0), functionData);
//
//     console.log("all done");
// }

/**
 * Automatically runs once all DOM manipulation is complete.
 */

function executeQuery(query: string) {
    gRenderer = new Renderer($('#mainRenderContainer').get(0), functionData);
    
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
});

/**
 * TODO: fixed TS cutting when there is super small viz.
 */