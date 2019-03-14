import { Injectable } from '@nestjs/common';
import { rssi_normal, rssi_abnormal } from './training_data';

@Injectable()
export class Kalman {
  Q: number;
  R: number;

  K: number;
  x: number;
  P: number;

  constructor() {
    // Q,R,x,K,P will be update after new rssi coming
    this.Q = 1e-6;
    this.R = 4e-4;
    this.x = -60;
    this.P = 1;
  }

  update_K() {
    this.K = this.P / (this.P + this.R);
  }

  update_P() {
    this.P = (1 - this.K) * this.P + this.Q;
  }

  update_x(rssi: number) {
    this.x = this.x + this.K * (rssi - this.x);
  }

  //filter data and return
  main(rssi: number): number {
    this.update_K();
    this.update_P();
    this.update_x(rssi);
    return this.x;
  }

  //add abnormal rssi data to test filter
  test() {
    const rssi_data = rssi_normal.concat(rssi_abnormal);
    for (let rssi of rssi_data) {
      let filter_rssi = this.main(rssi);
      console.log(filter_rssi);
    }
  }
}

// let k = new Kalman();
// k.test();
