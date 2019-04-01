import { ThresholdConfig } from "./locationConfig"

/**
 * @author GaoLixu <lixu.gao@corelink.vip>
 * create time: 2019-03-28 10:10
 * description:
 */

export class Region {
    private xMin: number;
    private xMax: number;
    private yMin: number;
    private yMax: number;
    private zoom: number;
    private weightMove: boolean;

    constructor(xMin: number, xMax: number, yMin: number, yMax: number, zoom: number, weightMove: boolean) {
        this.xMin = xMin;
        this.xMax = xMax;
        this.yMin = yMin;
        this.yMax = yMax;
        this.zoom = zoom;
        this.weightMove = weightMove;
    }

    regionLimitCoordiantes(coordinates: number[]): number[] {
        if(coordinates[0] < this.xMin) {
            coordinates[0] = this.xMin + this.zoom;
        }else if(coordinates[0] > this.xMax) {
            coordinates[0] = this.xMax - this.zoom;
        }
        if(coordinates[1] < this.yMin) {
            coordinates[1] = this.yMin + this.zoom;
        }else if(coordinates[1] > this.yMax) {
            coordinates[1] = this.yMax - this.zoom;
        }
        return coordinates;
    }
}
