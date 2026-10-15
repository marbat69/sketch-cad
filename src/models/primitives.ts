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

export type PrimitiveEntity = LineEntity | CircleEntity;

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
