import {StrippedPatternShape} from "../shared/shapes";
import ShapeMath from "./ShapeMath";

export default class ShapeClusterer {
    shapes: StrippedPatternShape[];

    // Shapes in a cluster all share the same base function, are all within
    // a fixed distance from each other, and are not descendents of one another.
    clusteredShapes = new Array<Cluster>();

    constructor(shapes: StrippedPatternShape[], shapeMath: ShapeMath) {
        this.shapes = shapes;
    }
}

class Cluster {
    baseFunction: number;
    shapeIds: Set<number>;
    descendentShapeIds: Set<number>;
}
