export type Point2D = { x: number; y: number };

export function signedArea(points: Point2D[]) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

export function cross(a: Point2D, b: Point2D, c: Point2D) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function onSegment(a: Point2D, b: Point2D, point: Point2D) {
  const EPSILON = 1e-8;
  return Math.abs(cross(a, b, point)) <= EPSILON &&
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON;
}

export function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D) {
  const EPSILON = 1e-8;
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  const intersects = (abC * abD < -EPSILON && cdA * cdB < -EPSILON) ||
    (Math.abs(abC) <= EPSILON && onSegment(a, b, c)) ||
    (Math.abs(abD) <= EPSILON && onSegment(a, b, d)) ||
    (Math.abs(cdA) <= EPSILON && onSegment(c, d, a)) ||
    (Math.abs(cdB) <= EPSILON && onSegment(c, d, b));
  return intersects;
}

export function pointInTriangle(point: Point2D, a: Point2D, b: Point2D, c: Point2D) {
  const EPSILON = 1e-8;
  const ab = cross(a, b, point);
  const bc = cross(b, c, point);
  const ca = cross(c, a, point);
  return ab >= -EPSILON && bc >= -EPSILON && ca >= -EPSILON;
}

export function isSimplePolygon(points: Point2D[]) {
  const EPSILON = 1e-8;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j++) {
      if (j === i || j === (i + 1) % points.length || (j + 1) % points.length === i) continue;
      const c = points[j];
      const d = points[(j + 1) % points.length];
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

export function triangulateProfile(input: Point2D[]) {
  const EPSILON = 1e-8;
  if (!Array.isArray(input) || input.length < 3) throw new Error('El perfil necesita al menos tres vértices.');

  let points = input.map(point => ({ x: Number(point.x), y: Number(point.y) }));
  if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error('El perfil contiene coordenadas no válidas.');
  }

  points = points.filter((point, index) => {
    const prev = points[(index + points.length - 1) % points.length];
    return Math.hypot(point.x - prev.x, point.y - prev.y) > EPSILON;
  });

  if (points.length < 3) throw new Error('El perfil necesita al menos tres vértices distintos.');
  if (!isSimplePolygon(points)) throw new Error('El perfil se cruza consigo mismo; corrige el croquis antes de extruir.');
  if (Math.abs(signedArea(points)) < EPSILON) throw new Error('El perfil no tiene área.');

  const winding = signedArea(points) > 0 ? 1 : -1;
  const remaining = points.map((_, index) => index);
  if (winding < 0) remaining.reverse();

  const triangles: number[][] = [];
  let guard = remaining.length * remaining.length;
  while (remaining.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < remaining.length; i++) {
      const previous = remaining[(i + remaining.length - 1) % remaining.length];
      const current = remaining[i];
      const next = remaining[(i + 1) % remaining.length];
      const a = points[previous];
      const b = points[current];
      const c = points[next];
      if (cross(a, b, c) <= EPSILON) continue;

      const occupied = remaining.some(index => {
        return index !== previous && index !== current && index !== next && pointInTriangle(points[index], a, b, c);
      });

      if (!occupied) {
        triangles.push([previous, current, next]);
        remaining.splice(i, 1);
        clipped = true;
        break;
      }
    }

    if (!clipped) throw new Error('No se pudo triangular el perfil. Comprueba si tiene vértices repetidos o un cruce.');
  }

  triangles.push(remaining.slice());
  return { points, triangles };
}

export function buildMesh(profile: Point2D[], depth: number) {
  const EPSILON = 1e-8;
  const extrusion = Number(depth);
  if (!Number.isFinite(extrusion) || extrusion <= 0) throw new Error('La profundidad debe ser mayor que cero.');
  const normalizedProfile = signedArea(profile) < 0 ? [...profile].reverse() : profile;
  const { points, triangles } = triangulateProfile(normalizedProfile);

  const faces: any[] = [];
  for (const [a, b, c] of triangles) {
    faces.push({
      vertices: [{ ...points[a], z: extrusion }, { ...points[b], z: extrusion }, { ...points[c], z: extrusion }],
      surface: 'top',
    });
    faces.push({
      vertices: [{ ...points[c], z: 0 }, { ...points[b], z: 0 }, { ...points[a], z: 0 }],
      surface: 'bottom',
    });
  }

  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const a = points[i];
    const b = points[j];
    faces.push({ vertices: [{ ...a, z: 0 }, { ...b, z: 0 }, { ...b, z: extrusion }], surface: 'side' });
    faces.push({ vertices: [{ ...a, z: 0 }, { ...b, z: extrusion }, { ...a, z: extrusion }], surface: 'side' });
  }

  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const area = Math.abs(signedArea(points));
  return {
    type: 'extrusion',
    points,
    faces,
    depth: extrusion,
    bounds: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      minZ: 0,
      maxZ: extrusion,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      depth: extrusion,
    },
    area,
    volume: area * extrusion,
  };
}

export function normalOf(a: any, b: any, c: any) {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const normal = {
    x: ab.y * ac.z - ab.z * ac.y,
    y: ab.z * ac.x - ab.x * ac.z,
    z: ab.x * ac.y - ab.y * ac.x,
  };
  const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
  return { x: normal.x / length, y: normal.y / length, z: normal.z / length };
}

export function toBinaryStl(mesh: any) {
  const triangles = mesh.faces;
  const buffer = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(buffer);
  const header = new TextEncoder().encode('PencilCad · STL binario · unidades mm');
  new Uint8Array(buffer, 0, Math.min(header.length, 80)).set(header.subarray(0, 80));
  view.setUint32(80, triangles.length, true);
  triangles.forEach((face: any, index: number) => {
    const offset = 84 + index * 50;
    const normal = normalOf(...face.vertices);
    [normal.x, normal.y, normal.z, ...face.vertices.flatMap((point: any) => [point.x, point.y, point.z])].forEach((value, component) => {
      view.setFloat32(offset + component * 4, value, true);
    });
    view.setUint16(offset + 48, 0, true);
  });
  return new Blob([buffer], { type: 'model/stl' });
}

export function exportPencilCadStlFromProfile(points: Point2D[], depth = 1) {
  const clean = points.filter((point, index) => {
    const prev = points[(index + points.length - 1) % points.length];
    return Math.hypot(point.x - prev.x, point.y - prev.y) > 1e-6;
  });
  if (clean.length < 3) throw new Error('Se necesitan al menos 3 puntos para generar el sólido.');
  const mesh = buildMesh(clean, depth);
  return toBinaryStl(mesh);
}
