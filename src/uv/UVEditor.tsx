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
  showGradient: boolean;
  showDots: boolean;
  selectedShape: Shape | null;
  strokeInput: string;
  fillInput: string;
  onStrokeChange: (value: string) => void;
  onFillChange: (value: string) => void;
  onDeleteSelected: () => void;
}

type HandleKind = 'move' | 'rect' | 'circle' | 'line-start' | 'line-end';

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

function rectHandles(shape: Extract<Shape, { type: 'rect' }>): Vec2[] {
  const corners: Vec2[] = [
    { u: shape.origin.u, v: shape.origin.v },
    { u: shape.origin.u + shape.size.w, v: shape.origin.v },
    { u: shape.origin.u + shape.size.w, v: shape.origin.v + shape.size.h },
    { u: shape.origin.u, v: shape.origin.v + shape.size.h },
  ];
  return corners;
}

function circleHandle(shape: Extract<Shape, { type: 'circle' }>): Vec2 {
  return { u: shape.center.u + shape.radius, v: shape.center.v };
}

function lineHandles(shape: Extract<Shape, { type: 'line' }>): { start: Vec2; end: Vec2 } {
  return { start: shape.a, end: shape.b };
}

function moveShape(shape: Shape, du: number, dv: number): Shape {
  if (shape.type === 'line') {
    return {
      ...shape,
      a: { u: shape.a.u + du, v: shape.a.v + dv },
      b: { u: shape.b.u + du, v: shape.b.v + dv },
    };
  }
  if (shape.type === 'rect') {
    return {
      ...shape,
      origin: { u: shape.origin.u + du, v: shape.origin.v + dv },
    };
  }
  return {
    ...shape,
    center: { u: shape.center.u + du, v: shape.center.v + dv },
  };
}

function cornerColor(u: number, v: number): string {
  const c00 = { r: 255, g: 0, b: 0 }; // top-left
  const c10 = { r: 0, g: 255, b: 0 }; // top-right
  const c01 = { r: 0, g: 0, b: 255 }; // bottom-left
  const c11 = { r: 255, g: 255, b: 0 }; // bottom-right
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const r = lerp(lerp(c00.r, c10.r, u), lerp(c01.r, c11.r, u), v);
  const g = lerp(lerp(c00.g, c10.g, u), lerp(c01.g, c11.g, u), v);
  const b = lerp(lerp(c00.b, c10.b, u), lerp(c01.b, c11.b, u), v);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export const UVEditor: React.FC<UVEditorProps> = ({
  scene,
  onAddShape,
  selectedId,
  onSelectShape,
  onStartShapeTransform,
  onTransformShape,
  showGuides,
  showGradient,
  showDots,
  selectedShape,
  strokeInput,
  fillInput,
  onStrokeChange,
  onFillChange,
  onDeleteSelected,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('line');
  const [dragStart, setDragStart] = useState<Vec2 | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Vec2 | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [movingStart, setMovingStart] = useState<Vec2 | null>(null);
  const [movingSnapshot, setMovingSnapshot] = useState<Shape | null>(null);
  const [activeHandle, setActiveHandle] = useState<HandleKind>('move');

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

  const gradientCells = useMemo(() => {
    if (!showGradient) return [];
    const divs = 18;
    const cells: { u: number; v: number; w: number; h: number; color: string }[] = [];
    for (let i = 0; i < divs; i += 1) {
      for (let j = 0; j < divs; j += 1) {
        const u0 = i / divs;
        const v0 = j / divs;
        const u1 = (i + 1) / divs;
        const v1 = (j + 1) / divs;
        const color = cornerColor((u0 + u1) / 2, (v0 + v1) / 2);
        cells.push({ u: u0, v: v0, w: u1 - u0, h: v1 - v0, color });
      }
    }
    return cells;
  }, [showGradient]);

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
      let updated: Shape = movingSnapshot;

      if (activeHandle === 'move') {
        updated = moveShape(movingSnapshot, du, dv);
      } else if (activeHandle === 'rect' && movingSnapshot.type === 'rect') {
        const { origin, size } = movingSnapshot;
        const newW = Math.max(0.001, size.w + du);
        const newH = Math.max(0.001, size.h + dv);
        updated = { ...movingSnapshot, size: { w: newW, h: newH } };
      } else if (activeHandle === 'circle' && movingSnapshot.type === 'circle') {
        const radius = Math.max(0.001, movingSnapshot.radius + du); // assume drag mainly horizontal
        updated = { ...movingSnapshot, radius };
      } else if (activeHandle === 'line-start' && movingSnapshot.type === 'line') {
        updated = { ...movingSnapshot, a: { u: movingSnapshot.a.u + du, v: movingSnapshot.a.v + dv } };
      } else if (activeHandle === 'line-end' && movingSnapshot.type === 'line') {
        updated = { ...movingSnapshot, b: { u: movingSnapshot.b.u + du, v: movingSnapshot.b.v + dv } };
      }

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
      setActiveHandle('move');
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
        <div className="color-controls">
          {selectedShape ? (
            <>
              <span>Selected: {selectedShape.type}</span>
              <label>
                Stroke
                <input
                  type="color"
                  value={strokeInput}
                  onChange={(e) => onStrokeChange(e.target.value)}
                />
              </label>
              <label>
                Fill
                <input
                  type="color"
                  value={fillInput}
                  disabled={selectedShape.type === 'line'}
                  onChange={(e) => onFillChange(e.target.value)}
                />
              </label>
              <button type="button" className="secondary-button" onClick={onDeleteSelected}>
                Delete
              </button>
            </>
          ) : (
            <span>No selection</span>
          )}
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
          <rect
            x={0}
            y={0}
            width={1}
            height={1}
            fill="#ffffff"
            stroke="#cccccc"
            strokeWidth={0.002}
          />

          {showGradient && (
            <g opacity={0.35}>
              {gradientCells.map((cell, idx) => (
                <rect key={`grad-${idx}`} x={cell.u} y={cell.v} width={cell.w} height={cell.h} fill={cell.color} stroke="none" />
              ))}
            </g>
          )}

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

          {showDots &&
            Array.from({ length: 9 }).map((_, row) =>
              Array.from({ length: 9 }).map((_, col) => {
                const u = col / 8;
                const v = row / 8;
                const color = cornerColor(u, v);
                return <circle key={`dot-${row}-${col}`} cx={u} cy={v} r={0.0025} fill={color} />;
              }),
            )}

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

          {selectedShape && activeTool === 'select' && (
            <g className="handles">
              {selectedShape.type === 'rect' &&
                rectHandles(selectedShape).map((pt, idx) => (
                  <circle
                    key={`rect-h-${idx}`}
                    cx={pt.u}
                    cy={pt.v}
                    r={0.008}
                    fill="#ffffff"
                    stroke="#2d68ff"
                    strokeWidth={0.0015}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onStartShapeTransform();
                      setMovingId(selectedShape.id);
                      setMovingStart(svgPointToUV(e, svgRef.current!));
                      setMovingSnapshot(selectedShape);
                      setActiveHandle('rect');
                      svgRef.current?.setPointerCapture(e.pointerId);
                    }}
                  />
                ))}
              {selectedShape.type === 'circle' && (
                <circle
                  cx={circleHandle(selectedShape).u}
                  cy={circleHandle(selectedShape).v}
                  r={0.008}
                  fill="#ffffff"
                  stroke="#2d68ff"
                  strokeWidth={0.0015}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onStartShapeTransform();
                    setMovingId(selectedShape.id);
                    setMovingStart(svgPointToUV(e, svgRef.current!));
                    setMovingSnapshot(selectedShape);
                    setActiveHandle('circle');
                    svgRef.current?.setPointerCapture(e.pointerId);
                  }}
                />
              )}
              {selectedShape.type === 'line' && (
                <>
                  <circle
                    cx={lineHandles(selectedShape).start.u}
                    cy={lineHandles(selectedShape).start.v}
                    r={0.008}
                    fill="#ffffff"
                    stroke="#2d68ff"
                    strokeWidth={0.0015}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onStartShapeTransform();
                      setMovingId(selectedShape.id);
                      setMovingStart(svgPointToUV(e, svgRef.current!));
                      setMovingSnapshot(selectedShape);
                      setActiveHandle('line-start');
                      svgRef.current?.setPointerCapture(e.pointerId);
                    }}
                  />
                  <circle
                    cx={lineHandles(selectedShape).end.u}
                    cy={lineHandles(selectedShape).end.v}
                    r={0.008}
                    fill="#ffffff"
                    stroke="#2d68ff"
                    strokeWidth={0.0015}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onStartShapeTransform();
                      setMovingId(selectedShape.id);
                      setMovingStart(svgPointToUV(e, svgRef.current!));
                      setMovingSnapshot(selectedShape);
                      setActiveHandle('line-end');
                      svgRef.current?.setPointerCapture(e.pointerId);
                    }}
                  />
                </>
              )}
            </g>
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
