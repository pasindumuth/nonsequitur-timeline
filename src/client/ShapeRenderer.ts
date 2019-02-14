import Constants from "./Constants";
import {default as SharedConstants} from "../shared/Constants";
import assert from "assert";
import {StrippedPatternShape} from "../shared/shapes";
import {e, isNullPattern} from "../shared/Utils";
import FunctionData from "./FunctionData";
import $ from "jquery";

export default class ShapeRenderer {
    shapes: StrippedPatternShape[];
    functionData: FunctionData;
    infoBox: HTMLDivElement;

    indexedShapes = new Map<number, StrippedPatternShape>();
    lengthsById = new Map<number, number>();
    distanceMap = new Map<number, Map<number, number>>();

    renderedShapesAll = new Map<number, Node>();
    renderedShapesFilter = new Map<number, Node>();

    constructor(shapes: StrippedPatternShape[], functionData: FunctionData) {
        this.shapes = shapes;
        this.functionData = functionData;
        this.infoBox = <HTMLDivElement>document.getElementsByClassName("general-info-box")[0];
        window.addEventListener("mousemove", () => {
            $(this.infoBox).css({
                "visibility": "hidden"
            })
        }, true);

        for (const shape of shapes) {
            this.indexedShapes.set(shape.id, shape);
        }

        this.computeAllLengths();
        this.computeDistance();
        this.renderShapesForPage();
        // this.verify(); // Run verification when we make substantial changes
    }

    renderAll() {
        const allContainer = document.getElementsByClassName("all-pattern-shape-container")[0];
        for (const renderedShape of this.renderedShapesAll.values()) {
            allContainer.appendChild(renderedShape);
        }
    }

    setupClickHandlers() {
        const patternIdInput = <HTMLInputElement>document.getElementsByClassName("filtered-pattern-search-id")[0];
        const distanceInput = <HTMLInputElement>document.getElementsByClassName("filtered-pattern-search-distance")[0];
        const submitButton = <HTMLButtonElement>document.getElementsByClassName("filtered-pattern-search-submit")[0];
        submitButton.addEventListener("click", () => {
            const patternId = parseInt(patternIdInput.value);
            const distance = parseFloat(distanceInput.value);
            const container = document.createElement("div");
            container.appendChild(this.renderedShapesFilter.get(patternId));
            for (const shape of this.shapes) {
                if (this.getDistance(patternId, shape.id) <= distance && this.renderedShapesFilter.has(shape.id)) {
                    container.appendChild(this.renderedShapesFilter.get(shape.id));
                }
            }
            const filteredContainer = <HTMLDivElement>document.getElementsByClassName("filtered-pattern-search-results-container")[0];
            $(filteredContainer).empty();
            filteredContainer.appendChild(container);
        });
    }

    setupDistanceLabel() {
        const input1 = <HTMLInputElement>document.getElementsByClassName("filtered-pattern-distance-search-pattern-1")[0];
        const input2 = <HTMLInputElement>document.getElementsByClassName("filtered-pattern-distance-search-pattern-2")[0];
        const distanceContainer = <HTMLDivElement>document.getElementsByClassName("filtered-pattern-distance")[0];
        const submitButton = <HTMLButtonElement>document.getElementsByClassName("filtered-pattern-distance-search-submit")[0];
        submitButton.addEventListener("click", () => {
            const patternId1 = parseInt(input1.value);
            const patternId2 = parseInt(input2.value);
            if (this.exists(patternId1) && this.exists(patternId2)) {
                const distance = e("label", [], this.getDistance(patternId1, patternId2).toString());
                $(distanceContainer).empty();
                distanceContainer.appendChild(distance);
            }
        });
    }

    renderShapesForPage() {
        this.renderedShapesAll = this.renderShapes();
        this.renderedShapesFilter = this.renderShapes();
    }

    renderShapes(): Map<number, Node> {
        const renderedShapes = new Map<number, Node>();
        for (const shape of this.shapes) {
            if (isNullPattern(shape.id)) continue;
            const length = this.lengthsById.get(shape.id);
            if (length < 5000) {
                const shapeContainer = e('div', ['pattern-shape-container']);
                shapeContainer.appendChild(e('h1', ['pattern-shape-label'], shape.id.toString()));
                shapeContainer.appendChild(this.renderShape(shape));
                renderedShapes.set(shape.id, shapeContainer);
            }
        }
        return renderedShapes;
    }

    renderShape(shape: StrippedPatternShape): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        const length = this.lengthsById.get(shape.id);
        const depth = shape.depth;
        const width = length * Constants.PATTERN_VIS_PX_PER_UNIT + 2 * Constants.PATTERN_VIS_PADDING;
        const height = depth * Constants.PATTERN_VIS_PX_PER_UNIT + 2 * Constants.PATTERN_VIS_PADDING;
        canvas.width = width;
        canvas.height = height;
        // Fix CSS width so canvas doesn't resize.
        canvas.style.setProperty("width", (width / 2).toString() + "px");
        canvas.style.setProperty("height", (height / 2).toString() + "px");
        this.renderShapeOnCanvas(
            canvas,
            Constants.PATTERN_VIS_PADDING,
            depth * Constants.PATTERN_VIS_PX_PER_UNIT + Constants.PATTERN_VIS_PADDING,
            shape);
        return canvas;
    }

    renderShapeOnCanvas(canvas: HTMLCanvasElement, x: number, y: number, shape: StrippedPatternShape) {
        const length = this.lengthsById.get(shape.id) * Constants.PATTERN_VIS_PX_PER_UNIT;
        y -= Constants.PATTERN_VIS_PX_PER_UNIT;
        this.addRenderedShapeEventLister(canvas, x, y, length, shape);
        const context = canvas.getContext("2d");
        context.fillStyle = this.functionData.functionIdToColor.get(shape.baseFunction);
        context.fillRect(x, y, length, Constants.PATTERN_VIS_PX_PER_UNIT);
        x += Constants.PATTERN_VIS_PX_PER_UNIT;
        for (const childShapeId of shape.patternIds) {
            if (isNullPattern(childShapeId)) continue;
            const childShape = this.indexedShapes.get(childShapeId);
            this.renderShapeOnCanvas(canvas, x, y, childShape);
            x += (this.lengthsById.get(childShapeId) + 1) * Constants.PATTERN_VIS_PX_PER_UNIT;
        }
    }

    addRenderedShapeEventLister(canvas: HTMLCanvasElement, x: number, y: number, length: number, shape: StrippedPatternShape) {
        const cssX = x / 2;
        const cssY = y / 2;
        const cssLength = length / 2;
        const cssHeight = Constants.PATTERN_VIS_PX_PER_UNIT / 2;
        canvas.addEventListener("mousemove", (e) => {
            const rect = canvas.getBoundingClientRect();
            const coordX = e.clientX - rect.left;
            const coordY = e.clientY - rect.top;
            if (cssX <= coordX && coordX < cssX + cssLength
             && cssY <= coordY && coordY < cssY + cssHeight) {
                const borderColor = this.functionData.functionIdToColor.get(shape.baseFunction);
                $(this.infoBox)
                    .html(`
                    <div class="general-info-box-contents">
                        <div>${shape.id}</div>
                        <div>${shape.baseFunction}</div>
                    </div>
                    `)
                    .css({
                        "visibility": "visible",
                        "left": e.clientX + 40,
                        "top": e.clientY + 2,
                        "border-color": borderColor
                    });
            }
        });
    }

    computeAllLengths() {
        for (const shape of this.shapes) {
            if (isNullPattern(shape.id)) continue;
            this.computeLength(shape.id);
        }
    }

    computeLength(id: number) {
        assert.ok(!isNullPattern(id), "Computing length of null pattern");
        if (!this.lengthsById.has(id)) {
            const shape = this.indexedShapes.get(id);
            const numNonNullPatterns = shape.patternIds.length - 1;
            let length = numNonNullPatterns + 1;
            for (const childShapeId of shape.patternIds) {
                if (isNullPattern(childShapeId)) continue;
                length += this.computeLength(childShapeId);
            }
            this.lengthsById.set(id, length);
        }
        return this.lengthsById.get(id);
    }

    computeDistance() {
        const shapes: StrippedPatternShape[] = [...this.shapes];
        shapes.sort((s1, s2) => {return s1.depth - s2.depth; });
        for (const shape of shapes) {
            this.distanceMap.set(shape.id, new Map());
            this.distanceMap.get(shape.id).set(shape.id, 0);
        }
        for (let i1 = 0; i1 < shapes.length; i1++) {
            const shape1 = shapes[i1];
            for (let i2 = 0; i2 < i1; i2++) {
                const shape2 = shapes[i2];
                let distance = this.getFunctionDistance(shape1.baseFunction, shape2.baseFunction);
                let hausdorffDistance = 0;
                for (const patternId1 of shape1.patternIds) {
                    let minDistance = this.getDistance(patternId1, shape2.patternIds[0]);
                    for (const patternId2 of shape2.patternIds) {
                        minDistance = Math.min(minDistance, this.getDistance(patternId1, patternId2));
                    }
                    hausdorffDistance = Math.max(hausdorffDistance, minDistance);
                }
                for (const patternId2 of shape2.patternIds) {
                    let minDistance = this.getDistance(patternId2, shape1.patternIds[0]);
                    for (const patternId1 of shape1.patternIds) {
                        minDistance = Math.min(minDistance, this.getDistance(patternId2, patternId1));
                    }
                    hausdorffDistance = Math.max(hausdorffDistance, minDistance);
                }
                distance += hausdorffDistance;
                this.distanceMap.get(shape1.id).set(shape2.id, distance);
                this.distanceMap.get(shape2.id).set(shape1.id, distance);
            }
        }
    }

    getFunctionDistance(functionId1: number, functionId2: number): number {
        if (functionId1 !== functionId2) {
            if (functionId1 === SharedConstants.NULL_FUNCTION_ID
             || functionId2 === SharedConstants.NULL_FUNCTION_ID) {
                return SharedConstants.NULL_FUNCTION_DISTANCE
            } else {
                return SharedConstants.FUNCTION_DISTANCE;
            }
        } else {
            return 0;
        }
    }

    getDistance(patternId1: number, patternId2: number) : number {
        return this.distanceMap.get(patternId1).get(patternId2);
    }

    exists(patternId) {
        return this.indexedShapes.has(patternId);
    }

    verify() {
        this.verifyMetric();
    }

    verifyMetric() {
        for (const shape of this.shapes) {
            assert.equal(this.getDistance(shape.id, shape.id), 0,
                "Distance from self is not 0 for shape: " + shape.id.toString());
        }
        for (const shape1 of this.shapes) {
            for (const shape2 of this.shapes) {
                assert.equal(this.getDistance(shape1.id, shape2.id), this.getDistance(shape2.id, shape1.id),
                    "Distance not symmetric.")
            }
        }
        for (const shape1 of this.shapes) {
            for (const shape2 of this.shapes) {
                for (const shape3 of this.shapes) {
                    const d12 = this.getDistance(shape1.id, shape2.id);
                    const d23 = this.getDistance(shape2.id, shape3.id);
                    const d13 = this.getDistance(shape1.id, shape3.id);
                    assert.ok(d13 <= d12 + d23,
                        "Distance is not transitive")
                }
            }
        }
    }
}
