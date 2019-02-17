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
    groupedClusteredShapes = new Array<GroupedCluster>();

    constructor(shapes: StrippedPatternShape[], shapeMath: ShapeMath) {
        this.shapes = [...shapes];
        this.shapeMath = shapeMath;
        this.computeClusters();
        this.computeGroupedClusters();
    }

    printClusters() {
        console.log('clustering finished');
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
            }
        }
        console.log('trivial cluster count: ' + (this.clusteredShapes.length - nonTrivialClusterCount));
        console.log('non trivial cluster count: ' + nonTrivialClusterCount);
        console.log('grouped clusters count: ' + this.groupedClusteredShapes.length);
        for (let index = 0; index < this.groupedClusteredShapes.length; index++) {
            const groupedClusteredShape = this.groupedClusteredShapes[index];
            const allShapeIds = new Array<number>();
            for (const cluster of groupedClusteredShape.clusters) {
                allShapeIds.push(...cluster.shapeIds);
            }
            console.log('group index: ' + index + ', clusters in group: ' + groupedClusteredShape.clusters.length);
            console.log(allShapeIds);
            console.log('==============================')
        }
    }

    private computeGroupedClusters() {
        this.clusteredShapes.sort((c1, c2) => c2.depth - c1.depth);
        for (const cluster of this.clusteredShapes) {
            let index;
            for (index = 0; index < this.groupedClusteredShapes.length; index++) {
                const groupedCluster = this.groupedClusteredShapes[index];
                if (this.fallsInGroupedCluster(groupedCluster, cluster)) {
                    this.mergeCluster(groupedCluster, cluster);
                    break;
                }
            }
            if (index === this.groupedClusteredShapes.length) {
                // Cluster wasn't merged into any existing grouped cluster.
                const groupedCluster: GroupedCluster = {
                    allShapeIds: new Set(),
                    allDescendentShapeIds: new Set(),
                    clusters: [],
                };
                this.mergeCluster(groupedCluster, cluster);
                this.groupedClusteredShapes.push(groupedCluster);
            }
        }
    }

    private mergeCluster(groupedCluster: GroupedCluster, cluster: Cluster) {
        for (const shapeId of cluster.shapeIds) {
            groupedCluster.allShapeIds.add(shapeId);
        }
        for (const descendentShapeId of cluster.descendentShapeIds) {
            groupedCluster.allDescendentShapeIds.add(descendentShapeId);
        }
        groupedCluster.clusters.push(cluster);
    }

    private fallsInGroupedCluster(groupedCluster: GroupedCluster, cluster: Cluster) {
        for (const clusterShapeId of cluster.shapeIds) {
            if (groupedCluster.allDescendentShapeIds.has(clusterShapeId)) {
                return false;
            }
        }
        for (const groupedClusterShapeId of groupedCluster.allShapeIds) {
            if (cluster.descendentShapeIds.has(groupedClusterShapeId)) {
                return false;
            }
        }
        return true;
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
                    depth: shape.depth,
                    shapeIds: new Set(),
                    descendentShapeIds: new Set(),
                };
                this.mergeShape(cluster, shape);
                this.clusteredShapes.push(cluster);
            }
        }
    }

    private mergeShape(cluster: Cluster, newShape: StrippedPatternShape) {
        cluster.depth = Math.max(cluster.depth, newShape.depth);
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
    baseFunction: number;
    depth: number;
    shapeIds: Set<number>;
    descendentShapeIds: Set<number>;
}

class GroupedCluster {
    allShapeIds: Set<number>;
    allDescendentShapeIds: Set<number>;
    clusters: Cluster[];
}
