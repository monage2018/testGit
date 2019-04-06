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
    private gatewayMac: string[];

    constructor(xMin: number, xMax: number, yMin: number, yMax: number, zoom: number, weightMove: boolean) {
        this.xMin = xMin;
        this.xMax = xMax;
        this.yMin = yMin;
        this.yMax = yMax;
        this.zoom = zoom;
        this.weightMove = weightMove;
        this.gatewayMac = [];
    }

    regionLimitCoordiantes(coordinates: number[]): number[] {
        let coor = [...coordinates];
        if(coordinates[0] < this.xMin) {
            coor[0] = this.xMin + this.zoom * (this.xMax - this.xMin);
        }else if(coordinates[0] > this.xMax) {
            coor[0] = this.xMax - this.zoom * (this.xMax - this.xMin);
        }
        if(coordinates[1] < this.yMin) {
            coor[1] = this.yMin + this.zoom * (this.yMax - this.yMin);
        }else if(coordinates[1] > this.yMax) {
            coor[1] = this.yMax - this.zoom * (this.yMax - this.yMin);
        }
        return coor;
    }

    addGateway(gatewayMac: string){
        this.gatewayMac.push(gatewayMac);
    }

    getGateway(){
        return this.gatewayMac;
    }
}
