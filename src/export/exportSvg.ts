import { Scene } from '../model/scene';
import { ProjectionType, Rotation, UvOrientation, projectShapeToXY, uvPointToXY } from '../geometry/projection';

interface ExportOptions {
  showGuides?: boolean;
  orientation?: UvOrientation;
  transparentSphere?: boolean;
  fadeBackfaces?: boolean;
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

function buildGuideLines(rotation: Rotation, projection: ProjectionType, orientation?: UvOrientation, includeBackFaces = false): string[] {
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
      const meridianPoint = uvPointToXY({ u: uConst, v: t }, rotation, projection, orientation, includeBackFaces);
      const parallelPoint = uvPointToXY({ u: t, v: vConst }, rotation, projection, orientation, includeBackFaces);
      if (meridianPoint) meridian.push(meridianPoint);
      if (parallelPoint) parallel.push(parallelPoint);
    }

    if (meridian.length > 1) lines.push(formatPoints(meridian));
    if (parallel.length > 1) lines.push(formatPoints(parallel));
  }

  return lines;
}

export function exportSphereSvg(
  scene: Scene,
  rotation: Rotation,
  options: ExportOptions = {},
  projection: ProjectionType = 'orthographic',
): string {
  const viewBox = '-1.1 -1.1 2.2 2.2';
  const { showGuides = false, orientation, transparentSphere = false, fadeBackfaces = false } = options;

  const guideMarkup = showGuides
    ? buildGuideLines(rotation, projection, orientation, transparentSphere)
        .map(
          (points) =>
            `<polyline points="${points}" fill="none" stroke="#e0e0e0" stroke-width="0.004" stroke-linecap="round" stroke-linejoin="round" />`,
        )
        .join('\n    ')
    : '';

  const shapesMarkup = scene.shapes
    .map((shape) => {
      const sampleDensity = shape.type === 'circle' ? 160 : 120;
      const { points, closed, backPoints } = projectShapeToXY(
        shape,
        rotation,
        sampleDensity,
        projection,
        orientation,
        transparentSphere,
        fadeBackfaces,
      );
      if (points.length < 2 && (!fadeBackfaces || !backPoints?.length)) return null;
      const strokeWidth = shape.strokeWidth * 2;
      const asPolygon = closed && shape.type !== 'line' && shape.type !== 'latitude' && shape.type !== 'longitude';

      const frontMarkup = points.length >= 2
        ? asPolygon
          ? (() => {
              const closedPts = ensureClosed(points);
              const ptsAttr = formatPoints(closedPts);
              const fill = shape.fill ?? 'none';
              return `<polygon points="${ptsAttr}" fill="${fill}" stroke="${shape.stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`;
            })()
          : `<polyline points="${formatPoints(points)}" fill="none" stroke="${shape.stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`
        : '';

      const backMarkup =
        fadeBackfaces && backPoints && backPoints.length >= 2
          ? `<polyline points="${formatPoints(backPoints)}" fill="none" stroke="${shape.stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" />`
          : '';

      return [backMarkup, frontMarkup].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n    ');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <circle cx="0" cy="0" r="1" fill="${transparentSphere ? 'none' : '#fafafa'}" stroke="#cccccc" stroke-width="0.01" />
  ${guideMarkup ? `<g>${guideMarkup}</g>` : ''}
  <g>
    ${shapesMarkup}
  </g>
</svg>
  `.trim();

  return svg;
}
