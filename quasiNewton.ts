import * as math from 'mathjs';

/**
 * @author GaoLixu <lixu.gao@corelink.vip>
 * create time: 2019-03-28 10:10
 * description:
 */

export function BFGS(fun, gfun, x0: number[][]) {
  let result: number[][][] = [];
  let value: number[][][] = [];
  let epsilon = 1;
  let tol = 1e-10;
  let maxk = 1000;
  let rho = 0.55;
  let sigma = 0.4;
  let m = x0.length;
  let Bk = math.identity(m).valueOf();
  let k = 0;
  while (k < maxk && epsilon > tol) {
    let gk = gfun(x0);
    let dk = math.multiply(-1, math.multiply(math.inv(Bk), gk)).valueOf();
    let m = 0;
    let mk = 0;
    // Armijo 搜索
    while (m < 20) {
      const newf = fun(math.add(x0, math.multiply(rho ** m, dk)).valueOf());
      const oldf = fun(x0);
      if (newf <= (oldf + math.multiply(sigma * (rho ** m), math.transpose(gk), dk).valueOf()[0][0])) {
        mk = m;
        break;
      }
      m = m + 1;
    }
    // BFGS校正
    let x = math.add(x0, math.multiply(rho ** mk, dk)).valueOf();
    let sk = math.subtract(x, x0).valueOf();
    let yk = math.subtract(gfun(x), gk).valueOf();
    if (math.multiply(math.transpose(yk), sk).valueOf() > 0) {
        let bsstb = math.multiply(Bk, sk, math.transpose(sk), Bk);
        let sktbksk = math.multiply(math.transpose(sk), Bk, sk);
        let coef1 = math.divide(bsstb, sktbksk.valueOf()[0][0]);
  
        let ykykt = math.multiply(yk, math.transpose(yk));
        let yktsk = math.multiply(math.transpose(yk), sk);
        let coef2 = math.divide(ykykt, yktsk.valueOf()[0][0]);
  
        Bk = math.add(math.subtract(Bk, coef1), coef2).valueOf();
    }
    epsilon = math.abs(math.subtract(fun(x), fun(x0)));
    k = k + 1;
    x0 = x;
    result.push(math.transpose(x0).valueOf());
    value.push(fun(x0));
  }
  return [result, value];
}


