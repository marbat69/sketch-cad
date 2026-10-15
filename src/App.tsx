import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

type Point = { x: number; y: number; pressure?: number };

type Stroke = {
  id: number;
  points: Point[];
  color: string;
  width: number;
  closed: boolean;
};

const SVG_WIDTH = 1100;
const SVG_HEIGHT = 720;
const DEFAULT_COLOR = '#111827';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function simplifyPoints(points: Point[]) {
  if (points.length <= 2) return points;

  const simplified: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i];
    const previous = simplified[simplified.length - 1];
    if (distance(current, previous) > 1.8) {
      simplified.push(current);
    }
  }

  const last = points[points.length - 1];
  if (distance(last, simplified[simplified.length - 1]) > 1.8) {
    simplified.push(last);
  }

  return simplified;
}

function buildSmoothPath(points: Point[]) {
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

function buildClosedShape(stroke: Stroke) {
  if (stroke.points.length < 3) return null;

  const shape = new THREE.Shape();
  const first = stroke.points[0];
  shape.moveTo(first.x, first.y);

  for (let i = 1; i < stroke.points.length; i += 1) {
    const point = stroke.points[i];
    shape.lineTo(point.x, point.y);
  }

  if (stroke.closed) {
    shape.closePath();
  }

  return shape;
}

function createStrokeFromPoints(points: Point[]): Stroke {
  const cleanPoints = simplifyPoints(points);
  const closed = distance(cleanPoints[0], cleanPoints[cleanPoints.length - 1]) < 20;

  return {
    id: Date.now() + Math.random(),
    points: cleanPoints,
    color: DEFAULT_COLOR,
    width: 2.5,
    closed,
  };
}

export default function App() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [extrudeDepth, setExtrudeDepth] = useState(0.35);

  const strokeToShape = useCallback((stroke: Stroke) => {
    if (stroke.points.length < 3) return null;
    return buildClosedShape(stroke);
  }, []);

  const toSvgContent = useCallback((items: Stroke[]) => {
    return items
      .map((stroke) => {
        const path = buildSmoothPath(stroke.points);
        return `<path d="${path}" fill="${stroke.closed ? 'rgba(15, 23, 42, 0.08)' : 'none'}" stroke="${stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round" />`;
      })
      .join('');
  }, []);

  const exportSvg = useCallback(() => {
    const content = `\n      <svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">\n        ${toSvgContent(strokes)}\n      </svg>\n    `;

    const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sketch-cad.svg';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [strokes, toSvgContent]);

  const exportGLTF = useCallback(() => {
    // Build a scene with extruded shapes from closed strokes
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.2, roughness: 0.8 });

    strokes.forEach((stroke) => {
      if (!stroke.closed) return;
      const shape = buildClosedShape(stroke);
      if (!shape) return;
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: extrudeDepth, bevelEnabled: false });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    });

    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      (result) => {
        let output: Blob;
        if (result instanceof ArrayBuffer) {
          output = new Blob([result], { type: 'model/gltf-binary' });
        } else {
          const text = JSON.stringify(result);
          output = new Blob([text], { type: 'application/json' });
        }

        const url = URL.createObjectURL(output);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.gltf';
        a.click();
        URL.revokeObjectURL(url);
      },
      { binary: false }
    );
  }, [strokes, extrudeDepth]);

  const exportSTL = useCallback(() => {
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial({ color: '#94a3b8' });

    strokes.forEach((stroke) => {
      if (!stroke.closed) return;
      const shape = buildClosedShape(stroke);
      if (!shape) return;
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: extrudeDepth, bevelEnabled: false });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    });

    const exporter = new STLExporter();
    const res = exporter.parse(scene);
    const blob = new Blob([res], { type: 'application/sla' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.stl';
    a.click();
    URL.revokeObjectURL(url);
  }, [strokes, extrudeDepth]);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {}

    const rect = svgRef.current?.getBoundingClientRect();
    const x = clamp(event.clientX - (rect?.left ?? 0), 0, SVG_WIDTH);
    const y = clamp(event.clientY - (rect?.top ?? 0), 0, SVG_HEIGHT);

    const nextStroke: Stroke = {
      id: Date.now() + Math.random(),
      points: [{ x, y, pressure: event.pressure || 0.5 }],
      color: DEFAULT_COLOR,
      width: 2.5 + (event.pressure || 0.5) * 2.5,
      closed: false,
    };

    setActiveStroke(nextStroke);
    setIsDrawing(true);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || !activeStroke) return;

    const rect = svgRef.current?.getBoundingClientRect();
    const x = clamp(event.clientX - (rect?.left ?? 0), 0, SVG_WIDTH);
    const y = clamp(event.clientY - (rect?.top ?? 0), 0, SVG_HEIGHT);
    const point: Point = { x, y, pressure: event.pressure || 0.5 };

    setActiveStroke((s) => s ? { ...s, points: [...s.points, point], width: 2.5 + (event.pressure || 0.5) * 2.5 } : s);
  };

  const finalizeStroke = () => {
    if (!activeStroke) return;
    const finalStroke = createStrokeFromPoints(activeStroke.points);
    setStrokes((current) => [...current, finalStroke]);
    setActiveStroke(null);
    setIsDrawing(false);
  };

  const handlePointerUp = () => {
    finalizeStroke();
  };

  const handleClear = () => {
    setStrokes([]);
    setActiveStroke(null);
    setIsDrawing(false);
    setSelectedId(null);
  };

  const handleCloseShape = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    const updated = { ...last, closed: true };

    setStrokes((current) => {
      const next = [...current];
      next[next.length - 1] = updated;
      return next;
    });
  };

  const handleSelect = (id: number) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };

  const previewShapes = useMemo(
    () => strokes.filter((stroke) => stroke.points.length >= 3),
    [strokes]
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sketch CAD</p>
          <h1>Diseño 3D desde lápiz óptico</h1>
        </div>

        <div className="actions">
          <button onClick={handleCloseShape}>Cerrar forma</button>
          <button onClick={() => setShow3D((value) => !value)}>{show3D ? 'Ocultar 3D' : 'Vista 3D'}</button>
          <button onClick={exportSvg}>Exportar SVG</button>
          <button onClick={exportGLTF}>Exportar glTF</button>
          <button onClick={exportSTL}>Exportar STL</button>
          <button className="danger" onClick={handleClear}>Borrar</button>
        </div>
      </header>

      <main className="workspace">
        <section className="drawing-panel">
          <svg
            ref={svgRef}
            className="drawing-surface"
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="#f8fafc" />

            <g>
              {strokes.map((stroke) => (
                <path
                  key={stroke.id}
                  d={buildSmoothPath(stroke.points)}
                  fill={stroke.closed ? 'rgba(15, 23, 42, 0.08)' : 'none'}
                  stroke={stroke.color}
                  strokeWidth={stroke.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  onClick={() => handleSelect(stroke.id)}
                  style={{ cursor: 'pointer', opacity: selectedId === stroke.id ? 0.9 : 1 }}
                />
              ))}

              {activeStroke && (
                <path
                  d={buildSmoothPath(activeStroke.points)}
                  fill="none"
                  stroke={DEFAULT_COLOR}
                  strokeWidth={activeStroke.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.9}
                />
              )}
            </g>
          </svg>
        </section>

        {show3D && (
          <aside className="viewer-panel">
            <h2>Vista 3D</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>Profundidad extrusión</label>
              <input type="range" min={0.05} max={2} step={0.05} value={extrudeDepth} onChange={(e) => setExtrudeDepth(parseFloat(e.target.value))} />
              <span style={{ fontSize: 12 }}>{extrudeDepth.toFixed(2)} u</span>
            </div>

            <div className="viewer-frame">
              <Canvas camera={{ position: [0, 1.5, 5], fov: 45 }}>
                <ambientLight intensity={1.2} />
                <directionalLight position={[3, 5, 2]} intensity={1.6} />
                <group rotation={[-0.4, 0.2, 0]}>
                  {previewShapes.map((stroke) => {
                    const shape = strokeToShape(stroke);
                    if (!shape) return null;
                    const isSelected = selectedId === stroke.id;
                    return (
                      <mesh key={stroke.id} position={[-1.2, 0, -0.5]} onClick={() => handleSelect(stroke.id)}>
                        <extrudeGeometry
                          args={[
                            shape,
                            {
                              depth: isSelected ? extrudeDepth : extrudeDepth,
                              bevelEnabled: false,
                              steps: 1,
                            },
                          ]}
                        />
                        <meshStandardMaterial color={isSelected ? '#3b82f6' : '#94a3b8'} metalness={0.2} roughness={0.8} />
                      </mesh>
                    );
                  })}
                </group>

                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, 0]} receiveShadow>
                  <planeGeometry args={[10, 10]} />
                  <meshStandardMaterial color="#e2e8f0" />
                </mesh>

                <OrbitControls enablePan enableZoom enableRotate />
              </Canvas>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
