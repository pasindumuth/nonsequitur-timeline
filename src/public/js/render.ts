import $ from 'jquery';
import TimelineVis from './TimelineVis';
import Config from './Config';

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

    let rootDiv = $("#mainRenderContainer");
    for (let canvas of timelineVis.canvas.panels) {
        let div = document.createElement("div");
        $(div).addClass("canvas-div");
        $(div).append(canvas);
        $(rootDiv).append(div);
    }

    timelineVis.drawTimelineBar();
    console.log("start canvas drawing");
    drawRibbons(timelineVis, programRibbonData);
    drawProgramData(timelineVis, program);

    let names = new Array<string>();
    for (let thread of program.threads) {
        names.push(thread.threadData.name);
    }
    timelineVis.drawNameSidebar(names);

    // timelineVis.setupMouseEvents(rootDiv);
    console.log("all done");
}

function drawProgramData(timelineVis: TimelineVis, program: Program) {
    let intervalsDrawn = 0;
    for (let i = 0; i < program.threads.length; i++) {
        let thread = program.threads[i];
        for (let j = 0; j < thread.patterns.length; j++) {
            let pattern = thread.patterns[j];
            for (let interval of pattern.patternIntervals) {
                timelineVis.drawInterval(i, j, interval[0], interval[1], timelineVis.getColor(i, j)); // getting the colors here? seems hacky
                intervalsDrawn++;
            }
        }
    }

    console.log(intervalsDrawn)
}

function drawRibbons(timelineVis: TimelineVis, programRibbonData: number[]) {
    let color = Config.RIBBON_LIGHT;
    let start = timelineVis.timelineStartTime; 
    let end = timelineVis.timelineEndTime; 

    for (let i = 0; i < programRibbonData.length; i++) {
        let ribbons = programRibbonData[i]
        for (let j = 0; j < ribbons; j++) {
            color = (color == Config.RIBBON_DARK) ? Config.RIBBON_LIGHT : Config.RIBBON_DARK;
            timelineVis.drawInterval(i, j, start, end, color)
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