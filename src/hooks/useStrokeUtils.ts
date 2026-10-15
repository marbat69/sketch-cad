// Utilities for stroke processing and path building

export type Point = { x: number; y: number; pressure?: number };

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function simplifyPoints(points: Point[], tol = 1.8) {
  if (points.length <= 2) return points;
  const simplified: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i];
    const previous = simplified[simplified.length - 1];
    if (distance(current, previous) > tol) {
      simplified.push(current);
    }
  }
  const last = points[points.length - 1];
  if (distance(last, simplified[simplified.length - 1]) > tol) {
    simplified.push(last);
  }
  return simplified;
}

export function buildSmoothPath(points: Point[]) {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;

    if (i === 1) {
      d += ` Q ${previous.x} ${previous.y} ${midX} ${midY}`;
    } else {
      d += ` T ${midX} ${midY}`;
    }
  }

  const last = points[points.length - 1];
  const previous = points[points.length - 2];
  const midX = (previous.x + last.x) / 2;
  const midY = (previous.y + last.y) / 2;
  d += ` T ${midX} ${midY}`;
  return d;
}

export function createStrokeFromPoints(points: Point[]) {
  const cleanPoints = simplifyPoints(points);
  const closed = distance(cleanPoints[0], cleanPoints[cleanPoints.length - 1]) < 20;
  return {
    id: Date.now() + Math.random(),
    points: cleanPoints,
    color: '#111827',
    width: 2.5,
    closed,
  };
}
