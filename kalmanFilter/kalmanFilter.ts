/**
 * @author GaoLixu <lixu.gao@corelink.vip>
 * create time: 2019-03-28 10:10
 * description: 
 */

export interface KalmanFilter {
    x: number | number[][]; //状态变量
    P: number | number[][]; //状态变量协方差
    Q: number | number[][]; //过程噪声协方差
    R: number | number[][]; //观测噪声协方差
    K: number | number[][]; //卡尔曼滤波因子
    A: number | number[][]; //状态转移矩阵
    H: number | number[][]; //观测矩阵
  
    evaluateXk(z: number | number[][]): number | number[][]; //估计当前时刻状态变量的值
}
  
  
  
  