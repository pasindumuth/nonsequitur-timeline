"use strict";

let RIBBON_LIGHT = "#eaeaea",
    RIBBON_DARK = "#f4f4f4";

let render = function (result) {
    console.log("start rendering");
    let timeframePanelsRaw = result.timeframePanelsRaw;
    let program = result.program;

    let timelineData = [];
    for (let thread of program.threads) {
        let patterns = thread.patterns;
        timelineData.push(patterns.length);
    }

    let width = $(window).width();
    let timelineCanvas = new Canvas(timeframePanelsRaw, timelineData, {width});

    let rootDiv = $("#mainRenderContainer");
    for (let canvas of timelineCanvas.canvasList) {
        let div = document.createElement("div");
        $(div).addClass("canvas-div");
        $(div).append(canvas);
        $(rootDiv).append(div);
    }

    timelineCanvas.drawTimelineBar();
    console.log("start canvas drawing");
    drawRibbons(timelineCanvas);
    drawProgramData(program, timelineCanvas);

    let names = [];
    for (let thread of program.threads) {
        names.push(thread.threadData.name);
    }
    timelineCanvas.drawNameSidebar(names);

    timelineCanvas.setupMouseEvents(rootDiv);
    console.log("all done");
}

let drawProgramData = function (program, timelineCanvas) {
    let intervalsDrawn = 0;
    for (let i = 0; i < program.threads.length; i++) {
        let thread = program.threads[i];
        for (let j = 0; j < thread.patterns.length; j++) {
            let pattern = thread.patterns[j];
            for (let interval of pattern.patternIntervals) {
                timelineCanvas.drawInterval(i, j, interval[0], interval[1], timelineCanvas.getColor(i, j));
                intervalsDrawn++;
            }
        }
    }

    console.log(intervalsDrawn)
}

let drawRibbons = function (timelineCanvas) {
    let color = RIBBON_LIGHT;
    let start = timelineCanvas.timelineTimeStart; 
    let end = timelineCanvas.timelineTimeEnd; 

    for (let i = 0; i < timelineCanvas.timelineData.length; i++) {
        let ribbons = timelineCanvas.timelineData[i]
        for (let j = 0; j < ribbons; j++) {
            if (color == RIBBON_DARK) color = RIBBON_LIGHT;
            else color = RIBBON_DARK;
            timelineCanvas.drawInterval(i, j, start, end, color)
        }
    }
}

$(document).ready(function () {
    $.ajax({url: "/data", success: render});
});



/**
 * TODO:
 * 
 * Main:
 * thread info
 * pattern sample, 
 * 
 * 
 * Extra: 
 * fix timeline bar hanging at the end
 * get threadData, prograData properly. Very clear pattern of how these are set up (heirarchical). make it happen
 */