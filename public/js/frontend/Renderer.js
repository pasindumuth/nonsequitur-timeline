"use strict";

var G_EVENT_HEIGHT = 4, //px
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

function byte2Hex (n) {
    var str = n.toString(16);
    return "00".substr(str.length) + str;
}

function rgbToColorHexstring (r,g,b) {
    return '#' + byte2Hex(r) + byte2Hex(g) + byte2Hex(b);
}

function colorHexstringToRgb (hex) {
    var col = [],
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
var createInfopaneElement = function (infopaneContainer, eventName, thread, time, absStartTime, color, zoomToDiv) {
    var div =  document.createElement("div"),
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
    
    Database.getEventStats(thread, eventName, time)
    .then(function (data) {
        var threadText = $(text).html();
        threadText += statsHTML(data.id, data.duration, data.avg, data.stddev);
        $(text).html(threadText);
    })
    .catch(function (err) {
        console.log(err);
        console.log("Bad query params:");
        console.log({
            thread: thread,
            func: eventName,
            time: time
        });
    });
};

/**
 * Panel
 */
var Panel = function (rootDiv, absoluteStartTime, startTime, endTime, width, height, resolution, isCompressed) {
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
};

Panel.prototype.renderTimeAxis = function () {
    if (!this.resolution) {
        return;
    }
    
    var ctx = this.timebar.getContext("2d"),
        xToTime = d3.scale.linear()
                    .domain([0, this.timebar.width])
                    .range([this.startTime - this.absoluteStartTime, this.endTime - this.absoluteStartTime]),
        
        // We want the timespan to be log-related to the resolution of the viz
        resolutionNearestFactorOf10 = Math.pow(10, Math.ceil(Math.log10(this.resolution))),
        timespan = resolutionNearestFactorOf10 * G_TIMEBAR_TIMESPAN_FACTOR,
        // Start the tick at the first timespan multiple
        startTime = (Math.floor((this.startTime - this.absoluteStartTime) / timespan)) * timespan,
        x = (startTime - (this.startTime - this.absoluteStartTime)) * this.timeToPixelFactor;
        
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

Panel.prototype.renderEvent = function (metadata, eventObj, eventColors, threadOffsets) {
    var eventType,
        eventWidth,
        x_start,
        x_end,
        y,
        event_startTime = eventObj.startTime,
        event_endTime = eventObj.endTime,
        // HACK:
        // From textfiles, our strings are normalized and need to be
        // translated via LUT.
        // From db, our strings are not normalized and need to be left as is
        event_lockName = eventObj.denormalized ? eventObj.lockName : metadata.locknames[eventObj.lockName],
        event_functionName = eventObj.denormalized ? eventObj.functionName : metadata.functions[eventObj.functionName],
        eventColor,
        context;
    if (eventObj.startTime > this.endTime || eventObj.endTime < this.startTime) {
        return;
    }
    eventType = event_functionName + (event_lockName ? ":::" + event_lockName : "");
    eventColor = eventColors[eventType];
    if (eventColor === undefined) {
        console.log("Bad eventType: " + eventType);
        console.log("Bad event object: " + eventObj);
    }
    if (this.isCompressed) {
        x_start = 0;
        eventWidth = this.canvas.width;
    } else {
        event_endTime = Math.min(event_endTime, this.endTime);
        event_startTime = Math.max(event_startTime, this.startTime);
        x_start = Math.floor((event_startTime - this.startTime) * this.timeToPixelFactor);
        x_end = Math.ceil((event_endTime - this.startTime) * this.timeToPixelFactor);
        eventWidth = x_end - x_start;
    }

    y = threadOffsets[eventObj.threadName] - ((eventObj.stackDepth + 1) * G_EVENT_HEIGHT);

    if (eventWidth !== 0) {
        context = this.canvas.getContext("2d");
        context.beginPath();
        context.rect(x_start, y, eventWidth, G_EVENT_HEIGHT);
        context.fillStyle = eventColor;
        context.fill();
        context.closePath();
    }
};

Panel.prototype.setupMouseEvents = function (hoverinfobar, infopane, inverseThreadOffsets, colToEvent, threadSpacing) {
    var ctx = this.canvas.getContext("2d"),
        timeFactor = this.timeToPixelFactor,
        startTime = this.startTime,
        absStartTime = this.absoluteStartTime,
        idleTimer = null;
    
    function mouseLocationToEventData (canvas, e) {
        var mouseX = e.pageX - canvas.offsetLeft,
            mouseY = e.pageY - canvas.offsetTop,
            time = (mouseX / timeFactor) + startTime,
            threadOffset = Math.floor(mouseY / threadSpacing),
            color = ctx.getImageData(mouseX, mouseY, 1, 1).data,
            threadHexColor = rgbToColorHexstring(color[0], color[1], color[2]),
            eventName = colToEvent[threadHexColor] || "",
            thread = inverseThreadOffsets[threadOffset],
            info = eventName.split(":::");
            
            return {
                thread: thread,
                time: time,
                eventName: eventName,
                color: threadHexColor,
                func: info[0],
                lock: info[1]
            };
    }
    
    $(this.canvas).on("mousemove", function (e) {
        var edata = mouseLocationToEventData(this, e),
            infobarHexColor = edata.color === "#000000" ? "#FFFFFF" : edata.color,
            threadText = infoHTML(edata.thread, edata.eventName, Math.floor(edata.time), Math.floor(edata.time - absStartTime));
        
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
            idleTimer = setTimeout(function () {
                Database.getEventStats(edata.thread, edata.func, edata.time)
                .then(function (data) {
                    threadText += statsHTML(data.id, data.duration, data.avg, data.stddev);
                    $(hoverinfobar).html(threadText);
                });
            }, G_PANEL_MOUSE_HOVER_IDLE_TIME);
        }
    });
    
    $(this.canvas).on("mouseout", function () {
        $(hoverinfobar).hide();
        clearTimeout(idleTimer);
    });
    
    $(this.canvas).on("mouseup", function (e) {
        var edata = mouseLocationToEventData(this, e);
            
        if (edata.eventName) {
            createInfopaneElement(infopane, edata.eventName, edata.thread, edata.time, absStartTime, edata.color, this);
        }
    });
};


/**
 * Layer
 */
var Layer = function (rootDiv, width, height, absoluteStartTime) {
    this.COMPRESSED_VIZ_WIDTH = 50; // px
    this.widthAvailable = width - G_HOSTBAR_WIDTH;
    this.height = height;
    this.panels = [];
    this.absoluteStartTime = absoluteStartTime;
    
    this.div = document.createElement('div');
    this.div.className = "rendererLayer";

    this.hostbar = document.createElement('canvas');
    this.hostbar.width = G_HOSTBAR_WIDTH;
    this.hostbar.height = height + G_PANEL_TIMEBAR_HEIGHT;
    this.hostbar.className = "rendererLayerHostbar";
    this.div.appendChild(this.hostbar);
    rootDiv.append(this.div);
};

Layer.prototype.generateViz = function (startTime, endTime, resolution) {
    if (this.widthAvailable <= 0) {
        return startTime;
    }
    var width,
        elapsedTime = this.widthAvailable * resolution;
    endTime = Math.min(endTime, startTime + elapsedTime);
    width = Math.ceil((endTime - startTime) / resolution);
    this.widthAvailable -= width;
    this.panels.push(new Panel(this.div, this.absoluteStartTime, startTime, endTime, width, this.height, resolution, false));
    return endTime;
};

Layer.prototype.generateCompressedViz = function (startTime, endTime) {
    if (this.widthAvailable < this.COMPRESSED_VIZ_WIDTH) {
        return startTime;
    }
    this.panels.push(new Panel(this.div, this.absoluteStartTime, startTime, endTime, this.COMPRESSED_VIZ_WIDTH, this.height, 0, true));
    this.widthAvailable -= this.COMPRESSED_VIZ_WIDTH;
    return endTime;
};

Layer.prototype.renderHostbar = function (metadata, threadOffsets) {
    var i,
        hostbarContext = this.hostbar.getContext("2d");
        hostbarContext.textAlign = "end";
        hostbarContext.font = G_THREAD_PANEL_FONT_SIZE + "px Sans-serif";
    for (i = 0; i < metadata.threads.length; i++) {
        hostbarContext.fillText("T" + String(metadata.threads[i]),
            G_HOSTBAR_WIDTH - G_HOSTBAR_TEXT_PADDING,
            threadOffsets[metadata.threads[i]] - G_THREAD_PANEL_FONT_SIZE);
    }
};

Layer.prototype.startTime = function () {
    if (!this.panels) {
        return 0;
    }
    return this.panels[0].startTime;
};

Layer.prototype.endTime = function () {
    if (!this.panels) {
        return 0;
    }
    return this.panels[this.panels.length - 1].endTime;
};



/**
 * Renderer
 */
var Renderer = function (rootDiv) {
    this.rootDiv = rootDiv;
    
    this.renderDiv = document.createElement('div');
    this.renderDiv.className = "rendererRoot";
    
    this.hoverinfobar = document.createElement('div');
    this.hoverinfobar.className = "rendererHoverinfobar";
    this.renderDiv.appendChild(this.hoverinfobar);
    
    this.infopane = document.createElement('div');
    this.infopane.className = "infopaneContainer";
    this.renderDiv.appendChild(this.infopane);
    
    rootDiv.appendChild(this.renderDiv);
};

Renderer.prototype.renderMetadata = function (metadata, compressedMetadata) {
    var i;
    compressedMetadata = compressedMetadata || [];
    this.rootDivWidth = window.getComputedStyle(this.rootDiv).width; // save to prevent resizing issues
    this.vizMaxWidth = parseInt(this.rootDivWidth, 10) - G_HOSTBAR_WIDTH;
    
    this.renderMetadata_generateLayers(metadata, compressedMetadata[1] || []);
    this.renderMetadata_generateEventColors(metadata);
    this.renderMetadata_generateThreadOffsets(metadata);
    for (i = 0; i < this.layers.length; i++) {
        this.layers[i].renderHostbar(metadata, this.threadOffsets);
    }
    this.renderMetadata_generateMouseListeners(metadata, this.inverseThreadOffsets, this.colToEvent);
};

Renderer.prototype.renderMetadata_generateLayers = function (metadata, compressedRegions) {
    var resolution = metadata.minElapsedTime, // time per pixel
        vizHeight = (((metadata.maxStackDepth * G_EVENT_HEIGHT) + G_THREAD_PADDING) * metadata.threads.length),
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

Renderer.prototype.renderMetadata_generateEventColors = function (metadata) {
    var i, eventColor, rgbEventColor,
        colOffset = 0,
        c20 = d3.scale.category20(i),
        eventsList = metadata.events.sort();
    this.eventColors = [];
    this.colToEvent = [];
    for (i = 0; i < eventsList.length; i++) {
		if (i % 20 === 0) {
            colOffset++;
		}
		if (colOffset === 0) {
			eventColor = c20(i);
		} else {
			rgbEventColor = colorHexstringToRgb(c20(i));
			eventColor = rgbToColorHexstring(rgbEventColor[0] - colOffset, rgbEventColor[1] - colOffset, rgbEventColor[2] - colOffset);
		}

		this.eventColors[eventsList[i]] = eventColor;
		this.colToEvent[eventColor] = eventsList[i];		
    }
};

Renderer.prototype.renderMetadata_generateThreadOffsets = function (metadata) {
    var i;
    this.threadOffsets = [];
    this.inverseThreadOffsets = [];
    for (i = 0; i < metadata.threads.length; i++) {
        this.threadOffsets[metadata.threads[i]] = ((metadata.maxStackDepth * G_EVENT_HEIGHT) + G_THREAD_PADDING) * (i + 1);
		this.inverseThreadOffsets[i] = metadata.threads[i];
    }
};

Renderer.prototype.renderMetadata_generateMouseListeners = function (metadata, inverseThreadOffsets, colToEvent) {
    var i, j, threadSpacing;
    threadSpacing = (metadata.maxStackDepth * G_EVENT_HEIGHT) + G_THREAD_PADDING;
    for (i = 0; i < this.layers.length; i++) {
        for (j = 0; j < this.layers[i].panels.length; j++) {
            this.layers[i].panels[j].setupMouseEvents(this.hoverinfobar, this.infopane, inverseThreadOffsets, colToEvent, threadSpacing);
        }
    }
};

Renderer.prototype.renderEvent = function (metadata, eventObj) {
    var i, j;
    for (i = 0; i < this.layers.length; i++) {
        for (j = 0; j < this.layers[i].panels.length; j++) {
            this.layers[i].panels[j].renderEvent(
                metadata, eventObj, this.eventColors, this.threadOffsets);
        }
    }
};

/**
 * getQueryObjects
 * Creates a list of queries for all viz elements.
 * Each query batches a number of viz elements, as defined by NVIZ_PER_QUERY_BATCH
 * @return array of query objects
 */
Renderer.prototype.getQueryObjects = function() {
    var i, j,
        startTime, endTime,
        allQueries = [];
    
    for (i = 0; i < this.layers.length; i += G_NLAYERS_PER_QUERY_BATCH) {
        j = Math.min( i + G_NLAYERS_PER_QUERY_BATCH - 1, this.layers.length - 1);
        startTime = this.layers[i].startTime();
        endTime = this.layers[j].endTime();
        allQueries.push(QueryConstructor.queryTime(startTime, endTime));
    }
    
    return allQueries;
};
