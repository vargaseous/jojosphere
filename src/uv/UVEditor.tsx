import React, { useMemo, useRef, useState } from 'react';
import { Scene, Shape, Vec2, createId, normalizeRect } from '../model/scene';

type Tool = 'select' | 'line' | 'rect' | 'circle';

interface UVEditorProps {
  scene: Scene;
  onAddShape: (shape: Shape) => void;
  selectedId: string | null;
  onSelectShape: (id: string | null) => void;
  onStartShapeTransform: () => void;
  onTransformShape: (id: string, shape: Shape) => void;
  showGuides: boolean;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function svgPointToUV(event: React.PointerEvent<Element>, svg: SVGSVGElement): Vec2 {
  return clientToUV(svg, event.clientX, event.clientY);
}

function distance(a: Vec2, b: Vec2): number {
  const du = a.u - b.u;
  const dv = a.v - b.v;
  return Math.hypot(du, dv);
}

function clientToUV(svg: SVGSVGElement, clientX: number, clientY: number): Vec2 {
  const bounds = svg.getBoundingClientRect();
  const u = clamp01((clientX - bounds.left) / bounds.width);
  const v = clamp01((clientY - bounds.top) / bounds.height);
  return { u, v };
}

function shapeBounds(shape: Shape): { minU: number; maxU: number; minV: number; maxV: number } {
  if (shape.type === 'line') {
    const minU = Math.min(shape.a.u, shape.b.u);
    const maxU = Math.max(shape.a.u, shape.b.u);
    const minV = Math.min(shape.a.v, shape.b.v);
    const maxV = Math.max(shape.a.v, shape.b.v);
    return { minU, maxU, minV, maxV };
  }
  if (shape.type === 'rect') {
    return {
      minU: shape.origin.u,
      maxU: shape.origin.u + shape.size.w,
      minV: shape.origin.v,
      maxV: shape.origin.v + shape.size.h,
    };
  }
  return {
    minU: shape.center.u - shape.radius,
    maxU: shape.center.u + shape.radius,
    minV: shape.center.v - shape.radius,
    maxV: shape.center.v + shape.radius,
  };
}

export const UVEditor: React.FC<UVEditorProps> = ({
  scene,
  onAddShape,
  selectedId,
  onSelectShape,
  onStartShapeTransform,
  onTransformShape,
  showGuides,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('line');
  const [dragStart, setDragStart] = useState<Vec2 | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Vec2 | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [movingStart, setMovingStart] = useState<Vec2 | null>(null);
  const [movingSnapshot, setMovingSnapshot] = useState<Shape | null>(null);

  const selectedShape = useMemo(() => {
    if (!selectedId) return null;
    return scene.shapes.find((s) => s.id === selectedId) ?? null;
  }, [scene.shapes, selectedId]);

  const selectionBox = useMemo(() => {
    if (!selectedShape) return null;
    const { minU, maxU, minV, maxV } = shapeBounds(selectedShape);
    const padding = 0.005;
    return {
      x: minU - padding,
      y: minV - padding,
      w: maxU - minU + padding * 2,
      h: maxV - minV + padding * 2,
    };
  }, [selectedShape]);

  const previewShape = useMemo(() => {
    if (!dragStart || !dragCurrent) return null;
    if (activeTool === 'line') {
      return { type: 'line', a: dragStart, b: dragCurrent } as const;
    }
    if (activeTool === 'rect') {
      return { type: 'rect', a: dragStart, b: dragCurrent } as const;
    }
    if (activeTool === 'circle') {
      return { type: 'circle', center: dragStart, radius: distance(dragStart, dragCurrent) } as const;
    }
    return null;
  }, [activeTool, dragCurrent, dragStart]);

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (movingId) return;
    if (activeTool === 'select') {
      onSelectShape(null);
      return;
    }
    if (!svgRef.current) return;
    const uv = svgPointToUV(event, svgRef.current);
    setDragStart(uv);
    setDragCurrent(uv);
    svgRef.current.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const uv = svgPointToUV(event, svgRef.current);

    if (movingId && movingSnapshot && movingStart) {
      const du = uv.u - movingStart.u;
      const dv = uv.v - movingStart.v;
      const updated: Shape =
        movingSnapshot.type === 'line'
          ? {
              ...movingSnapshot,
              a: { u: movingSnapshot.a.u + du, v: movingSnapshot.a.v + dv },
              b: { u: movingSnapshot.b.u + du, v: movingSnapshot.b.v + dv },
            }
          : movingSnapshot.type === 'rect'
            ? {
                ...movingSnapshot,
                origin: { u: movingSnapshot.origin.u + du, v: movingSnapshot.origin.v + dv },
              }
            : {
                ...movingSnapshot,
                center: { u: movingSnapshot.center.u + du, v: movingSnapshot.center.v + dv },
              };
      onTransformShape(movingId, updated);
      return;
    }

    if (!dragStart || activeTool === 'select') return;
    setDragCurrent(uv);
  };

  const resetDrag = () => {
    setDragStart(null);
    setDragCurrent(null);
  };

  const resetMove = () => {
    setMovingId(null);
    setMovingStart(null);
    setMovingSnapshot(null);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const uv = svgPointToUV(event, svgRef.current);

    if (movingId) {
      resetMove();
      return;
    }

    if (!dragStart || activeTool === 'select') return;
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
    } else if (activeTool === 'circle') {
      const radius = distance(dragStart, uv);
      const shape: Shape = {
        id: createId('circle'),
        type: 'circle',
        center: dragStart,
        radius,
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
          {(['select', 'line', 'rect', 'circle'] as Tool[]).map((tool) => (
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

          {showGuides &&
            Array.from({ length: 9 }).map((_, idx) => {
              const t = idx / 8;
              return (
                <g key={idx} stroke="#eaeaea" strokeWidth={0.0007}>
                  <line x1={t} y1={0} x2={t} y2={1} />
                  <line x1={0} y1={t} x2={1} y2={t} />
                </g>
              );
            })}

          {scene.shapes.map((shape) => {
            if (shape.type === 'line') {
              return (
                <g key={shape.id}>
                  <line
                    x1={shape.a.u}
                    y1={shape.a.v}
                    x2={shape.b.u}
                    y2={shape.b.v}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    strokeLinecap="round"
                    className={selectedId === shape.id ? 'selected-shape' : ''}
                  />
                  <line
                    x1={shape.a.u}
                    y1={shape.a.v}
                    x2={shape.b.u}
                    y2={shape.b.v}
                    stroke="transparent"
                    strokeWidth={0.02}
                    strokeLinecap="round"
                    pointerEvents="stroke"
                    onPointerDown={(e) => {
                      if (activeTool !== 'select') return;
                      e.stopPropagation();
                    onSelectShape(shape.id);
                    onStartShapeTransform();
                    setMovingId(shape.id);
                    setMovingStart(svgPointToUV(e, svgRef.current!));
                    setMovingSnapshot(shape);
                    svgRef.current?.setPointerCapture(e.pointerId);
                  }}
                />
              </g>
            );
          }
            if (shape.type === 'rect') {
              return (
                <g key={shape.id}>
                  <rect
                    x={shape.origin.u}
                    y={shape.origin.v}
                    width={shape.size.w}
                    height={shape.size.h}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    fill={shape.fill ?? 'none'}
                    className={selectedId === shape.id ? 'selected-shape' : ''}
                  />
                  <rect
                    x={shape.origin.u}
                    y={shape.origin.v}
                    width={shape.size.w}
                    height={shape.size.h}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={0.02}
                    pointerEvents="all"
                    onPointerDown={(e) => {
                      if (activeTool !== 'select') return;
                      e.stopPropagation();
                    onSelectShape(shape.id);
                    onStartShapeTransform();
                    setMovingId(shape.id);
                    setMovingStart(svgPointToUV(e, svgRef.current!));
                    setMovingSnapshot(shape);
                    svgRef.current?.setPointerCapture(e.pointerId);
                  }}
                />
              </g>
            );
          }
            return (
              <g key={shape.id}>
                <circle
                  cx={shape.center.u}
                  cy={shape.center.v}
                  r={shape.radius}
                  stroke={shape.stroke}
                  strokeWidth={shape.strokeWidth}
                  fill={shape.fill ?? 'none'}
                  className={selectedId === shape.id ? 'selected-shape' : ''}
                />
                <circle
                  cx={shape.center.u}
                  cy={shape.center.v}
                  r={shape.radius}
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth={0.02}
                  pointerEvents="all"
                  onPointerDown={(e) => {
                    if (activeTool !== 'select') return;
                    e.stopPropagation();
                  onSelectShape(shape.id);
                  onStartShapeTransform();
                  setMovingId(shape.id);
                  setMovingStart(svgPointToUV(e, svgRef.current!));
                  setMovingSnapshot(shape);
                  svgRef.current?.setPointerCapture(e.pointerId);
                }}
              />
            </g>
          );
          })}

          {selectionBox && (
            <rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.w}
              height={selectionBox.h}
              className="selection-box"
              fill="none"
              strokeWidth={0.002}
              strokeDasharray="0.01 0.01"
              onPointerDown={(e) => {
                if (activeTool !== 'select' || !selectedShape) return;
                e.stopPropagation();
                onStartShapeTransform();
                setMovingId(selectedShape.id);
                setMovingStart(svgPointToUV(e, svgRef.current!));
                setMovingSnapshot(selectedShape);
                svgRef.current?.setPointerCapture(e.pointerId);
              }}
            />
          )}

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

          {previewShape && previewShape.type === 'circle' && (
            <circle
              cx={previewShape.center.u}
              cy={previewShape.center.v}
              r={previewShape.radius}
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
