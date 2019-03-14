import * as math from 'mathjs';
import * as linear from 'linear-solve/gauss-jordan';

// 拟牛顿法实现
export function bfgs(fun, gfun, x0) {
  let result: any = [];
  let value: any = [];
  let epsilon = 1;
  let tol = 1e-10;
  let maxk = 1000;
  let rho = 0.55;
  let sigma = 0.4;
  let m = x0._size[0];
  let Bk = math.matrix(eye(m));
  let k = 0;
  while (k < maxk && epsilon > tol) {
    let gk = math.matrix(gfun(x0)); //计算梯度
    let _gk = math.transpose(gk).valueOf()[0];
    const _dk = linear.solve(Bk.valueOf(), _gk);
    for (let i in _dk) {
      _dk[i] = -_dk[i];
    }
    let dk = math.transpose(math.matrix([_dk]));
    m = 0;
    let mk = 0;
    while (m < 20) {
      const newf = fun(math.add(x0, math.multiply(rho ** m, dk)));
      const oldf = fun(x0);
      if (
        newf <
        oldf +
          math
            .multiply(sigma * rho ** m, (math.transpose(gk), dk))
            .valueOf()[0][0]
      ) {
        mk = m;
        break;
      }
      m = m + 1;
    }
    // BFGS校正
    let x = math.add(x0, math.multiply(rho ** mk, dk));
    let sk = math.subtract(x, x0);
    let yk = math.subtract(gfun(x), gk);
    if (math.multiply(math.transpose(yk), sk).valueOf() > 0) {
      let bsstb = math.multiply(Bk, sk, math.transpose(sk), Bk);
      let sktbksk = math.multiply(math.transpose(sk), Bk, sk);
      let b_d_s = math.divide(bsstb, sktbksk.valueOf()[0][0]);

      let ykykt = math.multiply(yk, math.transpose(yk));
      let yktsk = math.multiply(math.transpose(yk), sk);
      let y_d_y = math.divide(ykykt, yktsk.valueOf()[0][0]);

      Bk = math.add(math.subtract(Bk, b_d_s), y_d_y);
    }
    epsilon = math.abs(math.subtract(fun(x), fun(x0)));
    k = k + 1;
    x0 = x;
    result.push(math.transpose(x0).valueOf());
    value.push(fun(x0));
  }
  return [result, value];
}

function eye(size: number) {
  let eyes = [];
  for (let i = -1; i++, i < size; ) {
    const e: number[] = Array.apply(null, Array(size)).fill(0);
    e[i] = 1;
    eyes.push(e);
  }
  return eyes;
}
