export type Point = { x: number; y: number };

export type LineEntity = {
  id: number;
  type: 'line';
  p1: Point;
  p2: Point;
  color?: string;
  width?: number;
};

export type CircleEntity = {
  id: number;
  type: 'circle';
  cx: number;
  cy: number;
  r: number;
  color?: string;
  width?: number;
};

export type ArcEntity = {
  id: number;
  type: 'arc';
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
  color?: string;
  width?: number;
};

export type RectEntity = {
  id: number;
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number; // rotation
  color?: string;
  width?: number;
};

export type PrimitiveEntity = LineEntity | CircleEntity | ArcEntity | RectEntity;

export function lineToPoints(entity: LineEntity) {
  return [
    { x: entity.p1.x, y: entity.p1.y },
    { x: entity.p2.x, y: entity.p2.y },
  ];
}

export function circleToPoints(entity: CircleEntity, segments = 64) {
  const pts = [] as Point[];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    pts.push({ x: entity.cx + entity.r * Math.cos(theta), y: entity.cy + entity.r * Math.sin(theta) });
  }
  return pts;
}

export function arcToPoints(entity: ArcEntity, segments = 64) {
  const pts: Point[] = [];
  // normalize angles
  let start = entity.startAngle;
  let end = entity.endAngle;
  if (end < start) end += Math.PI * 2;
  const span = end - start;
  const steps = Math.max(4, Math.round((segments * (span / (Math.PI * 2)))));
  for (let i = 0; i <= steps; i++) {
    const t = start + (i / steps) * span;
    pts.push({ x: entity.cx + entity.r * Math.cos(t), y: entity.cy + entity.r * Math.sin(t) });
  }
  return pts;
}

export function rectToPoints(entity: RectEntity) {
  // axis-aligned rectangle with optional rotation about center
  const cx = entity.x + entity.w / 2;
  const cy = entity.y + entity.h / 2;
  const hw = entity.w / 2;
  const hh = entity.h / 2;
  const corners = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  const theta = entity.angle ?? 0;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return corners.map(c => ({ x: cx + c.x * cos - c.y * sin, y: cy + c.x * sin + c.y * cos }));
}
