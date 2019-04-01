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
    iBeaconAndGatewayMacMap: Object;
    rssiKalmanFilter: Object;
    pvaKalmanFilter: Object;
    iBeaconInfo: Object;
    regionInfo: Object;
    gatewayInfo: Object;

    constructor() {
        this.iBeaconAndGatewayMacMap = {};
        this.rssiKalmanFilter = {};
        this.pvaKalmanFilter = {};
        this.iBeaconInfo = {};
        this.regionInfo = {};
        this.gatewayInfo = {};
        this.addRegion(RegionConfig);
        this.addGateway(GatewayConfig);
    }

    locate(iBeaconMac: string, gatewayMac: string[], rssiDataTable: number[][]): number[][] {
        this.iBeaconAndGatewayMacMap[iBeaconMac] = gatewayMac;
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
            if(!this.rssiKalmanFilter[macId[i]]){
                this.rssiKalmanFilter[macId[i]] = new RSSIKalmanFilter(rssiDataTable[i][0]);
            }
        })

        // 对RSSI信息进行滤波
        let rssiKF: number[][] = rssiDataTable.map((value, i) => {
            let lastResult: number;
            return value.map((rssi, j) => {
                let result: number = this.rssiKalmanFilter[macId[i]].evaluateXk(rssi);
                if(j > 0 && Math.abs(result - lastResult) > ThresholdConfig.RSSIGRADIENT) {
                    result = lastResult + Math.sign(result - lastResult) * ThresholdConfig.RSSIGRADIENT;
                }
                lastResult = result;
                return result;
            })
        })

        for(let j = 0; j < M; j++) {
            if(j === 52){
                let debug = 1;
            }
            // 不同模式加权平均
            let wd: number[] = A.map((value, i) => {
                return 1. / 10 ** ((value - rssiKF[i][j])/25.);
            })
            let wdSum = eval(wd.join("+"));
            let rssiWd: number[] = wd.map((value, i) => {
                return value / wdSum * rssiKF[i][j];
            });
            let sortRssiWdByRegion = {};
            let sortRegion: number[] = [];
            let maxRssi: number[];
            let sortMode: Object = {0: [],
                                    1: []};
            for(let i = 0; i < N; i++) {
                // 按照区域分类，id为网关标识，mode为定位模式(同区域定位模式一致),meanRssiWd为区域加权信号值
                if(!sortRssiWdByRegion[region[i]]) {
                    sortRegion.push(region[i]);
                    sortRssiWdByRegion[region[i]] = {
                        id: [i],
                        mode: mode[i],
                        meanRssiWd: rssiWd[i]
                    }
                }else {
                    sortRssiWdByRegion[region[i]].id.push(i);
                    sortRssiWdByRegion[region[i]].meanRssiWd += rssiWd[i];
                }
                // 最大信号值
                let value = rssiDataTable[i][j];
                if(!maxRssi) {
                    maxRssi = [i, value];
                }else if(value > maxRssi[1]){
                    maxRssi = [i, value];
                }
                // 按照模式分类
                if(mode[i] === 0) {
                    sortMode[0].push(i);
                }else if(mode[i] === 1 ) {
                    sortMode[1].push(i);
                }
            }
            let minRegionRssiWd: number[];
            for(let i = 0; i < sortRegion.length; i++) {
                let value = sortRssiWdByRegion[sortRegion[i]].meanRssiWd /= sortRssiWdByRegion[sortRegion[i]].id.length;
                if(!minRegionRssiWd) {
                    minRegionRssiWd = [sortRegion[i], value];
                }else if(value < minRegionRssiWd[1]) {
                    minRegionRssiWd = [sortRegion[i], value];
                }
            }
            // 当前区域和模式
            let nowRegion = minRegionRssiWd[0]; // 加权信号最强的区域
            let nowMode = sortRssiWdByRegion[nowRegion].mode;
            if(nowMode === 0 && mode[maxRssi[0]] === 0) {
                nowMode = 0;
            }else {
                nowMode = 1;
            }
            // 模式切换
            let modeSwitch1d: boolean = false;
            if(!this.iBeaconInfo[iBeaconMac]) {
                this.iBeaconInfo[iBeaconMac] = {};
                this.iBeaconInfo[iBeaconMac].lastMode = nowMode;
                this.iBeaconInfo[iBeaconMac].modeContinueNum = 0;
                this.iBeaconInfo[iBeaconMac].regionContinueNum = 0;
            }else if (nowMode != this.iBeaconInfo[iBeaconMac].lastMode) {
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
            }
            if(!this.iBeaconInfo[iBeaconMac].mode) {
                this.iBeaconInfo[iBeaconMac].mode = [];
            }
            this.iBeaconInfo[iBeaconMac].mode.push(nowMode);
            // 区域切换
            let regionSwitch: boolean = false;
            if(!this.iBeaconInfo[iBeaconMac].lastRegion) {
                this.iBeaconInfo[iBeaconMac].lastRegion = nowRegion;
                this.iBeaconInfo[iBeaconMac].continueRegionId = nowRegion;
            }else if (nowRegion != this.iBeaconInfo[iBeaconMac].lastRegion) {
                if (this.iBeaconInfo[iBeaconMac].regionContinueNum === 0) {
                    this.iBeaconInfo[iBeaconMac].regionContinueNum += 1;
                }else if (nowRegion != this.iBeaconInfo[iBeaconMac].continueRegionId) {
                    this.iBeaconInfo[iBeaconMac].continueRegionId = nowRegion;
                    this.iBeaconInfo[iBeaconMac].regionContinueNum = 1;
                }else if (nowRegion === this.iBeaconInfo[iBeaconMac].continueRegionId) {
                    this.iBeaconInfo[iBeaconMac].regionContinueNum += 1;
                }
                // 正在切换区域
                if (this.iBeaconInfo[iBeaconMac].regionContinueNum >= ThresholdConfig.REGIONSWITCH) {
                    this.iBeaconInfo[iBeaconMac].regionContinueNum = 0;
                    this.iBeaconInfo[iBeaconMac].lastRegion = nowRegion;
                    regionSwitch = true;
                }else {
                    this.iBeaconInfo[iBeaconMac].continueRegionId = nowRegion;
                    nowRegion = this.iBeaconInfo[iBeaconMac].lastRegion;
                }
            }
            if(!this.iBeaconInfo[iBeaconMac].region) {
                this.iBeaconInfo[iBeaconMac].region = [];
            }
            this.iBeaconInfo[iBeaconMac].region.push(nowRegion);
            
            // 选定网关，根据距离由近及远排序 
            let gatewayD: number[] = []; // iBeacon到各网关的距离
            for(let i = 0; i < N; i++){
                gatewayD[i] = 10 ** ((A[i] - rssiKF[i][j])/10/n[i]);
            }
            if(!this.iBeaconInfo[iBeaconMac].d){
                this.iBeaconInfo[iBeaconMac].d = [];
            }
            this.iBeaconInfo[iBeaconMac].d.push(gatewayD);
            let gatewayFilter: number[] = [];
            if (nowMode === 0){          
                let gatewayFilterAll: number[] = sortMode[0].sort((a, b) => { return gatewayD[a] - gatewayD[b]; });
                // 1d模式，优先选取信号最强的两个网关进行定位      
                if(gatewayFilter.length >= 2) {
                    gatewayFilter = gatewayFilterAll.slice(0, 2);
                    // 当本区域其余网关信号强度与选择的两个网关信号强度均值相当时，也予以考虑，参与定位
                    for(let i = 2; i < gatewayFilterAll.length; i++) {
                        if (Math.abs(rssiKF[gatewayFilterAll[i]][j] - 
                            (rssiKF[gatewayFilterAll[0]][j] + rssiKF[gatewayFilterAll[1]][j]) / 2) > ThresholdConfig.RSSIGRADIENT) {
                            gatewayFilter.push(gatewayFilterAll[i]);
                        }
                    }
                } else {
                    gatewayFilter = gatewayFilterAll.slice(0);
                }
            } else if (nowMode === 1) {
                gatewayFilter = sortMode[1];
                // 2d模式时，其他区域的网关信号强度比较大时，也予以考虑
                for(let i = 0; i < N; i++) {
                    if( gatewayFilter.indexOf(i) === -1 && rssiKF[i][j] > ThresholdConfig.RSSICHOOSEMORE) {
                        gatewayFilter.push(i);
                    }
                }
                gatewayFilter = gatewayFilter.sort((a, b) => { return gatewayD[a] - gatewayD[b]; });
            }
            let chooseNum: number = Math.min(ThresholdConfig.GATEWAYLOCATIONNUMBER, gatewayFilter.length);
            let choosePoints: number[][] = [];
            let chooseD: number[] = [];
            let chooseWd: number[] = [];
            let chooseWdSum: number = 0.;
            for(let i = 0; i < chooseNum; i++) {
                choosePoints.push(coordinates[gatewayFilter[i]]);
                chooseD.push(gatewayD[gatewayFilter[i]]);
                chooseWdSum += 1/chooseD[i];
            }
            chooseWd = chooseD.reduce((result, d) => {
                result.push(1/d/chooseWdSum);
                return result;
            }, []);
            choosePoints = math.transpose(choosePoints).valueOf();

            // 拟牛顿法求iBeacon坐标
            let lossFunc = new LossFunction(choosePoints, chooseD, chooseWd);
            let x0 = [[1], [1]];
            let result = BFGS(lossFunc.f, lossFunc.gf, x0)[0];
            let sol: number[]= result.pop()[0];

            // 从2d模式切换到1d模式时，如果定位超过基线一定范围，则保留2d模式
            if(modeSwitch1d) {
                let distanceToBaseLine = math.abs(math.det([[choosePoints[0][0]-choosePoints[0][1], sol[0] - choosePoints[0][1]],
                                                [choosePoints[1][0]-choosePoints[1][1], sol[1] - choosePoints[1][1]]]))
                                                / math.norm([choosePoints[0][0]-choosePoints[0][1], 
                                                choosePoints[1][0]-choosePoints[1][1]]);
                if(distanceToBaseLine > ThresholdConfig.ZEROMODEBASELINERANGE) {
                    nowMode = 1;
                    this.iBeaconInfo[iBeaconMac].lastMode = nowMode;
                    sol = this.iBeaconInfo[iBeaconMac].lastSol;
                }                   
            }
            this.iBeaconInfo[iBeaconMac].lastSol = sol;
            if(!this.iBeaconInfo[iBeaconMac].sol) {
                this.iBeaconInfo[iBeaconMac].sol = [];
            }
            this.iBeaconInfo[iBeaconMac].sol.push(sol);

            // 位置速度加速度卡尔曼滤波
            if(!this.pvaKalmanFilter[iBeaconMac]) {
                let pva0 = [[sol[0]], [0.], [0.], [sol[1]], [0.], [0.]];
                this.pvaKalmanFilter[iBeaconMac] = new PVAKalmanFilter(pva0);
            }
            let pvaSol: number[][] = this.pvaKalmanFilter[iBeaconMac].evaluateXk([[sol[0]], [sol[1]]]);
            if(!this.iBeaconInfo[iBeaconMac].pvaSol) {
                this.iBeaconInfo[iBeaconMac].pvaSol = [];
            }
            this.iBeaconInfo[iBeaconMac].pvaSol.push([pvaSol[0][0], pvaSol[1][0]]);
        }

        // 卷积平滑处理
        let k = 0;
        let endK = this.iBeaconInfo[iBeaconMac].pvaSol.length - ThresholdConfig.CONVOLUTIONLENGTH + 1;
        let viewPointReturn: number[][] = [];
        for(; k < endK; k++) {
            let kEnd = k + ThresholdConfig.CONVOLUTIONLENGTH;
            // 卷积坐标
            let coef = 1 / ThresholdConfig.CONVOLUTIONLENGTH;
            let convSol = this.iBeaconInfo[iBeaconMac].pvaSol.slice(k, kEnd).reduce((meanValue, sols) => {
                meanValue[0] += coef*sols[0];
                meanValue[1] += coef*sols[1];
                return meanValue;
            }, [0., 0.]);
            if(!this.iBeaconInfo[iBeaconMac].convSol) {
                this.iBeaconInfo[iBeaconMac].convSol = [];
            }
            this.iBeaconInfo[iBeaconMac].convSol.push(convSol);

            // 卷积模式
            let pvaSolMode = this.iBeaconInfo[iBeaconMac].mode.slice(k, kEnd);
            let convSolModeSort = pvaSolMode.reduce((modeNum, modes) => {
                if(modeNum[0].indexOf(modes) === -1) {
                    modeNum[0].push(modes);
                    modeNum[1].push(1);
                }else {
                    modeNum[1][modeNum[0].indexOf(modes)] += 1;
                }
                return modeNum;
            }, [[],[]]);
            convSolModeSort = math.transpose(convSolModeSort).valueOf();
            let convSolMode = convSolModeSort.sort((a,b) => {
                return b[1] - a[1]})[0][0];

            // 卷积区域
            let pvaSolRegion = this.iBeaconInfo[iBeaconMac].region.slice(k, kEnd);
            let convSolRegionSort = pvaSolRegion.reduce((regionNum, regions) => {
                if(regionNum[0].indexOf(regions) === -1) {
                    regionNum[0].push(regions);
                    regionNum[1].push(1);
                }else {
                    regionNum[1][regionNum[0].indexOf(regions)] += 1;
                }
                return regionNum;
            }, [[],[]]);
            convSolRegionSort = math.transpose(convSolRegionSort).valueOf();
            let convSolRegion = convSolRegionSort.sort((a,b) => {
                return b[1] - a[1]})[0][0];

            // 加权位移
            if(this.regionInfo[convSolRegion].weightMove) {
                let regionGatewayId = region.indexOf(convSolRegion)
                let regionGatewayCoor = coordinates[regionGatewayId];
                let convD = this.iBeaconInfo[iBeaconMac].d.slice(k, kEnd).reduce((meanValue, sols) => {
                    meanValue += coef*sols[regionGatewayId];
                    return meanValue;
                }, 0.);
                let distanceToGateway = Math.sqrt((convSol[0] - regionGatewayCoor[0]) ** 2 
                                        + (convSol[1] - regionGatewayCoor[1]) ** 2);
                if(convD < distanceToGateway){
                    convSol.forEach((iteam, index) => {
                        iteam = regionGatewayCoor[index] + convD/distanceToGateway*(iteam - regionGatewayCoor[index]);
                    })
                }
            }

            // 区域限制
            let convSolRegionLimit = this.regionInfo[convSolRegion].regionLimitCoordiantes(convSol);
            if(!this.iBeaconInfo[iBeaconMac].convSolRegionLimit) {
                this.iBeaconInfo[iBeaconMac].convSolRegionLimit = [];
            }
            this.iBeaconInfo[iBeaconMac].convSolRegionLimit.push(convSolRegionLimit);

            // 步伐限制
            if(!this.iBeaconInfo[iBeaconMac].lastView) {
                this.iBeaconInfo[iBeaconMac].lastView = {
                    point: [convSolRegionLimit[0], convSolRegionLimit[1]],
                    mode: convSolMode,
                    region: convSolRegion,
                }
                this.iBeaconInfo[iBeaconMac].viewPoint = [convSolRegionLimit[0], convSolRegionLimit[1]];
                viewPointReturn.push([convSolRegionLimit[0], convSolRegionLimit[1]]);
            }
            let distance = Math.sqrt((convSolRegionLimit[0] - this.iBeaconInfo[iBeaconMac].lastView.point[0]) ** 2 
                                        + (convSolRegionLimit[1] - this.iBeaconInfo[iBeaconMac].lastView.point[1]) ** 2);
            if(distance > ThresholdConfig.FOOTSTEP || convSolRegion != this.iBeaconInfo[iBeaconMac].lastView.region) {
                this.iBeaconInfo[iBeaconMac].lastView = {
                    point: [convSolRegionLimit[0], convSolRegionLimit[1]],
                    mode: convSolMode,
                    region: convSolRegion,
                }
                this.iBeaconInfo[iBeaconMac].viewPoint.push([convSolRegionLimit[0], convSolRegionLimit[1]]);
                viewPointReturn.push([convSolRegionLimit[0], convSolRegionLimit[1]]);
            }
        }

        this.iBeaconInfo[iBeaconMac].sol.splice(0, k);
        this.iBeaconInfo[iBeaconMac].pvaSol.splice(0, k);
        this.iBeaconInfo[iBeaconMac].convSol.splice(0, k);
        this.iBeaconInfo[iBeaconMac].convSolRegionLimit.splice(0, k);
        this.iBeaconInfo[iBeaconMac].mode.splice(0, k);
        this.iBeaconInfo[iBeaconMac].region.splice(0, k);
        this.iBeaconInfo[iBeaconMac].d.splice(0, k);

        console.log("iBeaconInfo", this.iBeaconInfo, "result", viewPointReturn);

        return viewPointReturn;
    }

    addRegion(regionConfig: Object){
        for(let region in regionConfig) {
            if (!this.regionInfo[region]) {
                this.regionInfo[region] = new Region(regionConfig[region].xyLimit[0], regionConfig[region].xyLimit[1],
                    regionConfig[region].xyLimit[2], regionConfig[region].xyLimit[3], regionConfig[region].zoom, 
                    regionConfig[region].weightMove);
            }
        }
    }

    addGateway(gatewayConfig: Object){
        for(let gatewayMac in gatewayConfig) {
            if (!this.gatewayInfo[gatewayMac]) {
                this.gatewayInfo[gatewayMac] = new Gateway(gatewayConfig[gatewayMac].mac, gatewayConfig[gatewayMac].name,
                    gatewayConfig[gatewayMac].coordinates, gatewayConfig[gatewayMac].mode, gatewayConfig[gatewayMac].region, 
                    gatewayConfig[gatewayMac].A, gatewayConfig[gatewayMac].n);
            }
        }
    }

}