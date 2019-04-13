import * as math from "mathjs";
import { KalmanFilter } from "./kalmanFilter"
import { PVAKalmanFilterConfig } from "../locationConfig"

/**
 * @author GaoLixu <lixu.gao@corelink.vip>
 * create time: 2019-03-28 10:10
 * description: kalman filter for (positon,velocity,acceleration)
 *              state variable:
 *                      x = [x, vx, ax, y, vy, ay]
 *              observed variable:
 *                      z = [x, y]
 *              state equation and observed equation:
 *                      x(k) = A*x(k-1) + v, v~N(0,Q)
 *                      z(k) = H*x(k) + w, w~N(0,R)
 *              A = [1 1 0.5 0 0 0     H= [1 0 0 0 0 0
 *                   0 1 1 0 0 0           0 0 0 1 0 0]
 *                   0 0 1 0 0 0
 *                   0 0 0 1 1 0.5
 *                   0 0 0 0 1 1
 *                   0 0 0 0 0 1],
 */

export class PVAKalmanFilter implements KalmanFilter {
    x: number[][];
    P: number[][];
    Q: number[][];
    R: number[][];
    K: number[][];
    A: number[][];
    H: number[][];
  
    constructor(x0 = PVAKalmanFilterConfig.x0) {
        this.x = x0;
        this.P = PVAKalmanFilterConfig.P0;
        this.Q = PVAKalmanFilterConfig.Q;
        this.R = PVAKalmanFilterConfig.R;
        this.A = [[1, 1, 0.5, 0, 0, 0],
                [0, 1, 1, 0, 0, 0],
                [0, 0, 1, 0, 0, 0],
                [0, 0, 0, 1, 1, 0.5],
                [0, 0, 0, 0, 1, 1],
                [0, 0, 0, 0, 0, 1]];
        this.H = [[1, 0, 0, 0, 0, 0],
                [0, 0, 0, 1, 0, 0]];
    }
  
    evaluateXk(xyPositon: number[][]): number[][] {
        let matrixX = math.matrix(this.x);
        let matrixP = math.matrix(this.P);
        let matrixQ = math.matrix(this.Q);
        let matrixR = math.matrix(this.R);
        let matrixA = math.matrix(this.A);
        let matrixH = math.matrix(this.H);
        let matrixXYPosition = math.matrix(xyPositon);

        // 时间更新
        matrixX = math.multiply(matrixA, matrixX); // x_[k] = A * x[k-1]
        matrixP = math.add(math.multiply(matrixA, matrixP, math.transpose(matrixA)), matrixQ); // P_[k] = A * P[k-1] * A' + Q
        // 状态更新
        let matrixK = math.multiply(matrixP, math.transpose(matrixH), 
                                math.inv(math.add(math.multiply(matrixH, matrixP, 
                                math.transpose(matrixH)), matrixR))); // K = P_[k] * H' * (H * P_[k] * H' + R)^-1
        this.x = math.add(matrixX, math.multiply(matrixK, math.subtract(matrixXYPosition, 
                        math.multiply(matrixH, matrixX)))).valueOf();// x[k]= x_[k] + K * (xyPosition[k] - H * x_[k])
        this.P = math.subtract(matrixP, math.multiply(matrixK, matrixH, matrixP)).valueOf(); // P[k] = P_[k] - K * H * P_[k]

        return [[this.x[0][0]], [this.x[3][0]]]; // 返回当前时刻x,y坐标
    }
}