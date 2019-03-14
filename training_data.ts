// fit model of d=10^((ABS(RSSI)-A)/(10*n))
export const RSSIANDDISTANCE = {
  RSSI: [-61, -68.05, -75, -85.95, -86.4, -87.4],
  DISTANCE: [1, 2.5, 4, 6.3, 8, 8.8],
};

//kalman test example
export const rssi_normal = [
  -60,
  -63,
  -61,
  -59,
  -62,
  -66,
  -64,
  -61,
  -65,
  -62,
  -60,
  -59,
  -61,
  -60,
];
export const rssi_abnormal = [-70, -80, -90, -50];
