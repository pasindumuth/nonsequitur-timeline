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
        }

        console.log('computing metric');
        this.computeAllLengths();
        this.computeDistance();
        this.computeDescendentShapesMap();
        // if (Constants.VERIFY) {
        //     console.log('verify metric');
        //     this.verify();
        // }
        console.log('computing ordering relation');
        this.computeOrderingRelation();
        if (Constants.VERIFY) {
            console.log('verify ordering relation');
            this.verifyOrderingRelation()
        }
    }

    distance(patternId1: number, patternId2: number): number {
        return this.distanceMap.get(patternId1).get(patternId2);
    }

    compare = (patternId1: number, patternId2: number): number => {
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

    private computeOrderingRelation(): void {
        // Ordering relation for patterns, -1, 0, 1 for <, =, > respectively.
        const comparison = new Map<number, Map<number, number>>();
        const compare = (patternId1: number, patternId2: number): number => {
            return comparison.get(patternId1).get(patternId2);
        };
        const shapes: StrippedPatternShape[] = [...this.shapes];
        shapes.sort((s1, s2) => s1.depth - s2.depth);
        for (const shape of shapes) {
            comparison.set(shape.id, new Map());
            comparison.get(shape.id).set(shape.id, 0);
        }
        for (let i1 = 0; i1 < shapes.length; i1++) {
            const shape1 = shapes[i1];
            shape1.patternIds.sort(compare);
            for (let i2 = 0; i2 < i1; i2++) {
                const shape2 = shapes[i2];
                shape2.patternIds.sort(compare);
                let comparedValue = this.compareFunction(shape1.baseFunction, shape2.baseFunction);
                if (comparedValue === 0) {
                    for (let i = 0;; i++) {
                        if (i === shape2.patternIds.length) {
                            comparedValue = 1;
                        } else if (i === shape1.patternIds.length) {
                            comparedValue = -1;
                        } else {
                            const childComparedValue = compare(shape1.patternIds[i], shape2.patternIds[i]);
                            if (childComparedValue === 0) {
                                continue;
                            } else {
                                comparedValue = childComparedValue;
                            }
                        }
                        break;
                    }
                }
                comparison.get(shape1.id).set(shape2.id, comparedValue);
                comparison.get(shape2.id).set(shape1.id, -comparedValue);
            }
        }
        shapes.sort((s1, s2) => comparison.get(s1.id).get(s2.id));
        for (let index = 0; index < shapes.length; index++) {
            this.orderMap.set(shapes[index].id, index);
        }
    }

    private compareFunction(functionId1: number, functionId2: number): number {
        if (functionId1 < functionId2) {
            return -1;
        } else if (functionId1 === functionId2) {
            return 0;
        } else {
            return 1;
        }
    }

    private verifyOrderingRelation() {
        const patternIds = Array.from(this.orderMap.keys());
        patternIds.sort(this.compare);
        for (let patternId of patternIds) {
            if (this.compare(patternId, patternId) !== 0) {
                console.error("Same patterns are equal according to the ordering relation.")
            }
        }
        for (let i1 = 0; i1 < patternIds.length; i1++) {
            for (let i2 = 0; i2 < i1; i2++) {
                if (this.compare(patternIds[i1], patternIds[i2]) !== 1
                    || this.compare(patternIds[i2], patternIds[i1]) !== -1) {
                    console.error("Patterns couldn't be linearized as it should be with the equivalence relation.");
                }
            }
        }
        console.log("Ordering relation verified.");
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
