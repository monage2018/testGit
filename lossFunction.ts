/**
 * @author GaoLixu <lixu.gao@corelink.vip>
 * create time: 2019-03-28 10:10
 * description:
 */

export class LossFunction {
  private points: number[][];
  private d: number[];
  private wd: number[];
  private N: number;
  private M: number;

  constructor(points: number[][], d: number[], wd: number[]) {
    this.points = points;
    this.d = d;
    this.wd = wd;
    this.N = this.points.length;
    this.M = this.points[0].length;
  }

  f = (p: number[][]) => {
    let sum = 0.;
    for (let i = 0; i < this.M; i++) {
      sum += this.wd[i] * (Math.sqrt((p[0][0] - this.points[0][i]) ** 2 + (p[1][0]
        - this.points[1][i]) ** 2) - this.d[i]) ** 2;
    }
    return sum;
  }

  gf = (p: number[][]) => {
    let gradient: number[][] = [[0.], [0.]];
    for (let i = 0; i < this.M; i++) {
      let r = Math.sqrt((p[0][0] - this.points[0][i]) ** 2 + (p[1][0] - this.points[1][i]) ** 2);
      if (r > 1e-16) {
        gradient[0][0] += this.wd[i] * 2 * (r - this.d[i]) / r * (p[0][0] - this.points[0][i]);
        gradient[1][0] += this.wd[i] * 2 * (r - this.d[i]) / r * (p[1][0] - this.points[1][i]);
      }
    }
    return gradient;
  }
}
