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
  const steps = Math.max(12, samples);
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

export function projectShapeToXY(shape: Shape, rotation: Rotation, samples = 32): { points: Vec2XY[]; closed: boolean } {
  const { points: uvPoints, closed } = tessellateShape(shape, samples);
  const projected: Vec2XY[] = [];
  for (const uv of uvPoints) {
    const xy = uvPointToXY(uv, rotation);
    if (xy) {
      projected.push(xy);
    }
  }
  return { points: projected, closed };
}
