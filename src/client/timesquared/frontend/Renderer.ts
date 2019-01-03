"use strict";

import * as d3 from 'd3';
import QueryConstructor from './QueryConstructor';
import { MetaData, Event } from '../shared/shapes';

const
    G_COMPRESSED_VIZ_WIDTH = 50, //px
    G_EVENT_HEIGHT = 4, //px
    G_THREAD_PADDING = 10, //px
    G_THREAD_PANEL_FONT_SIZE = 12, //px
    G_HOSTBAR_WIDTH = 100, //px
    G_HOSTBAR_TEXT_PADDING = 5, //px
    G_PANEL_TIMEBAR_HEIGHT = 30, //px
    G_PANEL_MOUSE_HOVER_IDLE_TIME = 250,
    G_TIMEBAR_TICK_SIZE = 10, //px
    G_TIMEBAR_TIMESPAN_FACTOR = 100,

    /**
     * TUNING PARAMETER
     * The number of viz's that get filled with events per query
     */
    G_NLAYERS_PER_QUERY_BATCH = 2;

function byte2Hex (n: number): string {
    let str = n.toString(16);
    return "00".substr(str.length) + str;
}

function rgbToColorHexstring (r: number, g: number, b: number): string {
    return '#' + byte2Hex(r) + byte2Hex(g) + byte2Hex(b);
}

function colorHexstringToRgb (hex: string): number[] {
    let col = [],
        i;
    for (i = 1; i < 7; i+=2) {
        col.push(parseInt(hex.substr(i, 2), 16));
    }
    return col;
}

function infoHTML (thread, func, abstime, reltime) {
    return (func ? "thread " + thread + ": " + func.bold() : "") + "<br>" +
    "abs. time: " + abstime.toLocaleString() + " ns<br>" +
    "rel. time: " + reltime.toLocaleString() + " ns";
}

function statsHTML (id, duration, avg, stddev) {
    return "<br>Event ID: " + id.toLocaleString() +
    "<br>Duration: " + duration.toLocaleString() + " ns" +
    "<br>Mean duration: " + parseInt(avg, 10).toLocaleString() + " ns" +
    "<br>Std. Dev: " + parseInt(stddev, 10).toLocaleString();
}

/**
 * Infopane Element
 */
function createInfopaneElement(infopaneContainer: HTMLDivElement, eventName: string, thread: number, 
                               time: number, absStartTime: number, color: string, zoomToDiv: HTMLElement) {
    let div =  document.createElement("div"),
        text = document.createElement("div"),
        closeButton = document.createElement("button"),
        relTime = Math.floor(time - absStartTime).toLocaleString();
        
    div.className = "infopaneElement";
    $(div).css({'border-color': color});
    $(div).on("click", function () {
        $(zoomToDiv).get(0).scrollIntoView({
            behavior: "smooth"
        });
    });
    $(text).html(infoHTML(thread, eventName, time, relTime));
    closeButton.className = "btn infopaneElementButton";
    $(closeButton).html('<i class="glyphicon glyphicon-remove"></i>');
    $(closeButton).on("click", function (e) {
        infopaneContainer.removeChild(div);
        e.stopPropagation();
    });
    div.appendChild(text);
    div.appendChild(closeButton);
    infopaneContainer.appendChild(div);
};

/**
 * Panel
 */
class Panel {
    absoluteStartTime: number;
    startTime: number;
    endTime: number;
    isCompressed: boolean;
    resolution: number;
    
    div: HTMLDivElement;
    canvas: HTMLCanvasElement;

    timebar: HTMLCanvasElement;
    timeToPixelFactor: number;

    constructor(rootDiv: HTMLDivElement, absoluteStartTime: number, startTime: number, endTime: number, 
                width: number, height: number, resolution: number, isCompressed: boolean) {

        this.absoluteStartTime = absoluteStartTime;
        this.startTime = startTime;
        this.endTime = endTime;
        this.isCompressed = isCompressed;
        this.resolution = resolution;
        
        this.div = document.createElement('div');
        this.div.className = "rendererPanel";
        this.div.style.width = width + "px";
        
        this.canvas = document.createElement('canvas');
        this.canvas.className = isCompressed ? "rendererPanelCanvasCompressed" : "rendererPanelCanvas";
        this.canvas.width = width;
        this.canvas.height = height;
        this.div.appendChild(this.canvas);
        
        this.timebar = document.createElement('canvas');
        this.timebar.className = "rendererPanelTimebar";
        this.timebar.width = width;
        this.timebar.height = G_PANEL_TIMEBAR_HEIGHT;
        this.div.appendChild(this.timebar);
        
        this.timeToPixelFactor = width / (endTime - startTime);
            
        rootDiv.appendChild(this.div);
        
        this.renderTimeAxis();
    }

    renderTimeAxis(): void {
        let ctx = this.timebar.getContext("2d");
        let xToTime = d3.scaleLinear()
                        .domain([0, this.timebar.width])
                        .range([this.startTime - this.absoluteStartTime, this.endTime - this.absoluteStartTime]);
            
        // We want the timespan to be log-related to the resolution of the viz
        let resolutionNearestFactorOf10 = Math.pow(10, Math.ceil(Math.log10(this.resolution)))
        let timespan = resolutionNearestFactorOf10 * G_TIMEBAR_TIMESPAN_FACTOR;
        // Start the tick at the first timespan multiple
        let startTime = (Math.floor((this.startTime - this.absoluteStartTime) / timespan)) * timespan;
        let x = (startTime - (this.startTime - this.absoluteStartTime)) * this.timeToPixelFactor;
        
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        
        ctx.beginPath();
        while (x < this.timebar.width) {
            if (x > 0) {
                ctx.fillText(Math.floor(xToTime(x)).toLocaleString() + " ns", x, G_TIMEBAR_TICK_SIZE);
                ctx.moveTo(x, 0);
                ctx.lineTo(x, G_TIMEBAR_TICK_SIZE);
            }
            x += timespan * this.timeToPixelFactor;
        }
        ctx.strokeStyle = "black";
        ctx.stroke();
    };

    renderEvent(metadata: MetaData, eventObj, eventColors, threadOffsets) {
        let event_startTime = eventObj.startTime;
        let event_endTime = eventObj.endTime;
        if (event_startTime > this.endTime || event_endTime < this.startTime) {
            return;
        }

        // HACK:
        // From textfiles, our strings are normalized and need to be
        // translated via LUT.
        // From db, our strings are not normalized and need to be left as is
        let event_lockName = eventObj.denormalized ? eventObj.lockName : metadata.locknames[eventObj.lockName];
        let event_functionName = eventObj.denormalized ? eventObj.functionName : metadata.functions[eventObj.functionName];
        let eventType = event_functionName;

        let eventColor = eventColors[eventType];
        if (eventColor === undefined) {
            console.log("Bad eventType: " + eventType);
            console.log("Bad event object: " + eventObj);
        }

        let x_start, eventWidth;
        if (this.isCompressed) {
            x_start = 0;
            eventWidth = this.canvas.width;
        } else {
            event_endTime = Math.min(event_endTime, this.endTime);
            event_startTime = Math.max(event_startTime, this.startTime);
            x_start = Math.floor((event_startTime - this.startTime) * this.timeToPixelFactor);
            let x_end = Math.ceil((event_endTime - this.startTime) * this.timeToPixelFactor);
            eventWidth = x_end - x_start;
        }

        if (eventWidth !== 0) {
            let y = threadOffsets[eventObj.threadName] - ((eventObj.stackDepth + 1) * G_EVENT_HEIGHT);
            let context = this.canvas.getContext("2d");
            context.beginPath();
            context.rect(x_start, y, eventWidth, G_EVENT_HEIGHT);
            context.fillStyle = eventColor;
            context.fill();
            context.closePath();
        }
    };

    setupMouseEvents(hoverinfobar: HTMLDivElement, infopane: HTMLDivElement, inverseThreadOffsets, colToEvent, threadSpacing) {
        let ctx = this.canvas.getContext("2d");
        let idleTimer = null;

        let mouseLocationToEventData = (canvas: HTMLElement, e) => {
            let mouseX = e.pageX - canvas.offsetLeft;
            let mouseY = e.pageY - canvas.offsetTop;
            let time = (mouseX / this.timeToPixelFactor) + this.startTime;
            let threadOffset = Math.floor(mouseY / threadSpacing);
            let color = ctx.getImageData(mouseX, mouseY, 1, 1).data;
            let threadHexColor = rgbToColorHexstring(color[0], color[1], color[2]);
            let eventName = colToEvent[threadHexColor] || "";
            let thread = inverseThreadOffsets[threadOffset];
            let info = eventName.split(":::");
                
            return {
                thread: thread,
                time: time,
                eventName: eventName,
                color: threadHexColor,
                func: info[0],
                lock: info[1]
            };
        }
        
        $(this.canvas).on("mousemove", (e) => {
            let edata = mouseLocationToEventData(e.currentTarget, e);
            let infobarHexColor = edata.color === "#000000" ? "#FFFFFF" : edata.color;
            let threadText = infoHTML(edata.thread, edata.eventName, Math.floor(edata.time), Math.floor(edata.time - this.absoluteStartTime));
            
            $(hoverinfobar).html(threadText);
            $(hoverinfobar).css({
                'top': e.pageY,
                'left': e.pageX + $(hoverinfobar).width() < $(window).width() ?
                    e.pageX :
                    $(window).width() - $(hoverinfobar).width(),
                'border-color': infobarHexColor
            });
            $(hoverinfobar).show();
            
            clearTimeout(idleTimer);
            if (edata.eventName) {
                idleTimer = setTimeout(() => {}, G_PANEL_MOUSE_HOVER_IDLE_TIME);
            }
        });
        
        $(this.canvas).on("mouseout", () => {
            $(hoverinfobar).hide();
            clearTimeout(idleTimer);
        });
        
        $(this.canvas).on("mouseup", (e) => {
            let edata = mouseLocationToEventData(e.currentTarget, e);
                
            if (edata.eventName) {
                createInfopaneElement(infopane, edata.eventName, edata.thread, edata.time, this.absoluteStartTime, edata.color, e.currentTarget);
            }
        });
    }

}

/**
 * Layer
 */
class Layer {
    widthAvailable: number;
    height: number;
    panels: Panel[];
    absoluteStartTime: number;
    
    div: HTMLDivElement;
    hostbar: HTMLCanvasElement;
    
    constructor (rootDiv: HTMLDivElement, width: number, height: number, absoluteStartTime: number) {
        this.widthAvailable = width - G_HOSTBAR_WIDTH;
        this.height = height;
        this.panels = new Array<Panel>();
        this.absoluteStartTime = absoluteStartTime;
        
        this.div = document.createElement('div');
        this.div.className = "rendererLayer";

        this.hostbar = document.createElement('canvas');
        this.hostbar.width = G_HOSTBAR_WIDTH;
        this.hostbar.height = height + G_PANEL_TIMEBAR_HEIGHT;
        this.hostbar.className = "rendererLayerHostbar";
        this.div.appendChild(this.hostbar);
        rootDiv.appendChild(this.div);
    }

    generateViz(startTime: number, endTime: number, resolution: number): number {
        if (this.widthAvailable <= 0) {
            return startTime;
        }
        let elapsedTime = this.widthAvailable * resolution;
        endTime = Math.min(endTime, startTime + elapsedTime);
        let width = Math.ceil((endTime - startTime) / resolution);
        this.widthAvailable -= width;
        this.panels.push(new Panel(this.div, this.absoluteStartTime, startTime, endTime, width, this.height, resolution, false));
        return endTime;
    };

    generateCompressedViz(startTime: number, endTime: number): number {
        if (this.widthAvailable < G_COMPRESSED_VIZ_WIDTH) {
            return startTime;
        }
        this.panels.push(new Panel(this.div, this.absoluteStartTime, startTime, endTime, G_COMPRESSED_VIZ_WIDTH, this.height, 0, true));
        this.widthAvailable -= G_COMPRESSED_VIZ_WIDTH;
        return endTime;
    };

    renderHostbar(metadata: MetaData, threadOffsets: number[]): void {
        let hostbarContext = this.hostbar.getContext("2d");
        hostbarContext.textAlign = "end";
        hostbarContext.font = G_THREAD_PANEL_FONT_SIZE + "px Sans-serif";
        for (let i = 0; i < metadata.threads.length; i++) {
            hostbarContext.fillText("T" + String(metadata.threads[i]),
                G_HOSTBAR_WIDTH - G_HOSTBAR_TEXT_PADDING,
                threadOffsets[metadata.threads[i]] - G_THREAD_PANEL_FONT_SIZE);
        }
    }

    startTime(): number {
        if (!this.panels) {
            return 0;
        }
    return this.panels[0].startTime;
    }

    endTime(): number {
        if (!this.panels) {
            return 0;
        }
        return this.panels[this.panels.length - 1].endTime;
    }
}


/**
 * Renderer
 */
export class Renderer {
    rootDiv: HTMLElement;
    renderDiv: HTMLDivElement;
    hoverinfobar: HTMLDivElement;
    infopane: HTMLDivElement;
    vizMaxWidth: number;
 
    functionData: FunctionData;

    layers: any;
    threadOffsets: number[];
    inverseThreadOffsets: number[];

    constructor(rootDiv: HTMLElement, functionData: FunctionData) {
        this.rootDiv = rootDiv;
        this.functionData = functionData;
        this.setup();
    }

    setup() {
        this.renderDiv = document.createElement('div');
        this.renderDiv.className = "rendererRoot";
        
        this.hoverinfobar = document.createElement('div');
        this.hoverinfobar.className = "rendererHoverinfobar";
        this.renderDiv.appendChild(this.hoverinfobar);
        
        this.infopane = document.createElement('div');
        this.infopane.className = "infopaneContainer";
        this.renderDiv.appendChild(this.infopane);
    
        this.rootDiv.appendChild(this.renderDiv);
    }

    clear() {
        $(this.renderDiv).empty();
        this.setup();
    }

    // FIX THIS CRUD
    renderMetadata(metadata: MetaData, compressedMetadata) {
        let i;
        compressedMetadata = compressedMetadata || [];
        let rootDivWidth = window.getComputedStyle(this.rootDiv).width; // save to prevent resizing issues
        this.vizMaxWidth = parseInt(rootDivWidth, 10) - G_HOSTBAR_WIDTH;
        
        this.renderMetadata_generateLayers(metadata, compressedMetadata[1] || []);
        this.renderMetadata_generateEventColors(metadata);
        this.renderMetadata_generateThreadOffsets(metadata);
        // for (i = 0; i < this.layers.length; i++) {
        //     this.layers[i].renderHostbar(metadata, this.threadOffsets);
        // }
        this.renderMetadata_generateMouseListeners(metadata, this.inverseThreadOffsets, this.functionData.colToEvent);
    };

    renderMetadata_generateLayers (metadata: MetaData, compressedRegions) {
        let resolution = metadata.minElapsedTime, // time per pixel
            vizHeight = ((metadata.maxStackDepth * G_EVENT_HEIGHT) + G_THREAD_PADDING) * metadata.threads.length,
            currTime = metadata.startTime,
            nextTime,
            endTime,
            layersIndex = 0,
            compressedRegionIndex = 0,
            currCompressedRegion;
        
        this.layers = [new Layer(this.renderDiv, this.vizMaxWidth, vizHeight, metadata.startTime)];
        
        if (compressedRegions.length > 0) {
            currCompressedRegion = compressedRegions[0];
        }
        while (currTime < metadata.endTime) {
            endTime = currCompressedRegion ? currCompressedRegion.startTime : metadata.endTime;
            if (currTime === endTime) {
                // currTime has reached the beginning of a compressedRegion
                nextTime = this.layers[layersIndex].generateCompressedViz(
                    currCompressedRegion.startTime, currCompressedRegion.endTime);
                if (nextTime !== currTime) {
                    // We successfully drew a compressed region
                    compressedRegionIndex++;
                    currCompressedRegion = compressedRegionIndex < compressedRegions.length ?
                                                compressedRegions[compressedRegionIndex] : null;
                }
            } else {
                // Typical case: fill up the layer with regular viz
                nextTime = this.layers[layersIndex].generateViz(currTime, endTime, resolution);
            }
            
            if (nextTime === currTime) {
                // The previous Layer became full
                this.layers.push(new Layer(this.renderDiv, this.vizMaxWidth, vizHeight, metadata.startTime));
                layersIndex++;
            }
            currTime = nextTime;
        }
    };

    renderMetadata_generateEventColors(metadata: MetaData) {
        let eventColor;
        let functions = this.functionData.functions;
        for (let func of metadata.functions) {
            if (!functions.includes(func)) {
                let index = functions.length;
                let colOffset = Math.floor(index / 20);
                
                if (colOffset == 0) {
                    eventColor = d3.schemeCategory20[index % 20];
                } else {
                    let rgbEventColor = colorHexstringToRgb(d3.schemeCategory20[index % 20]);
                    eventColor = rgbToColorHexstring(rgbEventColor[0] - colOffset, rgbEventColor[1] - colOffset, rgbEventColor[2] - colOffset);
                }

                this.functionData.eventColors[func] = eventColor;
                this.functionData.colToEvent[eventColor] = func;

                functions.push(func);
            }
        }
    };

    renderMetadata_generateThreadOffsets (metadata: MetaData) {
        let i;
        this.threadOffsets = [];
        this.inverseThreadOffsets = [];
        for (i = 0; i < metadata.threads.length; i++) {
            this.threadOffsets[metadata.threads[i]] = ((metadata.maxStackDepth * G_EVENT_HEIGHT) + G_THREAD_PADDING) * (i + 1);
            this.inverseThreadOffsets[i] = metadata.threads[i];
        }
    };

    renderMetadata_generateMouseListeners (metadata: MetaData, inverseThreadOffsets, colToEvent) {
        let i, j, threadSpacing;
        threadSpacing = (metadata.maxStackDepth * G_EVENT_HEIGHT) + G_THREAD_PADDING;
        for (i = 0; i < this.layers.length; i++) {
            for (j = 0; j < this.layers[i].panels.length; j++) {
                this.layers[i].panels[j].setupMouseEvents(this.hoverinfobar, this.infopane, inverseThreadOffsets, colToEvent, threadSpacing);
            }
        }
    };

    renderEvent (metadata: MetaData, event: Event) {
        let i, j;
        for (i = 0; i < this.layers.length; i++) {
            for (j = 0; j < this.layers[i].panels.length; j++) {
                this.layers[i].panels[j].renderEvent(
                    metadata, event, this.functionData.eventColors, this.threadOffsets);
            }
        }
    };

    /**
     * getQueryObjects
     * Creates a list of queries for all viz elements.
     * Each query batches a number of viz elements, as defined by NVIZ_PER_QUERY_BATCH
     * @return array of query objects
     */
    getQueryObjects() {
        let allQueries = [];
        
        for (let i = 0; i < this.layers.length; i += G_NLAYERS_PER_QUERY_BATCH) {
            let j = Math.min( i + G_NLAYERS_PER_QUERY_BATCH - 1, this.layers.length - 1);
            let startTime = this.layers[i].startTime();
            let endTime = this.layers[j].endTime();
            allQueries.push(QueryConstructor.queryTime(startTime, endTime));
        }
        
        return allQueries;
    };
}

export class FunctionData {
    functions: Array<string>;
    eventColors: Map<string, number[]>;
    colToEvent: Map<number[], string>;

    constructor(functions: string[]) {
        this.functions = functions;
        this.eventColors = new Map<string, number[]>();
        this.colToEvent = new Map<number[], string>();
    }
}

/**
 * TODO have a proper interface for data exchange between frontend and backend 
 * Provide types to function parameters.
 * 
 * The functions we preload might not be the complete set (There are lots of spinlocks...
 * just add these in on demand)
 */
