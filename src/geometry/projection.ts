import { CircleShape, LineShape, RectShape, Shape, Vec2 } from '../model/scene';

export interface Rotation {
  rx: number;
  ry: number;
  rz: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2XY {
  x: number;
  y: number;
}

export function uvToSphere(u: number, v: number): Vec3 {
  const theta = 2 * Math.PI * u - Math.PI;
  const phi = Math.PI * v - Math.PI / 2;
  const x = Math.cos(phi) * Math.cos(theta);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.sin(theta);
  return { x, y, z };
}

export function applyRotation(p: Vec3, rot: Rotation): Vec3 {
  const { rx, ry, rz } = rot;

  // R = Rz * Ry * Rx
  const sinX = Math.sin(rx);
  const cosX = Math.cos(rx);
  const sinY = Math.sin(ry);
  const cosY = Math.cos(ry);
  const sinZ = Math.sin(rz);
  const cosZ = Math.cos(rz);

  // Rx
  const x1 = p.x;
  const y1 = p.y * cosX - p.z * sinX;
  const z1 = p.y * sinX + p.z * cosX;

  // Ry
  const x2 = x1 * cosY + z1 * sinY;
  const y2 = y1;
  const z2 = -x1 * sinY + z1 * cosY;

  // Rz
  const x3 = x2 * cosZ - y2 * sinZ;
  const y3 = x2 * sinZ + y2 * cosZ;
  const z3 = z2;

  return { x: x3, y: y3, z: z3 };
}

export function projectOrthographic(p: Vec3): Vec2XY | null {
  if (p.z < 0) {
    return null;
  }
  return { x: p.x, y: p.y };
}

export function uvPointToXY(point: Vec2, rotation: Rotation): Vec2XY | null {
  const spherePoint = uvToSphere(point.u, point.v);
  const rotated = applyRotation(spherePoint, rotation);
  return projectOrthographic(rotated);
}

interface TessellatedShape {
  points: Vec2[];
  closed: boolean;
}

function sampleLine(shape: LineShape, samples: number): TessellatedShape {
  const pts: Vec2[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    pts.push({
      u: shape.a.u + t * (shape.b.u - shape.a.u),
      v: shape.a.v + t * (shape.b.v - shape.a.v),
    });
  }
  return { points: pts, closed: false };
}

function sampleRect(shape: RectShape, samples: number): TessellatedShape {
  const { origin, size } = shape;
  const perEdge = Math.max(2, Math.floor(samples / 4));
  const corners: Vec2[] = [
    { u: origin.u, v: origin.v },
    { u: origin.u + size.w, v: origin.v },
    { u: origin.u + size.w, v: origin.v + size.h },
    { u: origin.u, v: origin.v + size.h },
  ];
  const points: Vec2[] = [];

  for (let edge = 0; edge < 4; edge += 1) {
    const start = corners[edge];
    const end = corners[(edge + 1) % 4];
    for (let i = 0; i <= perEdge; i += 1) {
      const t = i / perEdge;
      const u = start.u + t * (end.u - start.u);
      const v = start.v + t * (end.v - start.v);
      points.push({ u, v });
    }
  }

  return { points, closed: true };
}

function sampleCircle(shape: CircleShape, samples: number): TessellatedShape {
  const pts: Vec2[] = [];
  const steps = Math.max(64, samples * 2);
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    pts.push({
      u: shape.center.u + shape.radius * Math.cos(t),
      v: shape.center.v + shape.radius * Math.sin(t),
    });
  }
  return { points: pts, closed: true };
}

export function tessellateShape(shape: Shape, samples = 32): TessellatedShape {
  if (shape.type === 'line') {
    return sampleLine(shape, samples);
  }
  if (shape.type === 'rect') {
    return sampleRect(shape, samples);
  }
  return sampleCircle(shape, samples);
}

function interpolateAtZ0(p0: Vec3, p1: Vec3): Vec3 {
  const t = p0.z / (p0.z - p1.z);
  return {
    x: p0.x + t * (p1.x - p0.x),
    y: p0.y + t * (p1.y - p0.y),
    z: 0,
  };
}

function clipPolylineToFrontHemisphere(points: Vec3[], closed: boolean): Vec3[] {
  if (points.length === 0) return [];
  const output: Vec3[] = [];
  const count = closed ? points.length : points.length - 1;

  for (let i = 0; i < count; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const currentFront = current.z >= 0;
    const nextFront = next.z >= 0;

    if (currentFront) {
      output.push(current);
    }

    if (currentFront !== nextFront) {
      const intersect = interpolateAtZ0(current, next);
      output.push(intersect);
    }
  }

  return output;
}

function clipPolygonToFrontHemisphere(points: Vec3[]): Vec3[] {
  // Sutherland–Hodgman against plane z >= 0
  if (points.length === 0) return [];
  let output = points;

  const inside = (p: Vec3) => p.z >= 0;

  const clipped: Vec3[] = [];
  for (let i = 0; i < output.length; i += 1) {
    const current = output[i];
    const prev = output[(i - 1 + output.length) % output.length];
    const currentInside = inside(current);
    const prevInside = inside(prev);

    if (currentInside) {
      if (!prevInside) {
        clipped.push(interpolateAtZ0(prev, current));
      }
      clipped.push(current);
    } else if (prevInside) {
      clipped.push(interpolateAtZ0(prev, current));
    }
  }

  output = clipped;
  return output;
}

function approximateUnitCircle(segments = 360): Vec2XY[] {
  const pts: Vec2XY[] = [];
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    pts.push({ x: Math.cos(t), y: Math.sin(t) });
  }
  return pts;
}

function clipPolygon2D(subject: Vec2XY[], clipper: Vec2XY[]): Vec2XY[] {
  if (subject.length === 0) return [];
  let output = subject;

  const clipCount = clipper.length;
  for (let i = 0; i < clipCount; i += 1) {
    const c1 = clipper[i];
    const c2 = clipper[(i + 1) % clipCount];

    const input = output;
    output = [];
    if (input.length === 0) break;

    const inside = (p: Vec2XY) => {
      // left side of edge (c1 -> c2)
      return (c2.x - c1.x) * (p.y - c1.y) - (c2.y - c1.y) * (p.x - c1.x) >= 0;
    };

    const intersection = (p1: Vec2XY, p2: Vec2XY): Vec2XY => {
      const A1 = c2.y - c1.y;
      const B1 = c1.x - c2.x;
      const C1 = A1 * c1.x + B1 * c1.y;

      const A2 = p2.y - p1.y;
      const B2 = p1.x - p2.x;
      const C2 = A2 * p1.x + B2 * p1.y;

      const det = A1 * B2 - A2 * B1;
      if (Math.abs(det) < 1e-8) return p1; // parallel, should not happen often
      return {
        x: (B2 * C1 - B1 * C2) / det,
        y: (A1 * C2 - A2 * C1) / det,
      };
    };

    for (let j = 0; j < input.length; j += 1) {
      const current = input[j];
      const prev = input[(j - 1 + input.length) % input.length];
      const currentInside = inside(current);
      const prevInside = inside(prev);

      if (currentInside) {
        if (!prevInside) {
          output.push(intersection(prev, current));
        }
        output.push(current);
      } else if (prevInside) {
        output.push(intersection(prev, current));
      }
    }
  }

  return output;
}

export function projectShapeToXY(
  shape: Shape,
  rotation: Rotation,
  samples = 32,
): { points: Vec2XY[]; closed: boolean } {
  const { points: uvPoints, closed } = tessellateShape(shape, samples);
  const rotated: Vec3[] = uvPoints.map((uv) => applyRotation(uvToSphere(uv.u, uv.v), rotation));
  const clipped3D = closed ? clipPolygonToFrontHemisphere(rotated) : clipPolylineToFrontHemisphere(rotated, closed);

  let projected: Vec2XY[] = [];
  for (const p of clipped3D) {
    const xy = projectOrthographic(p);
    if (xy) projected.push(xy);
  }

  if (closed && shape.type !== 'line') {
    const circle = approximateUnitCircle(96);
    projected = clipPolygon2D(projected, circle);
  }

  return { points: projected, closed };
}
