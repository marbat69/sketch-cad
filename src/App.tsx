import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';

import HandlesEditor from './components/HandlesEditor';
import { detectPrimitives } from './geometry/detectPrimitives';
import { buildSmoothPath, createStrokeFromPoints } from './hooks/useStrokeUtils';
import { PrimitiveEntity, lineToPoints, circleToPoints } from './models/primitives';

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

export default function App() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [entities, setEntities] = useState<PrimitiveEntity[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [extrudeDepth, setExtrudeDepth] = useState(0.35);
  const [history, setHistory] = useState<Stroke[][]>([]);

  const pushHistory = useCallback((next: Stroke[]) => {
    setHistory((h) => {
      const copy = h.slice(-49); // keep up to 50
      copy.push(next.map(s => ({ ...s, points: s.points.slice() })));
      return copy;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const copy = h.slice();
      const last = copy.pop()!;
      setStrokes(last.map(s => ({ ...s, points: s.points.slice() })));
      return copy;
    });
  }, []);

  const strokeToShape = useCallback((stroke: Stroke) => {
    if (stroke.points.length < 3) return null;
    const shape = new THREE.Shape();
    const first = stroke.points[0];
    shape.moveTo(first.x, first.y);
    for (let i = 1; i < stroke.points.length; i += 1) {
      const point = stroke.points[i];
      shape.lineTo(point.x, point.y);
    }
    if (stroke.closed) shape.closePath();
    return shape;
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
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.2, roughness: 0.8 });

    strokes.forEach((stroke) => {
      if (!stroke.closed) return;
      const shape = strokeToShape(stroke);
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
  }, [strokes, extrudeDepth, strokeToShape]);

  const exportSTL = useCallback(() => {
    const scene = new THREE.Scene();
    const material = new THREE.MeshStandardMaterial({ color: '#94a3b8' });

    strokes.forEach((stroke) => {
      if (!stroke.closed) return;
      const shape = strokeToShape(stroke);
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
  }, [strokes, extrudeDepth, strokeToShape]);

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
    pushHistory(strokes);
    setStrokes((current) => [...current, finalStroke]);
    setActiveStroke(null);
    setIsDrawing(false);
  };

  const handlePointerUp = () => {
    finalizeStroke();
  };

  const handleClear = () => {
    pushHistory(strokes);
    setStrokes([]);
    setActiveStroke(null);
    setIsDrawing(false);
    setSelectedId(null);
    setEntities([]);
  };

  const handleCloseShape = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    const updated = { ...last, closed: true };

    pushHistory(strokes);
    setStrokes((current) => {
      const next = [...current];
      next[next.length - 1] = updated;
      return next;
    });
  };

  const handleSelect = (id: number) => {
    setSelectedId((cur) => (cur === id ? null : id));
  };

  const handleUpdatePoints = (points: Point[]) => {
    if (selectedId === null) return;
    pushHistory(strokes);
    setStrokes((current) => current.map(s => s.id === selectedId ? { ...s, points } : s));

    // If selection has an entity, synchronize its params
    const ent = entities.find(e => e.id === selectedId);
    if (ent) {
      if (ent.type === 'line') {
        const [p1, p2] = lineToPoints(ent as any);
        // no-op here; better synchronize from stroke to entity if needed
      }
    }
  };

  const handleConvertSelected = () => {
    if (selectedId === null) return;
    const stroke = strokes.find(s => s.id === selectedId);
    if (!stroke) return;

    const prim = detectPrimitives(stroke.points);
    if (prim.type === 'none') {
      alert('No se detectó una primitiva clara');
      return;
    }

    pushHistory(strokes);

    if (prim.type === 'line') {
      const p1 = prim.p1;
      const p2 = prim.p2;
      const entity: PrimitiveEntity = {
        id: selectedId,
        type: 'line',
        p1: { x: p1.x, y: p1.y },
        p2: { x: p2.x, y: p2.y },
        color: stroke.color,
        width: stroke.width,
      };
      setEntities((cur) => [...cur.filter(e => e.id !== selectedId), entity]);
      const pts = lineToPoints(entity);
      const newStroke = createStrokeFromPoints(pts as any);
      setStrokes((cur) => cur.map(s => s.id === selectedId ? { ...newStroke, id: s.id, color: s.color, width: s.width } : s));
      return;
    }

    if (prim.type === 'circle') {
      const { cx, cy, r } = prim;
      const entity: PrimitiveEntity = {
        id: selectedId,
        type: 'circle',
        cx,
        cy,
        r,
        color: stroke.color,
        width: stroke.width,
      } as PrimitiveEntity;
      setEntities((cur) => [...cur.filter(e => e.id !== selectedId), entity]);
      const pts = circleToPoints(entity as any, 64);
      const newStroke = createStrokeFromPoints(pts as any);
      setStrokes((cur) => cur.map(s => s.id === selectedId ? { ...newStroke, id: s.id, color: s.color, width: s.width, closed: true } : s));
      return;
    }
  };

  const updateEntityParams = (id: number, patch: Partial<PrimitiveEntity>) => {
    setEntities((cur) => cur.map(e => e.id === id ? { ...e, ...patch } as PrimitiveEntity : e));
    // regenerate stroke from entity
    const ent = entities.find(e => e.id === id);
    if (!ent) return;
    if (ent.type === 'line') {
      const pts = lineToPoints(ent as any);
      const newStroke = createStrokeFromPoints(pts as any);
      setStrokes((cur) => cur.map(s => s.id === id ? { ...newStroke, id: s.id, color: (ent as any).color ?? s.color, width: (ent as any).width ?? s.width } : s));
    }
    if (ent.type === 'circle') {
      const pts = circleToPoints(ent as any, 64);
      const newStroke = createStrokeFromPoints(pts as any);
      setStrokes((cur) => cur.map(s => s.id === id ? { ...newStroke, id: s.id, color: (ent as any).color ?? s.color, width: (ent as any).width ?? s.width, closed: true } : s));
    }
  };

  const previewShapes = useMemo(
    () => strokes.filter((stroke) => stroke.points.length >= 3),
    [strokes]
  );

  const selectedEntity = selectedId ? entities.find(e => e.id === selectedId) ?? null : null;

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
          <button onClick={undo}>Undo</button>
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

              {/* Handles editor overlay for selected stroke */}
              {selectedId && (
                (() => {
                  const s = strokes.find(st => st.id === selectedId);
                  return s ? <HandlesEditor svgRef={svgRef} stroke={s} onUpdate={handleUpdatePoints} /> : null;
                })()
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

            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <button onClick={handleConvertSelected}>Convertir a primitiva</button>
              <button onClick={() => { setShow3D(true); }}>Forzar recompute</button>
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

        {/* Right-side editing panel (mobile collapses) */}
        <aside style={{ minWidth: 260, padding: 16 }}>
          <h3>Editor</h3>
          <p>Seleccionado: {selectedId ?? 'ninguno'}</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={undo} disabled={history.length === 0}>Undo</button>
            <button onClick={() => { pushHistory(strokes); setStrokes(strokes.map(s => ({ ...s })) ); }}>Snapshot</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <button onClick={handleConvertSelected} disabled={selectedId === null}>Convertir a primitiva</button>
          </div>

          <div style={{ marginTop: 12, fontSize: 13, color: '#475569' }}>
            <p><strong>Consejo:</strong> dibuja aproximadamente líneas o círculos para que la detección funcione mejor.</p>
            <p>Los umbrales se pueden ajustar en <code>src/geometry/detectPrimitives.ts</code>.</p>
          </div>

          {selectedEntity && (
            <div style={{ marginTop: 12 }}>
              <h4>Propiedades de la primitiva</h4>
              {selectedEntity.type === 'line' && (
                <div>
                  <label>Endpoint A</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" value={(selectedEntity as any).p1.x} onChange={(e) => updateEntityParams(selectedEntity.id, { p1: { ...(selectedEntity as any).p1, x: parseFloat(e.target.value) } } as any)} />
                    <input type="number" value={(selectedEntity as any).p1.y} onChange={(e) => updateEntityParams(selectedEntity.id, { p1: { ...(selectedEntity as any).p1, y: parseFloat(e.target.value) } } as any)} />
                  </div>

                  <label>Endpoint B</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" value={(selectedEntity as any).p2.x} onChange={(e) => updateEntityParams(selectedEntity.id, { p2: { ...(selectedEntity as any).p2, x: parseFloat(e.target.value) } } as any)} />
                    <input type="number" value={(selectedEntity as any).p2.y} onChange={(e) => updateEntityParams(selectedEntity.id, { p2: { ...(selectedEntity as any).p2, y: parseFloat(e.target.value) } } as any)} />
                  </div>
                </div>
              )}

              {selectedEntity.type === 'circle' && (
                <div>
                  <label>Centro</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" value={(selectedEntity as any).cx} onChange={(e) => updateEntityParams(selectedEntity.id, { cx: parseFloat(e.target.value) } as any)} />
                    <input type="number" value={(selectedEntity as any).cy} onChange={(e) => updateEntityParams(selectedEntity.id, { cy: parseFloat(e.target.value) } as any)} />
                  </div>

                  <label>Radio</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" value={(selectedEntity as any).r} onChange={(e) => updateEntityParams(selectedEntity.id, { r: parseFloat(e.target.value) } as any)} />
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
