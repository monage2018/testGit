/**
 * @author GaoLixu <lixu.gao@corelink.vip>
 * create time: 2019-03-28 10:10
 * description:
 */

export class Gateway {
    mac: string;
    name: string;
    coordinates: number[];
    mode: number;
    region: number;
    A: number;
    n: number;

    constructor(mac: string, name: string, coordinates: number[], mode: number, 
                region: number, A: number = 62, n: number = 2.5) {
        this.mac = mac;
        this.name = name;
        this.coordinates = coordinates;
        this.mode = mode;
        this.region = region;
        this.A = A;
        this.n = n;
    }
}
