import React, { useMemo } from 'react';
import { Scene } from '../model/scene';
import { Rotation, projectShapeToXY, uvPointToXY } from '../geometry/projection';

interface SpherePreviewProps {
  scene: Scene;
  rotation: Rotation;
  showGuides: boolean;
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

function buildGuideLines(rotation: Rotation): string[] {
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
      const meridianPoint = uvPointToXY({ u: uConst, v: t }, rotation);
      const parallelPoint = uvPointToXY({ u: t, v: vConst }, rotation);
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

export const SpherePreview: React.FC<SpherePreviewProps> = ({ scene, rotation, showGuides }) => {
  const guideLines = useMemo(() => (showGuides ? buildGuideLines(rotation) : []), [rotation, showGuides]);

  return (
    <div className="panel">
      <div className="panel-header">Sphere Preview</div>
      <div className="panel-body">
        <svg viewBox="-1.1 -1.1 2.2 2.2">
          <circle cx={0} cy={0} r={1} fill="#fafafa" stroke="#cccccc" strokeWidth={0.01} />

          {showGuides && (
            <g stroke="#e0e0e0" strokeWidth={0.004} fill="none">
              {guideLines.map((points, idx) => (
                <polyline key={`guide-${idx}`} points={points} />
              ))}
            </g>
          )}

          <g>
            {scene.shapes.map((shape) => {
              const { points, closed } = projectShapeToXY(shape, rotation, 64);
              if (points.length < 2) return null;
              const stroke = shape.stroke;
              const strokeWidth = shape.strokeWidth * 2; // Slightly thicker for visibility on sphere

              if (closed && shape.type !== 'line') {
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
                <polyline
                  key={shape.id}
                  points={pointString}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};
