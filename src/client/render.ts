import $ from 'jquery';
import TimelineVis from './TimelineVis';
import Config from './Config';
import { AjaxData } from '../shapes';

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


$(document).ready(function () {
    $.ajax({url: "/data", success: render});
});
