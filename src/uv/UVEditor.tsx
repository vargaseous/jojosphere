import React, { useMemo, useRef, useState } from 'react';
import { Scene, Shape, createId, normalizeRect, Vec2 } from '../model/scene';

type Tool = 'select' | 'line' | 'rect';

interface UVEditorProps {
  scene: Scene;
  onAddShape: (shape: Shape) => void;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function svgPointToUV(event: React.PointerEvent<SVGSVGElement>, svg: SVGSVGElement): Vec2 {
  const bounds = svg.getBoundingClientRect();
  const u = clamp01((event.clientX - bounds.left) / bounds.width);
  const v = clamp01((event.clientY - bounds.top) / bounds.height);
  return { u, v };
}

export const UVEditor: React.FC<UVEditorProps> = ({ scene, onAddShape }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('line');
  const [dragStart, setDragStart] = useState<Vec2 | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Vec2 | null>(null);

  const previewShape = useMemo(() => {
    if (!dragStart || !dragCurrent) return null;
    if (activeTool === 'line') {
      return { type: 'line', a: dragStart, b: dragCurrent } as const;
    }
    if (activeTool === 'rect') {
      return { type: 'rect', a: dragStart, b: dragCurrent } as const;
    }
    return null;
  }, [activeTool, dragCurrent, dragStart]);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activeTool === 'select') return;
    if (!svgRef.current) return;
    const uv = svgPointToUV(event, svgRef.current);
    setDragStart(uv);
    setDragCurrent(uv);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStart || activeTool === 'select') return;
    if (!svgRef.current) return;
    const uv = svgPointToUV(event, svgRef.current);
    setDragCurrent(uv);
  };

  const resetDrag = () => {
    setDragStart(null);
    setDragCurrent(null);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStart || activeTool === 'select') return;
    if (!svgRef.current) return;
    const uv = svgPointToUV(event, svgRef.current);
    setDragCurrent(uv);

    if (activeTool === 'line') {
      const shape: Shape = {
        id: createId('line'),
        type: 'line',
        a: dragStart,
        b: uv,
        stroke: '#000000',
        strokeWidth: 0.002,
      };
      onAddShape(shape);
    } else if (activeTool === 'rect') {
      const { origin, size } = normalizeRect(dragStart, uv);
      const shape: Shape = {
        id: createId('rect'),
        type: 'rect',
        origin,
        size,
        stroke: '#000000',
        strokeWidth: 0.002,
        fill: '#e5e5e5',
      };
      onAddShape(shape);
    }

    resetDrag();
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span>UV Editor</span>
        <div className="tool-buttons">
          {(['select', 'line', 'rect'] as Tool[]).map((tool) => (
            <button
              key={tool}
              type="button"
              className={`tool-button ${activeTool === tool ? 'active' : ''}`}
              onClick={() => setActiveTool(tool)}
            >
              {tool.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="panel-body">
        <svg
          ref={svgRef}
          viewBox="0 0 1 1"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={resetDrag}
        >
          <rect x={0} y={0} width={1} height={1} fill="#ffffff" stroke="#cccccc" strokeWidth={0.002} />

          {scene.shapes.map((shape) => {
            if (shape.type === 'line') {
              return (
                <line
                  key={shape.id}
                  x1={shape.a.u}
                  y1={shape.a.v}
                  x2={shape.b.u}
                  y2={shape.b.v}
                  stroke={shape.stroke}
                  strokeWidth={shape.strokeWidth}
                  strokeLinecap="round"
                />
              );
            }
            return (
              <rect
                key={shape.id}
                x={shape.origin.u}
                y={shape.origin.v}
                width={shape.size.w}
                height={shape.size.h}
                stroke={shape.stroke}
                strokeWidth={shape.strokeWidth}
                fill={shape.fill ?? 'none'}
              />
            );
          })}

          {previewShape && previewShape.type === 'line' && (
            <line
              x1={previewShape.a.u}
              y1={previewShape.a.v}
              x2={previewShape.b.u}
              y2={previewShape.b.v}
              stroke="#2d68ff"
              strokeWidth={0.002}
              strokeDasharray="0.01 0.01"
            />
          )}

          {previewShape && previewShape.type === 'rect' && (
            <rect
              x={Math.min(previewShape.a.u, previewShape.b.u)}
              y={Math.min(previewShape.a.v, previewShape.b.v)}
              width={Math.abs(previewShape.b.u - previewShape.a.u)}
              height={Math.abs(previewShape.b.v - previewShape.a.v)}
              stroke="#2d68ff"
              strokeWidth={0.002}
              fill="rgba(45, 104, 255, 0.1)"
              strokeDasharray="0.01 0.01"
            />
          )}
        </svg>
      </div>
    </div>
  );
};
