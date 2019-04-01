/**
 * @author GaoLixu <lixu.gao@corelink.vip>
 * create time: 2019-03-28 10:10
 * description:
 */

export const ThresholdConfig = {
    MODESWITCH: 10,
    REGIONSWITCH: 10,
    GATEWAYLOCATIONNUMBER: 3,
    ZEROMODEBASELINERANGE: 5,
    RSSIGRADIENT: 10,
    RSSICHOOSEMORE: -80,
    CONVOLUTIONLENGTH: 10,
    CONVOLUTIONSTEP: 1,
    FOOTSTEP: 2,
    REGIONZOOM: 0.5,
}

export const RSSIKalmanFilterConfig = {
    x0: -60,
    P0: 2,
    Q: 1,
    R: 4,
}
  
export const PVAKalmanFilterConfig = {
    x0: [[0], [0], [0], [0], [0], [0]],
    P0: [[10, 0, 0, 0, 0, 0],
        [0, 10, 0, 0, 0, 0],
        [0, 0, 10, 0, 0, 0],
        [0, 0, 0, 10, 0, 0],
        [0, 0, 0, 0, 10, 0],
        [0, 0, 0, 0, 0, 10]],
    Q: [[0.1, 0.1, 0.1, 0, 0, 0],
        [0.1, 0.1, 0.1, 0, 0, 0],
        [0.1, 0.1, 0.1, 0, 0, 0],
        [0, 0, 0, 0.1, 0.1, 0.1],
        [0, 0, 0, 0.1, 0.1, 0.1],
        [0, 0, 0, 0.1, 0.1, 0.1]],
    R: [[4, 0],
        [0, 4]],
}

export const GatewayConfig = {
    "b4e62d8cd185": {
        mac: "b4e62d8cd185",
        name: "实验室",
        coordinates: [3.52, 2.74],
        mode: 1,
        region: 1,
        A: -62,
        n: 2.5,
    },
    "b4e62d8cd18d": {
        mac: "b4e62d8cd18d",
        name: "会议室",
        coordinates: [-0.31, 2.74],
        mode: 1,
        region: 2,
        A: -62,
        n: 2.5,
    },
    "b4e62d8cd0bd": {
        mac: "b4e62d8cd0bd",
        name: "主室",
        coordinates: [0, -1.50],
        mode: 1,
        region: 3,
        A: -62,
        n: 2.5,
    },
    "b4e62d8cd131": {
        mac: "b4e62d8cd131",
        name: "走廊1",
        coordinates: [-2.87, -4.80],
        mode: 0,
        region: 4,
        A: -62,
        n: 2,
    },
    "b4e62d8cd0fd": {
        mac: "b4e62d8cd0fd",
        name: "走廊2",
        coordinates: [-7.99, -4.80],
        mode: 0,
        region: 4,
        A: -62,
        n: 2,
    },
    "b4e62d8cd0d5": {
        mac: "b4e62d8cd0d5",
        name: "走廊3",
        coordinates: [-14.09, -4.80],
        mode: 0,
        region: 4,
        A: -62,
        n: 2,
    },
}

export const RegionConfig = {
    "1": {
        xyLimit: [1.92, 5.11, 1.38, 4.10],
        zoom: 0.5,
        weightMove: true,
    },
    "2": {
        xyLimit: [-2.54, 1.92, 1.38, 4.10],
        zoom: 0.5,
        weightMove: true,
    },
    "3": {
        xyLimit: [-5.11, 5.11, -4.10, 1.38],
        zoom: 0.5,
        weightMove: false,
    },
    "4": {
        xyLimit: [-20, 5.11, -4.80, -4.80],
        zoom: 0,
        weightMove: false,
    },
}