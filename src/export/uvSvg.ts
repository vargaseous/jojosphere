import { CircleShape, LatitudeShape, LineShape, LongitudeShape, PolygonShape, RectShape, Scene, Shape } from '../model/scene';

function shapeToSvg(shape: Shape): string {
  if (shape.type === 'line') {
    const s = shape as LineShape;
    return `<line x1="${s.a.u}" y1="${s.a.v}" x2="${s.b.u}" y2="${s.b.v}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" />`;
  }
  if (shape.type === 'rect') {
    const s = shape as RectShape;
    const fill = s.fill ?? 'none';
    return `<rect x="${s.origin.u}" y="${s.origin.v}" width="${s.size.w}" height="${s.size.h}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" fill="${fill}" />`;
  }
  if (shape.type === 'polygon') {
    const s = shape as PolygonShape;
    const fill = s.fill ?? 'none';
    return `<polygon data-uv-regular="true" cx="${s.center.u}" cy="${s.center.v}" r="${s.radius}" sides="${s.sides}" rotation="${s.rotation}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" fill="${fill}" />`;
  }
  if (shape.type === 'latitude') {
    const s = shape as LatitudeShape;
    return `<line data-latitude="true" x1="0" y1="${s.v}" x2="1" y2="${s.v}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" />`;
  }
  if (shape.type === 'longitude') {
    const s = shape as LongitudeShape;
    return `<line data-longitude="true" x1="${s.u}" y1="0" x2="${s.u}" y2="1" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" />`;
  }
  const s = shape as CircleShape;
  const fill = s.fill ?? 'none';
  return `<circle cx="${s.center.u}" cy="${s.center.v}" r="${s.radius}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" fill="${fill}" />`;
}

export const UV_SVG_MARKER = 'data-uv-scene="true"';

export function sceneToUvSvg(scene: Scene): string {
  const shapes = scene.shapes.map(shapeToSvg).join('\n    ');
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" ${UV_SVG_MARKER}>
  ${shapes}
</svg>
  `.trim();
}

function attrNum(el: Element, name: string, fallback: number): number {
  const val = el.getAttribute(name);
  if (val == null) return fallback;
  const parsed = parseFloat(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function uvSvgToShapes(svgString: string, requireMarker = false): Shape[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  if (requireMarker) {
    const hasMarker = doc.documentElement.hasAttribute('data-uv-scene');
    if (!hasMarker) {
      throw new Error('Missing UV marker attribute on <svg>.');
    }
  }
  const shapes: Shape[] = [];

  const rects = Array.from(doc.querySelectorAll('rect'));
  rects.forEach((el, idx) => {
    const x = attrNum(el, 'x', 0);
    const y = attrNum(el, 'y', 0);
    const width = attrNum(el, 'width', 0);
    const height = attrNum(el, 'height', 0);
    shapes.push({
      id: `rect-import-${idx}`,
      type: 'rect',
      origin: { u: x, v: y },
      size: { w: width, h: height },
      stroke: el.getAttribute('stroke') || '#000000',
      strokeWidth: attrNum(el, 'stroke-width', 0.002),
      fill: el.getAttribute('fill') || null,
    });
  });

  const lines = Array.from(doc.querySelectorAll('line'));
  lines.forEach((el, idx) => {
    if (el.hasAttribute('data-latitude')) {
      shapes.push({
        id: `latitude-import-${idx}`,
        type: 'latitude',
        v: attrNum(el, 'y1', 0.5),
        stroke: el.getAttribute('stroke') || '#000000',
        strokeWidth: attrNum(el, 'stroke-width', 0.002),
      });
      return;
    }
    if (el.hasAttribute('data-longitude')) {
      shapes.push({
        id: `longitude-import-${idx}`,
        type: 'longitude',
        u: attrNum(el, 'x1', 0.5),
        stroke: el.getAttribute('stroke') || '#000000',
        strokeWidth: attrNum(el, 'stroke-width', 0.002),
      });
      return;
    }
    shapes.push({
      id: `line-import-${idx}`,
      type: 'line',
      a: { u: attrNum(el, 'x1', 0), v: attrNum(el, 'y1', 0) },
      b: { u: attrNum(el, 'x2', 0), v: attrNum(el, 'y2', 0) },
      stroke: el.getAttribute('stroke') || '#000000',
      strokeWidth: attrNum(el, 'stroke-width', 0.002),
    });
  });

  const polygons = Array.from(doc.querySelectorAll('polygon'));
  polygons.forEach((el, idx) => {
    if (el.getAttribute('data-uv-regular') === 'true') {
      shapes.push({
        id: `polygon-import-${idx}`,
        type: 'polygon',
        center: { u: attrNum(el, 'cx', 0.5), v: attrNum(el, 'cy', 0.5) },
        radius: attrNum(el, 'r', 0.1),
        sides: Math.max(3, Math.round(attrNum(el, 'sides', 5))),
        rotation: attrNum(el, 'rotation', 0),
        stroke: el.getAttribute('stroke') || '#000000',
        strokeWidth: attrNum(el, 'stroke-width', 0.002),
        fill: el.getAttribute('fill') || null,
      });
      return;
    }
    // Fallback: parse generic polygon points as a non-regular polygon approximated by center/radius
    const ptsAttr = el.getAttribute('points') || '';
    const pts = ptsAttr
      .split(/\s+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((pair) => pair.split(',').map(Number))
      .filter((p) => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (pts.length >= 3) {
      const avgU = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
      const avgV = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
      const radius = Math.max(
        0.0001,
        Math.sqrt(
          pts.reduce((sum, p) => sum + (p[0] - avgU) * (p[0] - avgU) + (p[1] - avgV) * (p[1] - avgV), 0) / pts.length,
        ),
      );
      shapes.push({
        id: `polygon-import-${idx}`,
        type: 'polygon',
        center: { u: avgU, v: avgV },
        radius,
        sides: pts.length,
        rotation: 0,
        stroke: el.getAttribute('stroke') || '#000000',
        strokeWidth: attrNum(el, 'stroke-width', 0.002),
        fill: el.getAttribute('fill') || null,
      });
    }
  });

  const circles = Array.from(doc.querySelectorAll('circle'));
  circles.forEach((el, idx) => {
    shapes.push({
      id: `circle-import-${idx}`,
      type: 'circle',
      center: { u: attrNum(el, 'cx', 0.5), v: attrNum(el, 'cy', 0.5) },
      radius: attrNum(el, 'r', 0.1),
      stroke: el.getAttribute('stroke') || '#000000',
      strokeWidth: attrNum(el, 'stroke-width', 0.002),
      fill: el.getAttribute('fill') || null,
    });
  });

  return shapes;
}
