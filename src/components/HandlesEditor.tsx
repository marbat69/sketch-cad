import React, { useRef, useState } from 'react';

type Point = { x: number; y: number; pressure?: number };

type Props = {
  svgRef: React.RefObject<SVGSVGElement | null>;
  stroke: { id: number; points: Point[] } | null;
  onUpdate: (points: Point[]) => void;
};

export default function HandlesEditor({ svgRef, stroke, onUpdate }: Props) {
  const dragging = useRef<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!stroke) return null;

  const handlePointerDown = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    const target = e.target as Element;
    try { target.setPointerCapture(e.pointerId); } catch {}
    dragging.current = idx;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging.current === null) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
    onUpdate(
      stroke.points.map((p, i) => (i === dragging.current ? { ...p, x, y } : p))
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragging.current === null) return;
    const target = e.target as Element;
    try { target.releasePointerCapture(e.pointerId); } catch {}
    dragging.current = null;
  };

  return (
    <g onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
      {stroke.points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={8}
            fill={hoverIndex === i ? '#2563eb' : '#60a5fa'}
            stroke="#0f172a"
            strokeWidth={1}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => handlePointerDown(e, i)}
            onPointerEnter={() => setHoverIndex(i)}
            onPointerLeave={() => setHoverIndex(null)}
          />
        </g>
      ))}
    </g>
  );
}
