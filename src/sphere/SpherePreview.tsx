import React, { useMemo } from 'react';
import { Scene } from '../model/scene';
import { ProjectionType, Rotation, UvOrientation, projectShapeToXY, uvPointToXY } from '../geometry/projection';

interface SpherePreviewProps {
  scene: Scene;
  rotation: Rotation;
  showGuides: boolean;
  showGradient: boolean;
  showDots: boolean;
  projectionType: ProjectionType;
  orientation?: UvOrientation;
  transparentSphere: boolean;
  fadeBackfaces: boolean;
  onToggleGuides: (next: boolean) => void;
  onToggleGradient: (next: boolean) => void;
  onToggleDots: (next: boolean) => void;
  onToggleTransparentSphere: (next: boolean) => void;
  onToggleFadeBackfaces: (next: boolean) => void;
}

function ensureClosed(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (!points.length) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) {
    return points;
  }
  return [...points, first];
}

function formatPoints(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

function buildGuideLines(rotation: Rotation, scheme: ProjectionType, orientation?: UvOrientation, includeBackFaces = false): string[] {
  const divisions = 8;
  const steps = 64;
  const lines: string[] = [];

  for (let i = 1; i < divisions; i += 1) {
    const uConst = i / divisions;
    const vConst = i / divisions;
    const meridian: { x: number; y: number }[] = [];
    const parallel: { x: number; y: number }[] = [];

    for (let j = 0; j <= steps; j += 1) {
      const t = j / steps;
      const meridianPoint = uvPointToXY({ u: uConst, v: t }, rotation, scheme, orientation, includeBackFaces);
      const parallelPoint = uvPointToXY({ u: t, v: vConst }, rotation, scheme, orientation, includeBackFaces);
      if (meridianPoint) meridian.push(meridianPoint);
      if (parallelPoint) parallel.push(parallelPoint);
    }

    if (meridian.length > 1) {
      lines.push(formatPoints(meridian));
    }
    if (parallel.length > 1) {
      lines.push(formatPoints(parallel));
    }
  }

  return lines;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function cornerColor(u: number, v: number): string {
  const c00 = { r: 255, g: 0, b: 0 };
  const c10 = { r: 0, g: 255, b: 0 };
  const c01 = { r: 0, g: 0, b: 255 };
  const c11 = { r: 255, g: 255, b: 0 };
  const r = lerp(lerp(c00.r, c10.r, u), lerp(c01.r, c11.r, u), v);
  const g = lerp(lerp(c00.g, c10.g, u), lerp(c01.g, c11.g, u), v);
  const b = lerp(lerp(c00.b, c10.b, u), lerp(c01.b, c11.b, u), v);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function buildGradientCells(rotation: Rotation, projectionType: ProjectionType, orientation?: UvOrientation, divisions = 18, includeBackFaces = false): {
  pts: string;
  color: string;
}[] {
  const cells: { pts: string; color: string }[] = [];
  for (let i = 0; i < divisions; i += 1) {
    for (let j = 0; j < divisions; j += 1) {
      const u0 = i / divisions;
      const v0 = j / divisions;
      const u1 = (i + 1) / divisions;
      const v1 = (j + 1) / divisions;
      const corners = [
        { u: u0, v: v0 },
        { u: u1, v: v0 },
        { u: u1, v: v1 },
        { u: u0, v: v1 },
      ];
      const projected = corners.map((c) => uvPointToXY(c, rotation, projectionType, orientation, includeBackFaces));
      if (projected.some((p) => !p)) continue;
      const pts = formatPoints(projected as { x: number; y: number }[]);
      const color = cornerColor((u0 + u1) / 2, (v0 + v1) / 2);
      cells.push({ pts, color });
    }
  }
  return cells;
}

export const SpherePreview: React.FC<SpherePreviewProps> = ({
  scene,
  rotation,
  showGuides,
  showGradient,
  showDots,
  projectionType,
  orientation,
  transparentSphere,
  fadeBackfaces,
  onToggleGuides,
  onToggleGradient,
  onToggleDots,
  onToggleTransparentSphere,
  onToggleFadeBackfaces,
}) => {
  const guideLines = useMemo(
    () => (showGuides ? buildGuideLines(rotation, projectionType, orientation, transparentSphere) : []),
    [rotation, showGuides, projectionType, orientation, transparentSphere],
  );
  const gradientCells = useMemo(
    () => (showGradient ? buildGradientCells(rotation, projectionType, orientation, 18, transparentSphere) : []),
    [rotation, showGradient, projectionType, orientation, transparentSphere],
  );
  const dots = useMemo(() => {
    if (!showDots && !showGradient) return [];
    const divs = 8;
    const points: { x: number; y: number; color: string }[] = [];
    for (let i = 0; i <= divs; i += 1) {
      for (let j = 0; j <= divs; j += 1) {
        const u = i / divs;
        const v = j / divs;
        const proj = uvPointToXY({ u, v }, rotation, projectionType, orientation, transparentSphere);
        if (proj) {
          points.push({ x: proj.x, y: proj.y, color: cornerColor(u, v) });
        }
      }
    }
    return points;
  }, [rotation, showDots, showGradient, projectionType, orientation]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Sphere Preview</span>
        <div className="checkbox-group">
          <label className="checkbox">
            <input type="checkbox" checked={showGuides} onChange={(e) => onToggleGuides(e.target.checked)} />
            Show guides
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={showGradient} onChange={(e) => onToggleGradient(e.target.checked)} />
            Gradient
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={showDots} onChange={(e) => onToggleDots(e.target.checked)} />
            Dots
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={transparentSphere} onChange={(e) => onToggleTransparentSphere(e.target.checked)} />
            Transparent sphere
          </label>
          {transparentSphere && (
            <label className="checkbox">
              <input type="checkbox" checked={fadeBackfaces} onChange={(e) => onToggleFadeBackfaces(e.target.checked)} />
              Fade backside strokes
            </label>
          )}
        </div>
      </div>
      <div className="panel-body">
        <svg viewBox="-1.1 -1.1 2.2 2.2">
          <circle cx={0} cy={0} r={1} fill={transparentSphere ? 'none' : '#fafafa'} stroke="#cccccc" strokeWidth={0.01} />

          {showGradient && (
            <g opacity={0.5}>
              {gradientCells.map((cell, idx) => (
                <polygon key={`grad-${idx}`} points={cell.pts} fill={cell.color} stroke="none" />
              ))}
            </g>
          )}

          {(showGradient || showDots) && (
            <g>
              {dots.map((p, idx) => (
                <circle key={`dot-${idx}`} cx={p.x} cy={p.y} r={0.01} fill={p.color} opacity={showGradient ? 0.7 : 1} />
              ))}
            </g>
          )}

          {showGuides && (
            <g stroke="#e0e0e0" strokeWidth={0.004} fill="none">
              {guideLines.map((points, idx) => (
                <polyline key={`guide-${idx}`} points={points} />
              ))}
            </g>
          )}

          <g>
          {scene.shapes.map((shape) => {
            const sampleDensity = shape.type === 'circle' ? 128 : 96;
            const { points, closed, backPoints } = projectShapeToXY(
              shape,
              rotation,
              sampleDensity,
              projectionType,
              orientation,
              transparentSphere,
              fadeBackfaces,
            );
            if (points.length < 2) return null;
            const stroke = shape.stroke;
            const strokeWidth = shape.strokeWidth * 2; // Slightly thicker for visibility on sphere

              if (closed && shape.type !== 'line' && shape.type !== 'latitude' && shape.type !== 'longitude') {
                const closedPoints = ensureClosed(points);
                const pointString = formatPoints(closedPoints);
                const fill = shape.fill ?? 'none';
                return (
                  <polygon
                    key={shape.id}
                    points={pointString}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              }

              const pointString = formatPoints(points);
              return (
                <>
                  {fadeBackfaces && backPoints && backPoints.length >= 2 && (
                    <polyline
                      key={`${shape.id}-back`}
                      points={formatPoints(backPoints)}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.35}
                    />
                  )}
                  <polyline
                    key={shape.id}
                    points={pointString}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};
