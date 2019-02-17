import $ from 'jquery';
import Timeline from './Timeline';
import {AjaxData} from '../shared/shapes';

import {Renderer} from './timesquared/frontend/Renderer';
import Database from './timesquared/frontend/Database';
import TransferrableEventObj from './timesquared/shared/TransferrableEventObj';
import {createQuery} from "../shared/Utils";
import {MetaData} from "./timesquared/shared/shapes";
import FunctionData from "./FunctionData";
import ShapeRenderer from "./ShapeRenderer";
import ShapeMath from "./ShapeMath";
import ShapeClusterer from "./ShapeClusterer";


let dataProcessorWebWorker = new Worker("./js/backend/DataProcessorWebWorker.js");
let gRenderer: Renderer = null;
let functionData: FunctionData;
let gMetadata: MetaData = null,
    gStagedQueries = [],
    gStagedQueriesIndex = 0,
    gCompressedRegionThresholdFactor = 2000;


function render(result: AjaxData) {
    console.log("start rendering");
    let program = result.program;
    let width = $(window).width();
    let timeline = new Timeline(program, width);

    let rootDiv = $("#mainPatternRenderContainer");
    let div = document.createElement("div");
    $(div).addClass("canvas-div");
    $(div).append(timeline.canvas);
    // $(rootDiv).append(div);

    timeline.setupHoverBehaviour();
    timeline.render();
    timeline.setupTimeSquaredSampling((interval: number[], threadId: string) => {
        let absoluteTime = program.absoluteStartTime;
        let absoluteTimePrefix = absoluteTime.substring(0, absoluteTime.length - 15);
        let absoluteTimeOffset = absoluteTime.substring(absoluteTime.length - 15, absoluteTime.length);
        let timeStart = interval[0] + parseInt(absoluteTimeOffset);
        let timeEnd = interval[1] + parseInt(absoluteTimeOffset);
        let query = createQuery(absoluteTimePrefix, timeStart, timeEnd, threadId);
        executeQuery(query);
    });

    functionData = new FunctionData(result.functions);
    // gRenderer = new Renderer($('#mainRenderContainer').get(0), functionData);
    const shapeMath = new ShapeMath(result.strippedPatternShapes);
    const shapeClusterer = new ShapeClusterer(result.strippedPatternShapes, shapeMath);
    const shapeRenderer = new ShapeRenderer(result.strippedPatternShapes, shapeMath, functionData, shapeClusterer.clusteredShapes);
    shapeRenderer.renderAll();
    shapeRenderer.setupDistanceFiltering();
    shapeRenderer.setupDistanceLabel();
    shapeRenderer.setClusterDisplaying();
    shapeClusterer.printClusters();
    console.log("all done");
}

/**
 * Automatically runs once all DOM manipulation is complete.
 */

function executeQuery(query: string) {
    const newTimesquared = document.createElement("div");
    $('#mainRenderContainer').prepend(newTimesquared)
    gRenderer = new Renderer(newTimesquared, functionData);
    
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
            // Clean function data
            gMetadata.functions = gMetadata.functions.map(
                raw => raw.slice(1, raw.length - 1)); // get rid of extra quotation marks
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