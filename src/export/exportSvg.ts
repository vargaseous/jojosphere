import { Scene } from '../model/scene';
import { Rotation, projectShapeToXY } from '../geometry/projection';

export function exportSphereSvg(scene: Scene, rotation: Rotation): string {
  const viewBox = '-1.1 -1.1 2.2 2.2';
  const polylines = scene.shapes
    .map((shape) => {
      const points = projectShapeToXY(shape, rotation, 64);
      if (!points.length) return null;
      const pointsAttr = points.map((p) => `${p.x},${p.y}`).join(' ');
      const stroke = shape.stroke;
      const strokeWidth = shape.strokeWidth * 2;
      const fill = 'none';
      return `<polyline points="${pointsAttr}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .filter(Boolean)
    .join('\n    ');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <circle cx="0" cy="0" r="1" fill="#fafafa" stroke="#cccccc" stroke-width="0.01" />
  <g>
    ${polylines}
  </g>
</svg>
  `.trim();

  return svg;
}
