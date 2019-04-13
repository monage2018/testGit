import { KalmanFilter } from "./KalmanFilter"
import { RSSIKalmanFilterConfig } from "../locationConfig"

/**
 * @author GaoLixu <lixu.gao@corelink.vip>
 * create time: 2019-03-28 10:10
 * description: kalman filter for RSSI
 *              state variable:
 *                      x = RSSI
 *              observed variable:
 *                      z = RSSI
 *              state equation and observed equation:
 *                      x(k) = A*x(k-1) + v, v~N(0,Q)
 *                      z(k) = H*x(k) + w, w~N(0,R)
 *                             A = 1, H = 1
 */

export class RSSIKalmanFilter implements KalmanFilter {
    x: number;
    P: number;
    Q: number;
    R: number;
    K: number;
    A: number;
    H: number;
  
    constructor(x0 = RSSIKalmanFilterConfig.x0) {
        this.x = x0;
        this.P = RSSIKalmanFilterConfig.P0;
        this.Q = RSSIKalmanFilterConfig.Q;
        this.R = RSSIKalmanFilterConfig.R;
        this.A = 1;
        this.H = 1;
    }
  
    evaluateXk(rssi: number): number {
        // 时间更新
        this.x = this.A * this.x; // x_[k] = A * x[k-1]
        this.P = this.A * this.P * this.A + this.Q; // P_[k] = A * P[k-1] * A + Q
        // 状态更新
        this.K = this.H * this.P / (this.H * this.P * this.H + this.R); // K = P_[k] * H / (H * P_[k] * H + R)
        this.x = this.x + this.K * (rssi - this.H * this.x); // x[k]= x_[k] + K * (RSSI[k] - H * x_[k])
        this.P = this.P - this.K * this.H * this.P; // P[k] = P_[k] - K * H * P_[k]

        return this.x; // 返回当前时刻RSSI值
    }
}

