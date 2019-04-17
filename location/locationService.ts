import * as math from "mathjs";
import { RSSIKalmanFilter } from "./kalmanFilter/RSSIKalmanFilter";
import { PVAKalmanFilter } from "./kalmanFilter/PVAKalmanFilter";
import { GatewayConfig, ThresholdConfig, RegionConfig } from "./locationConfig";
import { LossFunction } from "./lossFunction";
import { BFGS } from "./quasiNewton";
import { Region } from "./region";
import { Gateway } from "./gateway";

/**
 * @author GaoLixu <lixu.gao@corelink.vip>
 * create time: 2019-03-28 10:10
 * description:
 */

export class LocationService {
    rssiKalmanFilter: {
        [iBeaconAndGatewayMac: string]: RSSIKalmanFilter,
    };
    pvaKalmanFilter: Object;
    iBeaconInfo: Object;
    regionInfo: Object;
    gatewayInfo: Object;

    constructor() {
        this.rssiKalmanFilter = {};
        this.pvaKalmanFilter = {};
        this.iBeaconInfo = {};
        this.regionInfo = {};
        this.gatewayInfo = {};
        this.addRegion(RegionConfig);
        this.addGateway(GatewayConfig);
        Object.keys(this.gatewayInfo).forEach(mac => {
            this.regionInfo[this.gatewayInfo[mac].region].addGateway(mac);
        })
    }

    locate(iBeaconMac: string, gatewayMac: string[], rssiDataTable: number[][]): number[][] {
        let rawM = rssiDataTable[0].length;
        let rawN = gatewayMac.length;
        if(this.iBeaconInfo[iBeaconMac] === undefined){
            this.iBeaconInfo[iBeaconMac] = {};
        }
        if(this.iBeaconInfo[iBeaconMac].gateways === undefined){
            this.iBeaconInfo[iBeaconMac].gateways = [];
        }else{
            let lastGateways = this.iBeaconInfo[iBeaconMac].gateways.map(x => {
                let g = {};
                Object.keys(x).filter(v => gatewayMac.indexOf(v) === -1).map(v1 => g[v1] = x[v1]);
                return g;
            }).reduce((a, b) => {
                Object.keys(b).forEach(v => a[v] = b[v]);
                return a;
            });
            gatewayMac = gatewayMac.concat(Object.keys(lastGateways));
            Object.keys(lastGateways).forEach(v => {
                let newRssi = [];
                for(let j = 0; j < rawM; j++){
                    newRssi.push(lastGateways[v]);
                }
                rssiDataTable.push(newRssi);
            })
        }

        // console.log("RSSIData: ", rssiDataTable, gatewayMac);
        
        let N = gatewayMac.length; // 网关个数
        let M = rssiDataTable[0].length; // 组数
        let coordinates: number[][] = []; // 各网关位置
        let mode: number[] = []; // 各网关定位模式属性
        let region: number[] = []; // 各网关区域属性
        let A: number[] = []; // 各网关A值
        let n: number[] = []; // 各网关n值
        let macId: string[] = []; // "iBeacon mac 地址" + "&" + "gateway mac 地址“

        // 初始化基本信息
        gatewayMac.forEach((value, i) => {
            coordinates[i] = GatewayConfig[value].coordinates;
            mode[i] = GatewayConfig[value].mode;
            region[i] = GatewayConfig[value].region;
            A[i] = GatewayConfig[value].A;
            n[i] = GatewayConfig[value].n;
            macId[i] = iBeaconMac + '&' + value;
            if (!this.rssiKalmanFilter[macId[i]]) {
                this.rssiKalmanFilter[macId[i]] = new RSSIKalmanFilter(rssiDataTable[i][0]);
            }
        })

        // console.log("base info: ", A, n, region, mode, coordinates)

        // 对RSSI信息进行滤波
        let rssiKF: number[][] = rssiDataTable.map((value, i) => {
            let lastResult: number;
            return value.map((rssi, j) => {
                let result: number = this.rssiKalmanFilter[macId[i]].evaluateXk(rssi);
                if (j > 0 && Math.abs(result - lastResult) > ThresholdConfig.RSSIGRADIENT) {
                    result = lastResult + Math.sign(result - lastResult) * ThresholdConfig.RSSIGRADIENT;
                }
                lastResult = result;
                return result;
            })
        })
        console.log("RSSIData: ", rssiKF, gatewayMac);

        for (let j = 0; j < M; j++) {
            if(j == 79){
                let debug = 1;
            }
            // 不同模式加权平均
            let wd: number[] = A.map((value, i) => {
                return 1. / 10 ** ((value - rssiKF[i][j]) / 25.);
            })
            // let wdSum = eval(wd.join("+"));
            let wdSum = wd.reduce((a, b) => a + b);
            let rssiWd: number[] = wd.map((value, i) => {
                return value / wdSum * rssiKF[i][j];
            });
            let sortRssiWdByRegion = {};
            let sortRegion: number[] = [];
            let maxRssi: number[];
            let sortMode: Object = {
                0: [],
                1: []
            };
            
            for (let i = 0; i < N; i++) {
                // 按照区域分类，id为网关标识，mode为定位模式(同区域定位模式一致),meanRssiWd为区域加权信号值
                if (!sortRssiWdByRegion[region[i]]) {
                    sortRegion.push(region[i]);
                    sortRssiWdByRegion[region[i]] = {
                        id: [i],
                        mode: mode[i],
                        meanRssiWd: rssiWd[i]
                    }
                } else {
                    sortRssiWdByRegion[region[i]].id.push(i);
                    sortRssiWdByRegion[region[i]].meanRssiWd += rssiWd[i];
                }
                // 最大信号值
                let value = rssiDataTable[i][j];
                if (!maxRssi) {
                    maxRssi = [i, value];
                } else if (value > maxRssi[1]) {
                    maxRssi = [i, value];
                }
                // 按照模式分类
                if (mode[i] === 0) {
                    sortMode[0].push(i);
                } else if (mode[i] === 1) {
                    sortMode[1].push(i);
                }
            }
            let minRegionRssiWd: number[];
            for (let i = 0; i < sortRegion.length; i++) {
                let value = sortRssiWdByRegion[sortRegion[i]].meanRssiWd /= sortRssiWdByRegion[sortRegion[i]].id.length;
                if (!minRegionRssiWd) {
                    minRegionRssiWd = [sortRegion[i], value];
                } else if (value < minRegionRssiWd[1]) {
                    minRegionRssiWd = [sortRegion[i], value];
                }
            }

            // console.log("region: ", wd, rssiWd, sortRssiWdByRegion, sortRegion, maxRssi, sortMode, minRegionRssiWd);
            // 当前区域和模式
            let nowRegion = minRegionRssiWd[0]; // 加权信号最强的区域
            let nowMode = sortRssiWdByRegion[nowRegion].mode;
            if (nowMode === 0 && mode[maxRssi[0]] === 0) {
                nowMode = 0;
            } else {
                nowMode = 1;
            }
            if (this.iBeaconInfo[iBeaconMac].realRegion === undefined) {
                this.iBeaconInfo[iBeaconMac].realRegion = [];
            }
            this.iBeaconInfo[iBeaconMac].realRegion.push(nowRegion);

            // 模式切换
            let modeSwitch1d: boolean = false;
            if (this.iBeaconInfo[iBeaconMac].lastMode === undefined) {
                this.iBeaconInfo[iBeaconMac].lastMode = nowMode;
                this.iBeaconInfo[iBeaconMac].modeContinueNum = 0;
            } else if (nowMode !== this.iBeaconInfo[iBeaconMac].lastMode) {
                this.iBeaconInfo[iBeaconMac].modeContinueNum += 1;
                if (this.iBeaconInfo[iBeaconMac].modeContinueNum >= ThresholdConfig.MODESWITCH) {
                    this.iBeaconInfo[iBeaconMac].modeContinueNum = 0;
                    this.iBeaconInfo[iBeaconMac].lastMode = nowMode;
                    // 正在从2d模式切换到1d模式
                    if (nowMode === 0) {
                        modeSwitch1d = true;
                    }
                } else {
                    nowMode = this.iBeaconInfo[iBeaconMac].lastMode;
                }
            } else if (nowMode === this.iBeaconInfo[iBeaconMac].lastMode) {
                this.iBeaconInfo[iBeaconMac].modeContinueNum = 0;
            }
            if (this.iBeaconInfo[iBeaconMac].mode === undefined) {
                this.iBeaconInfo[iBeaconMac].mode = [];
            }
            this.iBeaconInfo[iBeaconMac].mode.push(nowMode);
            // 区域切换
            let regionSwitch: boolean = false;
            if (this.iBeaconInfo[iBeaconMac].lastRegion === undefined) {
                this.iBeaconInfo[iBeaconMac].lastRegion = nowRegion;
                this.iBeaconInfo[iBeaconMac].continueRegionId = nowRegion;
                this.iBeaconInfo[iBeaconMac].regionContinueNum = 0;
            } else if (nowRegion !== this.iBeaconInfo[iBeaconMac].lastRegion) {
                if (this.iBeaconInfo[iBeaconMac].regionContinueNum === 0) {
                    this.iBeaconInfo[iBeaconMac].regionContinueNum += 1;
                } else if (nowRegion !== this.iBeaconInfo[iBeaconMac].continueRegionId) {
                    this.iBeaconInfo[iBeaconMac].continueRegionId = nowRegion;
                    this.iBeaconInfo[iBeaconMac].regionContinueNum = 1;
                } else if (nowRegion === this.iBeaconInfo[iBeaconMac].continueRegionId) {
                    this.iBeaconInfo[iBeaconMac].regionContinueNum += 1;
                }
                // 正在切换区域
                if (this.iBeaconInfo[iBeaconMac].regionContinueNum >= ThresholdConfig.REGIONSWITCH) {
                    this.iBeaconInfo[iBeaconMac].regionContinueNum = 0;
                    regionSwitch = true;
                    console.log("befor delet: ", JSON.stringify(this.iBeaconInfo[iBeaconMac]));

                    // let res = this.regionToRegion([this.iBeaconInfo[iBeaconMac].lastRegion], nowRegion);
                    // console.log(res);

                } else {
                    this.iBeaconInfo[iBeaconMac].continueRegionId = nowRegion;              
                    nowRegion = this.iBeaconInfo[iBeaconMac].lastRegion;           
                }
                this.iBeaconInfo[iBeaconMac].lastRegion = nowRegion;
            } else if (nowRegion === this.iBeaconInfo[iBeaconMac].lastRegion) {
                this.iBeaconInfo[iBeaconMac].regionContinueNum = 0;
            }
            if (this.iBeaconInfo[iBeaconMac].region === undefined) {
                this.iBeaconInfo[iBeaconMac].region = [];
            }
            this.iBeaconInfo[iBeaconMac].region.push(nowRegion);

            // 选定网关，根据距离由近及远排序 
            let gatewayD: number[] = []; // iBeacon到各网关的距离
            for (let i = 0; i < N; i++) {
                gatewayD[i] = 10 ** ((A[i] - rssiKF[i][j]) / 10 / n[i]);
            }
            if (this.iBeaconInfo[iBeaconMac].d === undefined) {
                this.iBeaconInfo[iBeaconMac].d = [];
            }
            this.iBeaconInfo[iBeaconMac].d.push(gatewayMac.reduce((res, mac, i) => {      
                res[mac] = gatewayD[i];
                return res;
            }, {}));
            let gatewayFilter: number[] = [];
            if (nowMode === 0) {
                let gatewayFilterAll: number[] = sortMode[0].sort((a, b) => { return gatewayD[a] - gatewayD[b]; });
                // 1d模式，优先选取信号最强的两个网关进行定位
                if (gatewayFilterAll.length >= 2) {
                    gatewayFilter = gatewayFilterAll.slice(0, 2);
                    // 当本区域其余网关信号强度与选择的两个网关信号强度均值相当时，也予以考虑，参与定位
                    for (let i = 2; i < gatewayFilterAll.length; i++) {
                        if (Math.abs(rssiKF[gatewayFilterAll[i]][j] -
                            (rssiKF[gatewayFilterAll[0]][j] + rssiKF[gatewayFilterAll[1]][j]) / 2) < ThresholdConfig.RSSIGRADIENT) {
                            gatewayFilter.push(gatewayFilterAll[i]);
                        }
                    }
                } else {
                    gatewayFilter = gatewayFilterAll.slice(0);
                }
            } else if (nowMode === 1) {
                gatewayFilter = sortMode[1];
                // 2d模式时，其他区域的网关信号强度比较大时，也予以考虑
                for (let i = 0; i < N; i++) {
                    if (gatewayFilter.indexOf(i) === -1 && rssiKF[i][j] > ThresholdConfig.RSSICHOOSEMORE) {
                        gatewayFilter.push(i);
                    }
                }
                gatewayFilter = gatewayFilter.sort((a, b) => { return gatewayD[a] - gatewayD[b]; });
            }
            if(!gatewayFilter.length){
                gatewayFilter = gatewayD.map((d, i) => { return i; }).sort((a, b) => { return gatewayD[a] - gatewayD[b]; });
            }
            let chooseNum: number = Math.min(ThresholdConfig.GATEWAYLOCATIONNUMBER, gatewayFilter.length);
            let choosePoints: number[][] = [];
            let chooseD: number[] = [];
            let chooseWd: number[] = [];
            let chooseWdSum: number = 0.;
            for (let i = 0; i < chooseNum; i++) {
                choosePoints.push(coordinates[gatewayFilter[i]]);
                chooseD.push(gatewayD[gatewayFilter[i]]);
                chooseWdSum += 1 / chooseD[i];
            }
            chooseWd = chooseD.reduce((result, d) => {
                result.push(1 / d / chooseWdSum);
                return result;
            }, []);
            choosePoints = math.transpose(choosePoints).valueOf();

            // 拟牛顿法求iBeacon坐标
            let lossFunc = new LossFunction(choosePoints, chooseD, chooseWd);
            let x0 = [[1], [1]];
            let result = BFGS(lossFunc.f, lossFunc.gf, x0)[0];
            let sol: number[] = result.pop()[0];

            // 从2d模式切换到1d模式时，如果定位超过基线一定范围，则保留2d模式
            if (modeSwitch1d) {
                let distanceToBaseLine = math.abs(math.det([[choosePoints[0][0] - choosePoints[0][1], sol[0] - choosePoints[0][1]],
                [choosePoints[1][0] - choosePoints[1][1], sol[1] - choosePoints[1][1]]]))
                    / math.norm([choosePoints[0][0] - choosePoints[0][1],
                    choosePoints[1][0] - choosePoints[1][1]]);
                if (distanceToBaseLine > ThresholdConfig.ZEROMODEBASELINERANGE) {
                    nowMode = 1;
                    this.iBeaconInfo[iBeaconMac].lastMode = nowMode;
                    sol = this.iBeaconInfo[iBeaconMac].lastSol;
                }
            }
            this.iBeaconInfo[iBeaconMac].lastSol = sol;
            if (this.iBeaconInfo[iBeaconMac].sol === undefined) {
                this.iBeaconInfo[iBeaconMac].sol = [];
            }
            this.iBeaconInfo[iBeaconMac].sol.push(sol);

            // 位置速度加速度卡尔曼滤波
            if (!this.pvaKalmanFilter[iBeaconMac]) {
                let pva0 = [[sol[0]], [0.8], [0.], [sol[1]], [0.8], [0.]];
                this.pvaKalmanFilter[iBeaconMac] = new PVAKalmanFilter(pva0);
            }
            let pvaSol: number[][] = this.pvaKalmanFilter[iBeaconMac].evaluateXk([[sol[0]], [sol[1]]]);
            if (this.iBeaconInfo[iBeaconMac].pvaSol === undefined) {
                this.iBeaconInfo[iBeaconMac].pvaSol = [];
            }
            this.iBeaconInfo[iBeaconMac].pvaSol.push([pvaSol[0][0], pvaSol[1][0]]);
        }

        // 指数加权滑动平均
        let viewPointReturn: number[][] = [];
        this.ewma(iBeaconMac);
        this.iBeaconInfo[iBeaconMac].ewmaSol.forEach((ewmaSol, k) => {
            if(k === 68){
                let debug = 1;
            }
            // 加权位移
            const ewmaRegion = this.iBeaconInfo[iBeaconMac].region[k];
            const ewmaMode = this.iBeaconInfo[iBeaconMac].mode[k];
            if (this.regionInfo[ewmaRegion].weightMove) {
                let regionGatewayMac = this.regionInfo[ewmaRegion].getGateway()[0];
                let regionGatewayCoor = this.gatewayInfo[regionGatewayMac].coordinates;
                let convD = this.iBeaconInfo[iBeaconMac].d[k][regionGatewayMac];
                let distanceToGateway = Math.sqrt((ewmaSol[0] - regionGatewayCoor[0]) ** 2
                    + (ewmaSol[1] - regionGatewayCoor[1]) ** 2);
                if (convD < distanceToGateway) {
                    ewmaSol.forEach((iteam, index) => {
                        ewmaSol[index] = regionGatewayCoor[index] + convD / distanceToGateway * (iteam - regionGatewayCoor[index]);
                    })
                }
            }
            // 区域限制
            let ewmaSolRegionLimit = this.regionInfo[ewmaRegion].regionLimitCoordiantes(ewmaSol);
            if (this.iBeaconInfo[iBeaconMac].ewmaSolRegionLimit === undefined) {
                this.iBeaconInfo[iBeaconMac].ewmaSolRegionLimit = [];
            }
            this.iBeaconInfo[iBeaconMac].ewmaSolRegionLimit.push(ewmaSolRegionLimit);
            // 步伐限制
            if (this.iBeaconInfo[iBeaconMac].lastView === undefined) {
                this.iBeaconInfo[iBeaconMac].lastView = {
                    point: [ewmaSolRegionLimit[0], ewmaSolRegionLimit[1]],
                    mode: ewmaMode,
                    region: ewmaRegion,
                }
                this.iBeaconInfo[iBeaconMac].viewPoint = [[ewmaSolRegionLimit[0], ewmaSolRegionLimit[1]]];
                // viewPointReturn.push([ewmaSolRegionLimit[0], ewmaSolRegionLimit[1]]);
            }
            let distance = Math.sqrt((ewmaSolRegionLimit[0] - this.iBeaconInfo[iBeaconMac].lastView.point[0]) ** 2
                + (ewmaSolRegionLimit[1] - this.iBeaconInfo[iBeaconMac].lastView.point[1]) ** 2);
            if (distance > ThresholdConfig.FOOTSTEP || ewmaRegion !== this.iBeaconInfo[iBeaconMac].lastView.region) {
                let regionPath = [];
                if(ewmaRegion !== this.iBeaconInfo[iBeaconMac].lastView.region){
                    let res = this.regionToRegion([[this.iBeaconInfo[iBeaconMac].lastView.region]], ewmaRegion);
                    console.log([[this.iBeaconInfo[iBeaconMac].lastView.region]], ewmaRegion);
                    res.reduce((a, b) => {
                        regionPath.push(this.regionInfo[a].gotoCoor[b]);
                        return b;
                    })
                    console.log("region to region: ", res);
                }
                console.log('region path: ', regionPath);

                this.iBeaconInfo[iBeaconMac].lastView = {
                    point: [ewmaSolRegionLimit[0], ewmaSolRegionLimit[1]],
                    mode: ewmaMode,
                    region: ewmaRegion,
                }
                if(regionPath.length){
                    regionPath.forEach(x => {
                        this.iBeaconInfo[iBeaconMac].viewPoint.push(x);
                    })
                }
                this.iBeaconInfo[iBeaconMac].viewPoint.push([ewmaSolRegionLimit[0], ewmaSolRegionLimit[1]]);
                // viewPointReturn.push([ewmaSolRegionLimit[0], ewmaSolRegionLimit[1]]);
                console.log('view point return: ',  this.iBeaconInfo[iBeaconMac].viewPoint);
            }
        });
        console.log("d: ", this.iBeaconInfo[iBeaconMac].d);
        // console.log("befor delet: ", JSON.stringify(this.iBeaconInfo[iBeaconMac]));
        // 清除数据
        this.iBeaconInfo[iBeaconMac].sol = [];
        this.iBeaconInfo[iBeaconMac].pvaSol = [];
        this.iBeaconInfo[iBeaconMac].ewmaSol = [];
        this.iBeaconInfo[iBeaconMac].ewmaSolRegionLimit = [];
        this.iBeaconInfo[iBeaconMac].mode = [];
        this.iBeaconInfo[iBeaconMac].region = [];
        this.iBeaconInfo[iBeaconMac].d = [];
        // console.log("after delet: ", JSON.stringify(this.iBeaconInfo[iBeaconMac]));
        

        // if (!viewPointReturn.length) {
        //     if(this.iBeaconInfo[iBeaconMac].viewPoint.length){
        //         viewPointReturn = [this.iBeaconInfo[iBeaconMac].viewPoint[this.iBeaconInfo[iBeaconMac].viewPoint.length - 1]];
        //     }else {
        //         viewPointReturn = [this.iBeaconInfo[iBeaconMac].pvaSol[this.iBeaconInfo[iBeaconMac].pvaSol.length - 1]];
        //     }
        // }
        if(this.iBeaconInfo[iBeaconMac].viewPoint.length) {
            viewPointReturn = [this.iBeaconInfo[iBeaconMac].viewPoint.shift()];   
        } else if(this.iBeaconInfo[iBeaconMac].lastView.point.length) {
            viewPointReturn = [this.iBeaconInfo[iBeaconMac].lastView.point];
        }
        console.log('view point return length: ', viewPointReturn.length, viewPointReturn,
        this.iBeaconInfo[iBeaconMac].viewPoint, this.iBeaconInfo[iBeaconMac].lastView);



        if(this.iBeaconInfo[iBeaconMac].viewPoint && this.iBeaconInfo[iBeaconMac].viewPoint.length > ThresholdConfig.GROUPSAVENUM){
            this.iBeaconInfo[iBeaconMac].viewPoint = this.iBeaconInfo[iBeaconMac].viewPoint.slice(-ThresholdConfig.GROUPSAVENUM);
        }
        if(rssiDataTable.length){
            let g = {};
            gatewayMac.slice(0, rawN).forEach((mac, i) => g[mac] = rssiDataTable[i].reduce((a, b) => a += b)/rawM);
            this.iBeaconInfo[iBeaconMac].gateways.push(g);
        }
        if(this.iBeaconInfo[iBeaconMac].gateways.length > ThresholdConfig.LASTPOINT){    
            this.iBeaconInfo[iBeaconMac].gateways.shift();
        }
        // console.log("last gateways: ", this.iBeaconInfo[iBeaconMac].gateways);
        // console.log("iBeaconInfo", this.iBeaconInfo, "result", viewPointReturn);
        return viewPointReturn;
    }

    addRegion(regionConfig: Object) {
        for (let region in regionConfig) {
            if (!this.regionInfo[region]) {
                this.regionInfo[region] = new Region(regionConfig[region].xyLimit[0], regionConfig[region].xyLimit[1],
                    regionConfig[region].xyLimit[2], regionConfig[region].xyLimit[3], regionConfig[region].zoom,
                    regionConfig[region].weightMove, regionConfig[region].canGoto, regionConfig[region].gotoCoor);
            }
        }
    }

    addGateway(gatewayConfig: Object) {
        for (let gatewayMac in gatewayConfig) {
            if (!this.gatewayInfo[gatewayMac]) {
                this.gatewayInfo[gatewayMac] = new Gateway(gatewayConfig[gatewayMac].mac, gatewayConfig[gatewayMac].name,
                    gatewayConfig[gatewayMac].coordinates, gatewayConfig[gatewayMac].mode, gatewayConfig[gatewayMac].region,
                    gatewayConfig[gatewayMac].A, gatewayConfig[gatewayMac].n);
            }
        }
    }

    // 指数加权移动平均
    ewma(iBeaconMac: string) {
        if(this.iBeaconInfo[iBeaconMac].ewmaLastSol === undefined) {
            this.iBeaconInfo[iBeaconMac].ewmaLastSol = this.iBeaconInfo[iBeaconMac].pvaSol.length > 0 ? 
                this.iBeaconInfo[iBeaconMac].pvaSol[0]: [0., 0.];
            this.iBeaconInfo[iBeaconMac].ewmaSol = [];
            this.iBeaconInfo[iBeaconMac].ewmaNum = 1;
        }        
        this.iBeaconInfo[iBeaconMac].pvaSol.forEach(pva => {
            let sol = [];
            pva.forEach((v, i) => {
                sol.push(ThresholdConfig.EWMABETA * this.iBeaconInfo[iBeaconMac].ewmaLastSol[i] 
                    + (1- ThresholdConfig.EWMABETA) * v);
            })
            this.iBeaconInfo[iBeaconMac].ewmaLastSol = [...sol];
            if(this.iBeaconInfo[iBeaconMac].ewmaNum <= ThresholdConfig.EMWAWEIGHTNUM){
                this.iBeaconInfo[iBeaconMac].ewmaSol.push(sol.map(x => x/(1 - 
                    ThresholdConfig.EWMABETA ** this.iBeaconInfo[iBeaconMac].ewmaNum)));
                    this.iBeaconInfo[iBeaconMac].ewmaNum += 1;
            }else{
                this.iBeaconInfo[iBeaconMac].ewmaSol.push(sol);
            }
        })
    }

    // 加权移动平均
    wma(iBeaconMac: string) {
        

    }


    regionToRegion(region: number[][], endRegion: number): number[]{
        let res: number[][] = [];
        region.forEach(x => {
            let xGoto: number[] = this.regionInfo[x[x.length-1]].canGoto.filter(a => x.indexOf(a) === -1);
            xGoto.forEach(a => {
                res.push(x.concat(a));
            });
        })
        console.log("res：", res);
        if (!res.length){
            return [];
        }else {
            let ret: number[] = [];
            for(let i = 0; i < res.length; i++) {
                if(res[i][res[i].length-1] === endRegion && res[i].length > ret.length){
                    ret = [...res[i]];
                }
            }
            if(ret.length){
                return ret;
            }
        }
        return this.regionToRegion(res, endRegion);
    }
}