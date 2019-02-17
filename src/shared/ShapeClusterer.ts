import Constants from "./Constants";
import {StrippedPatternShape} from "./shapes";
import ShapeMath from "./ShapeMath";
import {isNullPattern} from "./Utils";

export default class ShapeClusterer {
    shapes: StrippedPatternShape[];
    shapeMath: ShapeMath;

    // Shapes in a cluster all share the same base function, are all within
    // a fixed distance from each other, and are not descendents of one another.
    clusteredShapes = new Array<Cluster>();

    constructor(shapes: StrippedPatternShape[], shapeMath: ShapeMath) {
        this.shapes = [...shapes];
        this.shapeMath = shapeMath;
        this.computeClusters();
    }

    printClusters() {
        console.log('shapes count: ' + this.shapes.length);
        console.log('clustering finished');
        console.log(this.clusteredShapes.length);
        let nonTrivialClusterCount = 0;
        for (const cluster of this.clusteredShapes) {
            let trivial = true;
            for (const shapeInCluster of cluster.shapeIds) {
                const shape = this.shapeMath.indexedShapes.get(shapeInCluster);
                if (shape.depth > 2) {
                    trivial = false;
                }
            }
            if (!trivial) {
                nonTrivialClusterCount += 1;
                console.log(cluster.shapeIds.size);
            }
        }
        console.log('nonTrivialClusterCount: ' + nonTrivialClusterCount);
    }

    private computeClusters() {
        const shapes: StrippedPatternShape[] = [...this.shapes];
        shapes.sort((s1, s2) => s1.depth - s2.depth);
        for (const shape of shapes) {
            if (isNullPattern(shape.id)) continue;
            let index;
            for (index = 0; index < this.clusteredShapes.length; index++) {
                const cluster = this.clusteredShapes[index];
                if (this.fallsInCluster(cluster, shape)) {
                    this.mergeShape(cluster, shape);
                    break;
                }
            }
            if (index === this.clusteredShapes.length) {
                // Shape wasn't merged into any existing cluster.
                const cluster: Cluster = {
                    baseFunction: shape.baseFunction,
                    shapeIds: new Set(),
                    descendentShapeIds: new Set(),
                };
                this.mergeShape(cluster, shape);
                this.clusteredShapes.push(cluster);
            }
        }
    }

    private mergeShape(cluster: Cluster, newShape: StrippedPatternShape) {
        cluster.shapeIds.add(newShape.id);
        const newShapeDescendents = this.shapeMath.descendentShapesMap.get(newShape.id);
        for (const shapeDescendentId of newShapeDescendents) {
            cluster.descendentShapeIds.add(shapeDescendentId);
        }
    }

    private fallsInCluster(cluster: Cluster, newShape: StrippedPatternShape) {
        // Ensure newShape has the same base function as the cluster.
        if (cluster.baseFunction !== newShape.baseFunction) return false;
        // Ensure newShape is within CLUSTER_DISTANCE to all shapes in the cluster.
        for (const clusterShapeId of cluster.shapeIds) {
            if (this.shapeMath.distance(clusterShapeId, newShape.id) > Constants.CLUSTER_DISTANCE) {
                return false;
            }
        }
        // Ensure newShape isn't a descendent of any shape in the cluster, and vice versa.
        if (cluster.descendentShapeIds.has(newShape.id)) return false;
        const newShapeDescendents = this.shapeMath.descendentShapesMap.get(newShape.id);
        for (const clusterShapeId of cluster.shapeIds) {
            if (newShapeDescendents.has(clusterShapeId)) {
                return false;
            }
        }

        return true;
    }
}

export class Cluster {
    readonly baseFunction: number;
    readonly shapeIds: Set<number>;
    readonly descendentShapeIds: Set<number>;
}
