import Constants from './Constants';
import {ShapeCluster, StrippedPatternShape} from '../shared/shapes';
import {e, isNullPattern} from '../shared/Utils';
import FunctionData from './FunctionData';
import $ from 'jquery';
import ShapeMath from '../shared/ShapeMath';

export default class ShapeRenderer {
    shapes: StrippedPatternShape[];
    shapeMath: ShapeMath;
    functionData: FunctionData;
    clusters: ShapeCluster[];

    infoBox: HTMLDivElement;

    renderedShapesAll = new Map<number, Node>();
    renderedShapesFilter = new Map<number, Node>();

    constructor(shapes: StrippedPatternShape[], shapeMath: ShapeMath, functionData: FunctionData, clusters: ShapeCluster[]) {
        this.shapes = [...shapes];
        this.shapeMath = shapeMath;
        this.functionData = functionData;
        this.clusters = clusters;
        this.infoBox = <HTMLDivElement>document.getElementsByClassName('general-info-box')[0];
        window.addEventListener('mousemove', () => {
            $(this.infoBox).css({
                'visibility': 'hidden'
            });
        }, true);

        this.renderShapesForPage();
    }

    renderAll() {
        const allContainer = document.getElementsByClassName('all-pattern-shape-container')[0];
        for (const renderedShape of this.renderedShapesAll.values()) {
            allContainer.appendChild(renderedShape);
        }
    }

    setupDistanceFiltering() {
        const patternIdInput = <HTMLInputElement>document.getElementsByClassName('filtered-pattern-search-id')[0];
        const distanceInput = <HTMLInputElement>document.getElementsByClassName('filtered-pattern-search-distance')[0];
        const submitButton = <HTMLButtonElement>document.getElementsByClassName('filtered-pattern-search-submit')[0];
        submitButton.addEventListener('click', () => {
            const patternId = parseInt(patternIdInput.value);
            const distance = parseFloat(distanceInput.value);
            const patternIds = new Array<number>();
            if (this.exists(patternId) && !isNaN(distance)) {
                for (const shape of this.shapes) {
                    if (this.shapeMath.distance(patternId, shape.id) <= distance
                     && this.renderedShapesFilter.has(shape.id)) {
                        patternIds.push(shape.id);
                    }
                }
                this.showRenderedShapes(patternIds);
            }
        });
    }

    setupDistanceLabel() {
        const input1 = <HTMLInputElement>document.getElementsByClassName('filtered-pattern-distance-search-pattern-1')[0];
        const input2 = <HTMLInputElement>document.getElementsByClassName('filtered-pattern-distance-search-pattern-2')[0];
        const distanceContainer = <HTMLDivElement>document.getElementsByClassName('filtered-pattern-distance')[0];
        const submitButton = <HTMLButtonElement>document.getElementsByClassName('filtered-pattern-distance-search-submit')[0];
        submitButton.addEventListener('click', () => {
            const patternId1 = parseInt(input1.value);
            const patternId2 = parseInt(input2.value);
            if (this.exists(patternId1) && this.exists(patternId2)) {
                const distance = e('div', [], this.shapeMath.distance(patternId1, patternId2).toString());
                $(distanceContainer).empty();
                distanceContainer.appendChild(distance);
            }
        });
    }

    setClusterDisplaying() {
        const idInput = <HTMLInputElement>document.getElementsByClassName('filtered-pattern-cluster-search-id')[0];
        const submitButton = <HTMLButtonElement>document.getElementsByClassName('filtered-pattern-cluster-search')[0];
        submitButton.addEventListener('click', () => {
            const id = parseInt(idInput.value);
            if (id === -1) {
                // Show all clusters
                const filteredContainer = <HTMLDivElement>document.getElementsByClassName('filtered-pattern-search-results-container')[0];
                $(filteredContainer).empty();
                for (let i = 0; i < this.clusters.length; i++) {
                    const cluster = this.clusters[i];
                    const patternIds = [...cluster.shapeIds];
                    const container = document.createElement('div');
                    for (const patternId of patternIds) {
                        const rendererShape = this.renderedShapesFilter.get(patternId);
                        if (rendererShape) {
                            container.appendChild(rendererShape);
                        }
                    }
                    $(container).addClass('cluster-container');
                    filteredContainer.appendChild(container);
                }
            } else if (!isNaN(id) && 0 <= id && id < this.clusters.length) {
                const cluster = this.clusters[id];
                const patternIds = [...cluster.shapeIds];
                this.showRenderedShapes(patternIds);
            }
        });
    }

    showRenderedShapes(patternIds: Array<number>): HTMLDivElement {
        const filteredContainer = <HTMLDivElement>document.getElementsByClassName('filtered-pattern-search-results-container')[0];
        return this.showRenderedShapesInDiv(patternIds, filteredContainer);
    }

    showRenderedShapesInDiv(patternIds: Array<number>, outerContainer: HTMLDivElement): HTMLDivElement {
        const container = document.createElement('div');
        for (const patternId of patternIds) {
            if (this.renderedShapesFilter.has(patternId)) {
                container.appendChild(this.renderedShapesFilter.get(patternId));
            } else {
                const text = e('div', ['scrollable-box'], JSON.stringify(this.shapeMath.indexedShapes.get(patternId)));
                container.appendChild(text);
            }
        }
        $(outerContainer).empty();
        outerContainer.appendChild(container);
        return container;
    }

    private renderShapesForPage() {
        this.renderedShapesAll = this.renderShapes();
        this.renderedShapesFilter = this.renderShapes();
    }

    private renderShapes(): Map<number, Node> {
        const renderedShapes = new Map<number, Node>();
        for (const shape of this.shapes) {
            if (isNullPattern(shape.id)) continue;
            const length = this.shapeMath.lengthsById.get(shape.id);
            if (length < 5000) {
                const shapeContainer = e('div', ['pattern-shape-container']);
                shapeContainer.appendChild(e('div', ['pattern-shape-label'], shape.id.toString()));
                shapeContainer.appendChild(this.renderShape(shape));
                renderedShapes.set(shape.id, shapeContainer);
            }
        }
        return renderedShapes;
    }

    private renderShape(shape: StrippedPatternShape): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        const length = this.shapeMath.lengthsById.get(shape.id);
        const depth = shape.depth;
        const width = length * Constants.PATTERN_VIS_PX_PER_UNIT + 2 * Constants.PATTERN_VIS_PADDING;
        const height = depth * Constants.PATTERN_VIS_PX_PER_UNIT + 2 * Constants.PATTERN_VIS_PADDING;
        canvas.width = width;
        canvas.height = height;
        // Fix CSS width so canvas doesn't resize.
        canvas.style.setProperty('width', (width / 2).toString() + 'px');
        canvas.style.setProperty('height', (height / 2).toString() + 'px');
        this.renderShapeOnCanvas(
            canvas,
            Constants.PATTERN_VIS_PADDING,
            depth * Constants.PATTERN_VIS_PX_PER_UNIT + Constants.PATTERN_VIS_PADDING,
            shape);
        return canvas;
    }

    private renderShapeOnCanvas(canvas: HTMLCanvasElement, x: number, y: number, shape: StrippedPatternShape) {
        const length = this.shapeMath.lengthsById.get(shape.id) * Constants.PATTERN_VIS_PX_PER_UNIT;
        y -= Constants.PATTERN_VIS_PX_PER_UNIT;
        this.addRenderedShapeEventLister(canvas, x, y, length, shape);
        const context = canvas.getContext('2d');
        context.fillStyle = this.functionData.functionIdToColor.get(shape.baseFunction);
        context.fillRect(x, y, length, Constants.PATTERN_VIS_PX_PER_UNIT);
        x += Constants.PATTERN_VIS_PX_PER_UNIT;
        for (const childShapeId of shape.patternIds) {
            if (isNullPattern(childShapeId)) continue;
            const childShape = this.shapeMath.indexedShapes.get(childShapeId);
            this.renderShapeOnCanvas(canvas, x, y, childShape);
            x += (this.shapeMath.lengthsById.get(childShapeId) + 1) * Constants.PATTERN_VIS_PX_PER_UNIT;
        }
    }

    private addRenderedShapeEventLister(canvas: HTMLCanvasElement, x: number, y: number, length: number, shape: StrippedPatternShape) {
        const cssX = x / 2;
        const cssY = y / 2;
        const cssLength = length / 2;
        const cssHeight = Constants.PATTERN_VIS_PX_PER_UNIT / 2;
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const coordX = e.clientX - rect.left;
            const coordY = e.clientY - rect.top;
            if (cssX <= coordX && coordX < cssX + cssLength
             && cssY <= coordY && coordY < cssY + cssHeight) {
                const borderColor = this.functionData.functionIdToColor.get(shape.baseFunction);
                $(this.infoBox)
                    .html(`
                    <div class='general-info-box-contents'>
                        <div>${shape.id}</div>
                        <div>${shape.baseFunction}</div>
                    </div>
                    `)
                    .css({
                        'visibility': 'visible',
                        'left': e.clientX + 40,
                        'top': e.clientY + 2,
                        'border-color': borderColor
                    });
            }
        });
    }

    private exists(patternId) {
        return this.shapeMath.indexedShapes.has(patternId);
    }
}
