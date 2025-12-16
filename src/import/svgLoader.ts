import { SvgShape, Vec2 } from '../model/scene';
import { createId } from '../model/scene';

function getPointsFromElement(
  element: SVGGeometryElement,
  matrix: DOMMatrix,
  samples = 64
): { points: Vec2[]; closed: boolean } {
  const len = element.getTotalLength();
  const step = Math.max(len / samples, 1); // Avoid excessive sampling for tiny shapes
  const points: Vec2[] = [];

  for (let d = 0; d <= len; d += step) {
    const pt = element.getPointAtLength(d);
    const transformed = pt.matrixTransform(matrix);
    points.push({ u: transformed.x, v: transformed.y });
  }

  // Ensure the end point is captured exact
  const endPt = element.getPointAtLength(len);
  const endTransformed = endPt.matrixTransform(matrix);
  points.push({ u: endTransformed.x, v: endTransformed.y });

  const first = points[0];
  const last = points[points.length - 1];
  const dist = Math.hypot(first.u - last.u, first.v - last.v);
  const closed = dist < 1e-3;

  return { points, closed };
}

export async function parseSvg(content: string): Promise<SvgShape | null> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'image/svg+xml');
  const svgRoot = doc.documentElement;

  if (svgRoot.tagName !== 'svg') {
    console.error('Not a valid SVG file');
    return null;
  }

  // Create a hidden container to perform geometry calculations with full DOM support (CTM, etc.)
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.visibility = 'hidden';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);
  
  // Clone the SVG into the document
  const workingSvg = svgRoot.cloneNode(true) as SVGSVGElement;
  container.appendChild(workingSvg);

  const rawPaths: {
    points: Vec2[];
    closed: boolean;
    stroke: string;
    strokeWidth: number;
    fill: string | null;
  }[] = [];

  // Helper to traverse and extract geometry
  const processElement = (el: Element) => {
    if (el instanceof SVGGeometryElement) {
      // SVGGeometryElement covers path, rect, circle, ellipse, line, polyline, polygon
      const style = window.getComputedStyle(el);
      const stroke = style.stroke !== 'none' ? style.stroke : '#000000';
      const strokeWidth = parseFloat(style.strokeWidth) || 1;
      const fill = style.fill !== 'none' ? style.fill : null;

      // CTM is crucial for transforms
      const ctm = el.getCTM();
      if (ctm) {
        // Sample points
        // Adjust samples based on length to be efficient?
        // For now fixed or proportional is fine.
        const len = el.getTotalLength();
        // Heuristic: ~1 point per 2 pixels, min 16, max 256
        const sampleCount = Math.max(16, Math.min(256, Math.ceil(len / 2)));
        
        const { points, closed } = getPointsFromElement(el, ctm, sampleCount);

        if (points.length > 1) {
          rawPaths.push({
            points,
            closed: closed || !!fill, // If filled, treat as closed
            stroke,
            strokeWidth,
            fill,
          });
        }
      }
    }

    // Traverse children (groups, etc.)
    for (const child of Array.from(el.children)) {
      processElement(child);
    }
  };

  processElement(workingSvg);

  // Cleanup
  document.body.removeChild(container);

  if (rawPaths.length === 0) {
    return null;
  }

  // Normalize coordinates
  // 1. Find bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of rawPaths) {
    for (const pt of p.points) {
      if (pt.u < minX) minX = pt.u;
      if (pt.v < minY) minY = pt.v;
      if (pt.u > maxX) maxX = pt.u;
      if (pt.v > maxY) maxY = pt.v;
    }
  }

  const w = maxX - minX;
  const h = maxY - minY;
  const cx = minX + w / 2;
  const cy = minY + h / 2;

  // 2. Scale to fit within 0.5 x 0.5 box, or keep 1:1 if it's small?
  // User expects it to be visible.
  // Standardize to fit in a 0.5 unit box
  const targetSize = 0.5;
  const maxDim = Math.max(w, h);
  const scale = maxDim > 0 ? targetSize / maxDim : 1;

  // 3. Center and scale points
  const normalizedPaths = rawPaths.map((p) => ({
    ...p,
    points: p.points.map((pt) => ({
      u: (pt.u - cx) * scale,
      v: (pt.v - cy) * scale,
    })),
    // Scale stroke width too?
    strokeWidth: p.strokeWidth * scale,
  }));

  return {
    id: createId('svg'),
    type: 'svg',
    origin: { u: 0.5, v: 0.5 }, // Start in center of UV space
    scale: 1.0, // This is the user-adjustable scale
    rotation: 0,
    strokeWidthOverride: null,
    paths: normalizedPaths,
  };
}
