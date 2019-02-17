import Constants from "./Constants";
import assert from "assert";
import {StrippedPatternShape} from "./shapes";
import {isNullPattern} from "./Utils";

export default class ShapeMath {
    shapes: StrippedPatternShape[];

    distanceMap = new Map<number, Map<number, number>>();
    descendentShapesMap = new Map<number, Set<number>>();
    indexedShapes = new Map<number, StrippedPatternShape>();
    lengthsById = new Map<number, number>();
    orderMap = new Map<number, number>();

    constructor(shapes: StrippedPatternShape[]) {
        this.shapes = [...shapes];
        for (let index = 0; index < shapes.length; index++) {
            const shape = shapes[index];
            this.indexedShapes.set(shape.id, shape);
            this.orderMap.set(shape.id, index);
        }

        this.computeAllLengths();
        this.computeDistance();
        this.computeDescendentShapesMap();
        // this.verify(); // Run verification when we make substantial changes
    }

    distance(patternId1: number, patternId2: number): number {
        return this.distanceMap.get(patternId1).get(patternId2);
    }

    compare(patternId1: number, patternId2: number): number {
        const index1 = this.orderMap.get(patternId1);
        const index2 = this.orderMap.get(patternId2);
        if (index1 < index2) {
            return -1;
        } else if (index1 === index2) {
            return 0;
        } else {
            return 1;
        }
    }

    private computeDescendentShapesMap() {
        const shapes: StrippedPatternShape[] = [...this.shapes];
        shapes.sort((s1, s2) => s1.depth - s2.depth);
        this.descendentShapesMap.set(Constants.NULL_PATTERN_ID, new Set());
        for (const shape of shapes) {
            const descendentShapes = new Set<number>();
            for (const patternId of shape.patternIds) {
                descendentShapes.add(patternId);
                for (const descendentPatternId of this.descendentShapesMap.get(patternId)) {
                    descendentShapes.add(descendentPatternId);
                }
            }
            this.descendentShapesMap.set(shape.id, descendentShapes);
        }
    }

    private computeDistance() {
        const shapes: StrippedPatternShape[] = [...this.shapes];
        shapes.sort((s1, s2) => s1.depth - s2.depth);
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
                    let minDistance = this.distance(patternId1, shape2.patternIds[0]);
                    for (const patternId2 of shape2.patternIds) {
                        minDistance = Math.min(minDistance, this.distance(patternId1, patternId2));
                    }
                    hausdorffDistance = Math.max(hausdorffDistance, minDistance);
                }
                for (const patternId2 of shape2.patternIds) {
                    let minDistance = this.distance(patternId2, shape1.patternIds[0]);
                    for (const patternId1 of shape1.patternIds) {
                        minDistance = Math.min(minDistance, this.distance(patternId2, patternId1));
                    }
                    hausdorffDistance = Math.max(hausdorffDistance, minDistance);
                }
                distance += hausdorffDistance;
                this.distanceMap.get(shape1.id).set(shape2.id, distance);
                this.distanceMap.get(shape2.id).set(shape1.id, distance);
            }
        }
    }

    private getFunctionDistance(functionId1: number, functionId2: number): number {
        if (functionId1 !== functionId2) {
            if (functionId1 === Constants.NULL_FUNCTION_ID
             || functionId2 === Constants.NULL_FUNCTION_ID) {
                return Constants.NULL_FUNCTION_DISTANCE
            } else {
                return Constants.FUNCTION_DISTANCE;
            }
        } else {
            return 0;
        }
    }

    private computeAllLengths() {
        for (const shape of this.shapes) {
            if (isNullPattern(shape.id)) continue;
            this.computeLength(shape.id);
        }
    }

    private computeLength(id: number) {
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

    private verify() {
        this.verifyMetric();
    }

    private verifyMetric() {
        for (const shape of this.shapes) {
            assert.equal(this.distance(shape.id, shape.id), 0,
                "Distance from self is not 0 for shape: " + shape.id.toString());
        }
        for (const shape1 of this.shapes) {
            for (const shape2 of this.shapes) {
                assert.equal(this.distance(shape1.id, shape2.id), this.distance(shape2.id, shape1.id),
                    "Distance not symmetric.")
            }
        }
        for (const shape1 of this.shapes) {
            for (const shape2 of this.shapes) {
                for (const shape3 of this.shapes) {
                    const d12 = this.distance(shape1.id, shape2.id);
                    const d23 = this.distance(shape2.id, shape3.id);
                    const d13 = this.distance(shape1.id, shape3.id);
                    assert.ok(d13 <= d12 + d23,
                        "Distance is not transitive")
                }
            }
        }
    }
}
