import * as math from 'mathjs';

function dist2d(p1, p2) {
  return math.sqrt(
    math.add(
      math.square(math.subtract(p2[0][0], p1[0][0])),
      math.square(math.subtract(p2[1][0], p1[1][0])),
    ),
  );
}

function get_vector2d(p1, p2) {
  /*
    To get the vector starts from point p1 to point p2
    */

  return math.subtract(p2, p1);
}

export class TriPoints2d {
  /*
    A class shows the positions of three points.
    Method f(x, y) to compute the sum of squared distance of point (x, y) to
    three points.
    Method gf(x, y) to compute the gradient of function f at (x, y)
    */

  static xPos: number[];
  static yPos: number[];
  static radius: number[];
  static points: any = [];
  static range: number[] = [0, 1, 2];

  constructor(x, y, r) {
    TriPoints2d.xPos = x;
    TriPoints2d.yPos = y;
    TriPoints2d.radius = r;
    for (let i in TriPoints2d.range) {
      TriPoints2d.points.push(
        math.transpose(
          math.matrix([[TriPoints2d.xPos[i], TriPoints2d.yPos[i]]]),
        ),
      );
    }
  }

  f(p) {
    let sum = 0;
    for (let i in TriPoints2d.range) {
      sum +=
        (dist2d(p.valueOf(), TriPoints2d.points[i].valueOf()) -
          TriPoints2d.radius[i]) **
        2;
    }
    return sum;
  }

  gf(p) {
    let gradient = math.transpose(math.matrix([[0, 0]]));
    for (let i in TriPoints2d.range) {
      let d = dist2d(TriPoints2d.points[i].valueOf(), p.valueOf());
      gradient = math.add(
        gradient,
        math.multiply(
          (2 * (d - TriPoints2d.radius[i])) / d,
          math.subtract(p, TriPoints2d.points[i]),
        ),
      );
    }
    return gradient;
  }
}
