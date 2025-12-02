import { CircleShape, LatitudeShape, LineShape, LongitudeShape, PolygonShape, RectShape, Shape, Vec2 } from '../model/scene';

export type ProjectionType = 'orthographic' | 'perspective' | 'stereographic';

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

export interface UvOrientation {
  flipU?: boolean;
  flipV?: boolean;
}

function orientUV(point: Vec2, orientation?: UvOrientation): Vec2 {
  if (!orientation) return point;
  const { flipU, flipV } = orientation;
  return {
    u: flipU ? 1 - point.u : point.u,
    v: flipV ? 1 - point.v : point.v,
  };
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

export function projectOrthographic(p: Vec3, allowBack = false): Vec2XY | null {
  if (!allowBack && p.z < 0) {
    return null;
  }
  return { x: p.x, y: p.y };
}

function projectPerspective(p: Vec3, cameraZ = 4): Vec2XY | null {
  const denom = cameraZ - p.z;
  if (denom <= 0) return null;
  const x = (p.x * cameraZ) / denom;
  const y = (p.y * cameraZ) / denom;
  return { x, y };
}

function projectStereographic(p: Vec3): Vec2XY | null {
  const denom = 1 - p.z;
  if (denom <= 1e-6) return null;
  return { x: p.x / denom, y: p.y / denom };
}

export function uvPointToXY(
  point: Vec2,
  rotation: Rotation,
  projection: ProjectionType = 'orthographic',
  orientation?: UvOrientation,
  includeBackFaces = false,
): Vec2XY | null {
  const oriented = orientUV(point, orientation);
  const spherePoint = uvToSphere(oriented.u, oriented.v);
  const rotated = applyRotation(spherePoint, rotation);
  if (projection === 'orthographic') return projectOrthographic(rotated, includeBackFaces);
  if (projection === 'perspective') return projectPerspective(rotated);
  return projectStereographic(rotated);
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

function samplePolygon(shape: PolygonShape, samples: number): TessellatedShape {
  const pts: Vec2[] = [];
  const { center, radius, sides, rotation } = shape;
  const steps = Math.max(sides, samples);
  for (let i = 0; i <= sides; i += 1) {
    const t = i / sides;
    const ang = rotation + t * Math.PI * 2;
    pts.push({
      u: center.u + radius * Math.cos(ang),
      v: center.v + radius * Math.sin(ang),
    });
  }
  return { points: pts, closed: true };
}

function sampleLatitude(shape: LatitudeShape, samples: number): TessellatedShape {
  const pts: Vec2[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    pts.push({ u: t, v: shape.v });
  }
  return { points: pts, closed: true };
}

function sampleLongitude(shape: LongitudeShape, samples: number): TessellatedShape {
  const pts: Vec2[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    pts.push({ u: shape.u, v: t });
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
  if (shape.type === 'polygon') {
    return samplePolygon(shape, samples);
  }
  if (shape.type === 'latitude') {
    return sampleLatitude(shape, samples);
  }
  if (shape.type === 'longitude') {
    return sampleLongitude(shape, samples);
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

function polygonArea(points: Vec2XY[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return area / 2;
}

function segmentCircleIntersections(p0: Vec2XY, p1: Vec2XY): { point: Vec2XY; t: number }[] {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const a = dx * dx + dy * dy;
  const b = 2 * (p0.x * dx + p0.y * dy);
  const c = p0.x * p0.x + p0.y * p0.y - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];
  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);
  const result: { point: Vec2XY; t: number }[] = [];
  if (t1 >= 0 && t1 <= 1) result.push({ point: { x: p0.x + t1 * dx, y: p0.y + t1 * dy }, t: t1 });
  if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 1e-6) {
    result.push({ point: { x: p0.x + t2 * dx, y: p0.y + t2 * dy }, t: t2 });
  }
  return result.sort((a, b) => a.t - b.t);
}

function arcPoints(from: Vec2XY, to: Vec2XY, ccw: boolean, segments = 32): Vec2XY[] {
  const a0 = Math.atan2(from.y, from.x);
  let a1 = Math.atan2(to.y, to.x);
  let delta = a1 - a0;
  if (ccw && delta <= 0) delta += Math.PI * 2;
  if (!ccw && delta >= 0) delta -= Math.PI * 2;

  const steps = Math.max(4, Math.ceil(Math.abs(delta) / (Math.PI / 90))); // ~2° steps
  const pts: Vec2XY[] = [];
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const ang = a0 + delta * t;
    pts.push({ x: Math.cos(ang), y: Math.sin(ang) });
  }
  pts.push(to);
  return pts;
}

function clipFillWithArcs(points: Vec2XY[]): Vec2XY[] {
  if (points.length === 0) return [];
  const inside = (p: Vec2XY) => p.x * p.x + p.y * p.y <= 1 + 1e-9;
  const ccw = polygonArea(points) >= 0;

  let output: Vec2XY[] = [];
  let pendingArcStart: Vec2XY | null = null;

  let prev = points[points.length - 1];
  let prevInside = inside(prev);

  for (const curr of points) {
    const currInside = inside(curr);
    const intersections = segmentCircleIntersections(prev, curr);

    if (prevInside && currInside) {
      // entirely inside
      output.push(curr);
    } else if (prevInside && !currInside) {
      // exiting
      const exitPt = intersections[0]?.point;
      if (exitPt) {
        output.push(exitPt);
        pendingArcStart = exitPt;
      }
    } else if (!prevInside && currInside) {
      // entering
      const entryPt = intersections[intersections.length - 1]?.point;
      if (entryPt) {
        if (pendingArcStart) {
          output.push(...arcPoints(pendingArcStart, entryPt, ccw));
          pendingArcStart = null;
        } else {
          output.push(entryPt);
        }
      }
      output.push(curr);
    } else {
      // outside-outside
      if (intersections.length === 2) {
        const [entry, exit] = intersections;
        if (pendingArcStart) {
          output.push(...arcPoints(pendingArcStart, entry.point, ccw));
          pendingArcStart = null;
        }
        output.push(entry.point);
        output.push(exit.point);
        pendingArcStart = exit.point;
      }
    }

    prev = curr;
    prevInside = currInside;
  }

  if (pendingArcStart && output.length) {
    const first = output[0];
    output.push(...arcPoints(pendingArcStart, first, ccw));
  }

  return output;
}

export function projectShapeToXY(
  shape: Shape,
  rotation: Rotation,
  samples = 32,
  projection: ProjectionType = 'orthographic',
  orientation?: UvOrientation,
  includeBackFaces = false,
  splitBackFaces = false,
): { points: Vec2XY[]; backPoints?: Vec2XY[]; closed: boolean } {
  const { points: uvPoints, closed } = tessellateShape(shape, samples);
  const rotated: Vec3[] = uvPoints.map((uv) => {
    const oriented = orientUV(uv, orientation);
    return applyRotation(uvToSphere(oriented.u, oriented.v), rotation);
  });
  const isGreatCircle = shape.type === 'latitude' || shape.type === 'longitude';
  if (includeBackFaces && splitBackFaces) {
    const front: Vec2XY[] = [];
    const back: Vec2XY[] = [];
    for (const p of rotated) {
      const target = p.z >= 0 ? front : back;
      const xy =
        projection === 'orthographic'
          ? projectOrthographic(p, true)
          : projection === 'perspective'
            ? projectPerspective(p)
            : projectStereographic(p);
      if (xy) target.push(xy);
    }
    return { points: front, backPoints: back, closed };
  }

  const clipped3D = includeBackFaces
    ? rotated
    : isGreatCircle
      ? clipPolylineToFrontHemisphere(rotated, true)
      : closed
        ? clipPolygonToFrontHemisphere(rotated)
        : clipPolylineToFrontHemisphere(rotated, closed);

  let projected: Vec2XY[] = [];
  for (const p of clipped3D) {
    const xy =
      projection === 'orthographic'
        ? projectOrthographic(p, includeBackFaces)
        : projection === 'perspective'
          ? projectPerspective(p)
          : projectStereographic(p);
    if (xy) projected.push(xy);
  }

  if (closed && shape.type !== 'line' && projection === 'orthographic') {
    projected = clipFillWithArcs(projected);
  }

  return { points: projected, closed };
}
