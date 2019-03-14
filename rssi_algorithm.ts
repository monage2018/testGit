import { Injectable } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs';
import { math, Optimizer } from '@tensorflow/tfjs';
import { RSSIANDDISTANCE } from './training_data';

// f(rssi) = d 距离计算模型实现
@Injectable()
export class RssiToD {
  n: any;
  // nn: number;
  A: number = 63;
  static learningRate: number = 0.0005;
  static optimizer = tf.train.sgd(RssiToD.learningRate);

  constructor() {
    this.n = tf.variable(tf.scalar(Number((Math.random() * 3 + 1).toFixed(2))));
    const rssis = RSSIANDDISTANCE.RSSI;
    const ds = RSSIANDDISTANCE.DISTANCE;
    this.train(rssis, ds);
    console.log(this.n.dataSync()[0]);
    while (this.n.dataSync()[0] > 4 || this.n.dataSync()[0] < 2) {
      this.n = tf.variable(
        tf.scalar(Number((Math.random() * 3 + 1).toFixed(2))),
      );
      this.train(rssis, ds);
      console.log('this is n', this.n.dataSync()[0]);
    }
  }

  main(rssi: number): number {
    const n = this.n.dataSync()[0];
    // this.nn = n;
    let distance = Math.pow(
      10,
      Math.abs(Math.abs(rssi) - Math.abs(this.A)) / (10 * n),
    );
    return distance;
  }

  predict(rssi) {
    return tf.tidy(() => {
      return tf.scalar(10).pow(
        rssi
          .abs()
          .sub(tf.scalar(this.A).abs())
          .abs()
          .div(tf.scalar(10).mul(this.n)),
      );
    });
  }

  loss(predictions, labels) {
    const meanSquareError = predictions.sub(labels);
    const mse = meanSquareError.square().mean();
    return mse;
  }

  train(rssis, ds, numIterations = 1000) {
    this.A = rssis[0];
    const r = tf.tensor(rssis);
    const d = tf.tensor(ds);
    for (let iter = 0; iter < numIterations; iter++) {
      RssiToD.optimizer.minimize(() => {
        const predsYs = this.predict(r);
        return this.loss(predsYs, d);
      });
    }
  }
}
