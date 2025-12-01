import { Scene } from '../model/scene';
import { ProjectionType, Rotation, projectShapeToXY, uvPointToXY } from '../geometry/projection';

interface ExportOptions {
  showGuides?: boolean;
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

function buildGuideLines(rotation: Rotation, projection: ProjectionType): string[] {
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
      const meridianPoint = uvPointToXY({ u: uConst, v: t }, rotation, projection);
      const parallelPoint = uvPointToXY({ u: t, v: vConst }, rotation, projection);
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
  const { showGuides = false } = options;

  const guideMarkup = showGuides
    ? buildGuideLines(rotation, projection)
        .map(
          (points) =>
            `<polyline points="${points}" fill="none" stroke="#e0e0e0" stroke-width="0.004" stroke-linecap="round" stroke-linejoin="round" />`,
        )
        .join('\n    ')
    : '';

  const shapesMarkup = scene.shapes
    .map((shape) => {
      const sampleDensity = shape.type === 'circle' ? 160 : 120;
      const { points, closed } = projectShapeToXY(shape, rotation, sampleDensity, projection);
      if (points.length < 2) return null;
      if (closed && shape.type !== 'line') {
        const closedPts = ensureClosed(points);
        const ptsAttr = formatPoints(closedPts);
        const fill = shape.fill ?? 'none';
        return `<polygon points="${ptsAttr}" fill="${fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth * 2}" stroke-linecap="round" stroke-linejoin="round" />`;
      }
      const ptsAttr = formatPoints(points);
      return `<polyline points="${ptsAttr}" fill="none" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth * 2}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .filter(Boolean)
    .join('\n    ');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <circle cx="0" cy="0" r="1" fill="#fafafa" stroke="#cccccc" stroke-width="0.01" />
  ${guideMarkup ? `<g>${guideMarkup}</g>` : ''}
  <g>
    ${shapesMarkup}
  </g>
</svg>
  `.trim();

  return svg;
}
