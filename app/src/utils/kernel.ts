import * as d3 from 'd3';

export function kernelEpanechnikov(k: number) {
  return (v: number) => (Math.abs((v /= k)) <= 1 ? 0.75 * (1 - v * v) / k : 0);
}

export function kernelDensityEstimator(kernel: (v: number) => number, X: number[]) {
  return function (V: number[]) {
    return X.map((x) => [x, d3.mean(V, (v) => kernel(x - v)) as number]);
  };
}
