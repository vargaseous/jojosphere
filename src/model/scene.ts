export type Vec2 = { u: number; v: number };

export interface LineShape {
  id: string;
  type: 'line';
  a: Vec2;
  b: Vec2;
  stroke: string;
  strokeWidth: number;
}

export interface RectShape {
  id: string;
  type: 'rect';
  origin: Vec2;
  size: { w: number; h: number };
  stroke: string;
  strokeWidth: number;
  fill: string | null;
}

export interface CircleShape {
  id: string;
  type: 'circle';
  center: Vec2;
  radius: number;
  stroke: string;
  strokeWidth: number;
  fill: string | null;
}

export interface LatitudeShape {
  id: string;
  type: 'latitude';
  v: number;
  stroke: string;
  strokeWidth: number;
}

export interface LongitudeShape {
  id: string;
  type: 'longitude';
  u: number;
  stroke: string;
  strokeWidth: number;
}

export type Shape = LineShape | RectShape | CircleShape | LatitudeShape | LongitudeShape;

export interface Scene {
  shapes: Shape[];
}

let shapeCounter = 0;

export function createId(prefix = 'shape'): string {
  shapeCounter += 1;
  return `${prefix}-${Date.now()}-${shapeCounter}`;
}

export function normalizeRect(a: Vec2, b: Vec2): { origin: Vec2; size: { w: number; h: number } } {
  const u0 = Math.min(a.u, b.u);
  const v0 = Math.min(a.v, b.v);
  const u1 = Math.max(a.u, b.u);
  const v1 = Math.max(a.v, b.v);
  return {
    origin: { u: u0, v: v0 },
    size: { w: u1 - u0, h: v1 - v0 },
  };
}

export function initialScene(): Scene {
  return { shapes: [] };
}
