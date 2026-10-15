import { Point } from '../hooks/useStrokeUtils';

type Primitive =
  | { type: 'line'; p1: Point; p2: Point }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'none' };

// Fit a line using PCA (principal component) and return max deviation
export function fitLine(points: Point[]) {
  const n = points.length;
  if (n < 2) return null;
  let meanX = 0;
  let meanY = 0;
  for (const p of points) {
    meanX += p.x;
    meanY += p.y;
  }
  meanX /= n;
  meanY /= n;

  // covariance matrix
  let sxx = 0,
    sxy = 0,
    syy = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }

  // principal direction is eigenvector of covariance matrix
  // compute eigenvector for largest eigenvalue
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const vx = Math.cos(theta);
  const vy = Math.sin(theta);

  // project points and compute distances
  let maxDev = 0;
  const projections: { t: number; x: number; y: number }[] = [];
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    const t = dx * vx + dy * vy;
    const projX = meanX + t * vx;
    const projY = meanY + t * vy;
    const dev = Math.hypot(p.x - projX, p.y - projY);
    if (dev > maxDev) maxDev = dev;
    projections.push({ t, x: projX, y: projY });
  }

  // endpoints as min and max t
  projections.sort((a, b) => a.t - b.t);
  const p1 = { x: projections[0].x, y: projections[0].y };
  const p2 = { x: projections[projections.length - 1].x, y: projections[projections.length - 1].y };

  return { p1, p2, maxDev };
}

// Kasa method for circle fit (algebraic)
export function fitCircle(points: Point[]) {
  const n = points.length;
  if (n < 3) return null;
  let sumX = 0,
    sumY = 0,
    sumX2 = 0,
    sumY2 = 0,
    sumXY = 0,
    sumX3 = 0,
    sumY3 = 0,
    sumX1Y2 = 0,
    sumX2Y1 = 0;

  for (const p of points) {
    const x = p.x;
    const y = p.y;
    const x2 = x * x;
    const y2 = y * y;
    sumX += x;
    sumY += y;
    sumX2 += x2;
    sumY2 += y2;
    sumXY += x * y;
    sumX3 += x2 * x;
    sumY3 += y2 * y;
    sumX1Y2 += x * y2;
    sumX2Y1 += x2 * y;
  }

  const C = n * sumX2 - sumX * sumX;
  const D = n * sumXY - sumX * sumY;
  const E = n * sumX3 + n * sumX1Y2 - (sumX2 + sumY2) * sumX;
  const G = n * sumY2 - sumY * sumY;
  const H = n * sumX2Y1 + n * sumY3 - (sumX2 + sumY2) * sumY;

  const denom = 2 * (C * G - D * D);
  if (Math.abs(denom) < 1e-6) return null;

  const cx = (G * E - D * H) / denom;
  const cy = (C * H - D * E) / denom;

  // compute radius and residuals
  let sumErr = 0;
  let maxErr = 0;
  let r = 0;
  for (const p of points) {
    const d = Math.hypot(p.x - cx, p.y - cy);
    r += d;
  }
  r /= n;

  for (const p of points) {
    const d = Math.hypot(p.x - cx, p.y - cy);
    const err = Math.abs(d - r);
    sumErr += err;
    if (err > maxErr) maxErr = err;
  }
  const meanErr = sumErr / n;

  return { cx, cy, r, meanErr, maxErr };
}

export function detectPrimitives(points: Point[]) : Primitive {
  if (points.length < 3) return { type: 'none' };

  const line = fitLine(points);
  if (line && line.maxDev < 6) {
    // relatively straight
    return { type: 'line', p1: line.p1, p2: line.p2 };
  }

  const circle = fitCircle(points);
  if (circle && circle.meanErr < 6) {
    return { type: 'circle', cx: circle.cx, cy: circle.cy, r: circle.r };
  }

  return { type: 'none' };
}
