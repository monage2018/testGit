// 计算坐标系中两条线段是否有交点
export function segmentsIntr(a, b, c, d) {
  //线段ab的法线N1
  var nx1 = b.y - a.y,
    ny1 = a.x - b.x;

  //线段cd的法线N2
  var nx2 = d.y - c.y,
    ny2 = c.x - d.x;

  //两条法线做叉乘, 如果结果为0, 说明线段ab和线段cd平行或共线,不相交
  var denominator = nx1 * ny2 - ny1 * nx2;
  if (denominator === 0) {
    return false;
  }

  //在法线N2上的投影
  var distC_N2 = nx2 * c.x + ny2 * c.y;
  var distA_N2 = nx2 * a.x + ny2 * a.y - distC_N2;
  var distB_N2 = nx2 * b.x + ny2 * b.y - distC_N2;

  // 点a投影和点b投影在点c投影同侧 (对点在线段上的情况,本例当作不相交处理);
  if (distA_N2 * distB_N2 >= 0) {
    return false;
  }

  //
  //判断点c点d 和线段ab的关系, 原理同上
  //
  //在法线N1上的投影
  var distA_N1 = nx1 * a.x + ny1 * a.y;
  var distC_N1 = nx1 * c.x + ny1 * c.y - distA_N1;
  var distD_N1 = nx1 * d.x + ny1 * d.y - distA_N1;
  if (distC_N1 * distD_N1 >= 0) {
    return false;
  }

  //计算交点坐标
  var fraction = distA_N2 / denominator;
  var dx = fraction * ny1,
    dy = -fraction * nx1;
  return { x: a.x + dx, y: a.y + dy };
}

// let a = { x: 2, y: 6 };
// let b = { x: 1, y: 5 };
// let c = { x: 3, y: 0 };
// let d = { x: 3, y: 7 };
// console.log(segmentsIntr(a, b, c, d));
