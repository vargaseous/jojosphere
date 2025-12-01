You are helping me build a small browser-based app using **React + Vite + Yarn**, with a focus on **clean SVG export**, not fancy UI.

Please read this prompt carefully and then generate the initial implementation. I will iterate with you afterwards.

---

## High-level goal

Build a React app that has:

- A two-panel layout.
- **Left panel**: a basic 2D vector editor on a unit square (UV space).
- **Right panel**: a live preview that maps that square onto a **sphere**, then projects the sphere to 2D using an orthographic projection.
- A button that **exports the current sphere view as an SVG file** that I can open in Illustrator or Affinity Designer to produce technical diagrams.

Priority: **reliable, production-ready SVG files** that are simple, predictable, and import cleanly into design tools.

UI polish is **secondary** to correctness and cleanliness of the generated SVG.

---

## Tech stack and project structure

Use:

- Package manager: **Yarn**
- Framework: **React** (function components, hooks)
- Build tool: **Vite**
- Language: Prefer **TypeScript** if you are comfortable; otherwise JavaScript is acceptable. If you pick TypeScript, type definitions should be sensible but do not need to be overly elaborate.
- Styling: A single global CSS file (e.g. `src/index.css`) with simple, minimal styles.
- Dependencies: keep them minimal. Prefer only React, ReactDOM, and whatever Vite brings by default. Do not introduce niche or heavy packages for this MVP.

You can assume the project was created with something like:

```bash
yarn create vite sphere-editor --template react-ts
```

Please generate all relevant source files for `src/` (and any extra config if needed) as **complete file contents**, clearly separated.

---

## Layout and components

Create at least these components / files:

- `src/main.tsx` (or `.tsx`): standard Vite React entry.
- `src/App.tsx`:
  - Top-level layout:
    - Header with rotation controls and Export button.
    - Main area with two side-by-side panels:
      - Left: UV editor.
      - Right: sphere preview.
- `src/uv/UVEditor.tsx`:
  - Renders the UV editor SVG and basic tools.
- `src/sphere/SpherePreview.tsx`:
  - Renders the sphere preview SVG based on the shared scene data and rotation angles.
- `src/model/scene.ts`:
  - Contains the data model types and some helper functions.
- `src/geometry/projection.ts`:
  - Contains UV → sphere mapping and rotation + projection code.
- `src/export/exportSvg.ts`:
  - Contains logic that takes the current scene and rotation and returns an SVG string representing the projected sphere view.

You may adjust module names slightly if needed but keep a **simple, logical structure**.

---

## Data model (UV-space scene graph)

All shapes are stored in **UV space**, not pixel space.

Define types roughly like this (in TypeScript-style pseudocode):

```ts
export type Vec2 = { u: number; v: number };

export interface LineShape {
  id: string;
  type: 'line';
  a: Vec2;   // start in UV
  b: Vec2;   // end in UV
  stroke: string;       // e.g. '#000000'
  strokeWidth: number;  // logical units
}

export interface RectShape {
  id: string;
  type: 'rect';
  origin: Vec2;         // top-left corner in UV
  size: { w: number; h: number };
  stroke: string;
  strokeWidth: number;
  fill: string | null;
}

export type Shape = LineShape | RectShape;

export interface Scene {
  shapes: Shape[];
}
```

You can refine this definition if needed but keep it simple.

There is a single `Scene` instance managed in React state in `App` (or in a small store module) and passed down to both the UV editor and the sphere preview.

---

## UV editor (left panel)

The UV editor is an SVG with a unit square coordinate system:

- Use `viewBox="0 0 1 1"` to work directly in UV space.
- Draw a background rectangle from (0, 0) to (1, 1) as a backdrop and border.

### Tools

Implement a minimal set of tools:

- `Select` tool (can be mostly a stub for now; no need for full selection/manipulation yet).
- `Line` tool.
- `Rect` tool.

Tools can be represented as a small enum or string union in state.

### Interaction behaviour

Convert pointer events in the SVG to UV coordinates using the SVG `getBoundingClientRect` and the `viewBox` mapping.

**Line tool behaviour** (MVP):

- On mouse down inside the UV SVG:
  - Record the starting UV coordinate.
  - Create a temporary shape preview in local component state.
- On mouse move (while drawing):
  - Update the preview line endpoint.
- On mouse up:
  - Finalise the line: add a `LineShape` to the shared `Scene` with:
    - start = first UV coordinate, end = last UV coordinate.
    - stroke = `#000000`.
    - strokeWidth = something like `0.002` in UV units (tweak as needed).

**Rect tool behaviour** (MVP):

- On mouse down: record starting UV coordinate as one corner.
- On mouse move: update preview rectangle defined by drag corner and current pointer.
- On mouse up: finalise rect:
  - normalise so origin is the top-left in UV, and width/height are positive.
  - add a `RectShape` to the scene.
  - default style: stroke black, strokeWidth ~ `0.002`, fill light grey (e.g. `#e5e5e5`).

Rendering the shapes in the UV editor is straightforward:

- Map `LineShape` to `<line x1={a.u} y1={a.v} x2={b.u} y2={b.v} ...>`.
- Map `RectShape` to `<rect x={origin.u} y={origin.v} width={size.w} height={size.h} ...>`.

Keep everything in UV coordinates; do not introduce extra transforms in the UV editor.

---

## UV to sphere mapping and rotation

All projection logic should be encapsulated in `geometry/projection.ts`.

Define functions roughly like:

```ts
export interface Rotation {
  rx: number; // rotation about X in radians
  ry: number; // rotation about Y in radians
  rz: number; // rotation about Z in radians
}

export interface Vec3 { x: number; y: number; z: number; }
export interface Vec2XY { x: number; y: number; }

export function uvToSphere(u: number, v: number): Vec3 {
  // map (u, v) in [0,1] to (x,y,z) on unit sphere
}

export function applyRotation(p: Vec3, rot: Rotation): Vec3 {
  // apply Rz(rz) * Ry(ry) * Rx(rx)
}

export function projectOrthographic(p: Vec3): Vec2XY | null {
  // if p.z < 0, return null (back hemisphere)
  // else return { x: p.x, y: p.y }
}
```

### UV → sphere mapping

For UV coordinates `(u, v)` in [0, 1] × [0, 1]:

- Convert to spherical angles:

  - `theta = 2 * Math.PI * u - Math.PI;` // longitude
  - `phi   = Math.PI * v - Math.PI / 2;` // latitude

- Map to unit sphere:

  ```ts
  const x = Math.cos(phi) * Math.cos(theta);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.sin(theta);
  ```

### Rotation about three axes

Use Euler angles:

- `rx` about X (pitch)
- `ry` about Y (yaw)
- `rz` about Z (roll)

Implement the three rotation matrices using standard formulas:

- Around X:

  ```ts
  // alpha = rx
  const Rx = [
    [1, 0, 0],
    [0, Math.cos(alpha), -Math.sin(alpha)],
    [0, Math.sin(alpha),  Math.cos(alpha)],
  ];
  ```

- Around Y:

  ```ts
  // beta = ry
  const Ry = [
    [ Math.cos(beta), 0, Math.sin(beta)],
    [ 0,             1, 0            ],
    [-Math.sin(beta), 0, Math.cos(beta)],
  ];
  ```

- Around Z:

  ```ts
  // gamma = rz
  const Rz = [
    [Math.cos(gamma), -Math.sin(gamma), 0],
    [Math.sin(gamma),  Math.cos(gamma), 0],
    [0,                0,               1],
  ];
  ```

Combine in the order:

- `R = Rz * Ry * Rx` (matrix multiplication), then apply `R * p`.

You can implement this directly as arithmetic to avoid full matrix objects if you prefer.

### Orthographic projection

- Assume camera looking along +z towards origin.
- Keep points with `z >= 0` (front hemisphere). If `z < 0`, drop the point.
- For kept points:

  - `X = x` and `Y = y`.

The sphere preview SVG should have a `viewBox` of (for example):

```html
viewBox="-1.1 -1.1 2.2 2.2"
```

Draw the sphere outline as:

```html
<circle cx="0" cy="0" r="1" ... />
```

Use `X` and `Y` directly as SVG coordinates.

---

## Sphere preview rendering (right panel)

The `SpherePreview` component receives:

- The current `Scene` (UV shapes).
- The current rotation angles (in degrees or radians; convert as needed).

### Tessellation

Because projection is non-linear, approximate shapes with polylines.

Implement very simple tessellation for now:

- For a `LineShape`:
  - Use N samples along the line from `t = 0` to `t = 1` (for example N = 32).
  - UV point = `a + t * (b - a)`.
- For a `RectShape`:
  - Tessellate the rectangle outline by sampling along its four edges (each edge can have N/4 samples).
  - Fill handling can be omitted or approximated for v1; focus on the outline.

For each UV sample:

1. Map UV → sphere (x, y, z).
2. Apply rotation to get (x', y', z').
3. Drop points with z' < 0 entirely.
4. For points with z' >= 0, project to (X = x', Y = y').

Group the projected (X, Y) points per shape into a `<polyline>` or `<path>`.

To keep it simple:

- Use `<polyline>` with `points="x1,y1 x2,y2 ..."`.
- Apply `stroke`, `stroke-width`, and `fill="none"` for now.

You can ignore precise clipping at the limb for the first version (i.e. if a segment crosses to the back hemisphere, it may just break). If you do want to add clipping, you can approximate intersection with `z' = 0` by linear interpolation between neighbouring points.

### React rendering

`SpherePreview` should:

- Recompute the tessellation and projection each time `scene` or `rotation` changes.
- Render:
  - A background `<circle>` for the sphere outline.
  - A `<g>` that contains the polylines for each shape.

---

## Rotation controls in the UI

In `App.tsx`, add three sliders in the header:

- `Rot X (°)`
- `Rot Y (°)`
- `Rot Z (°)`

Each slider:

- `type="range"`, range `-180` to `180`, step `1`.
- Stored in React state as degrees, converted to radians when building the `Rotation` object for projection.

Update the `SpherePreview` whenever these change.

---

## SVG export

Implement an `exportSphereSvg(scene, rotation): string` function in `src/export/exportSvg.ts` that:

- Takes the current `Scene` and `Rotation`.
- Runs **the same tessellation + projection logic** as `SpherePreview` (you may share helper functions).
- Produces a complete SVG document string that:
  - Uses `viewBox="-1.1 -1.1 2.2 2.2"` (or similar) for the sphere.
  - Contains:
    - One `<circle>` at (0,0) with `r=1` for the sphere outline.
    - A `<g>` holding one `<polyline>` per shape.
  - Uses simple attributes only:
    - `fill`, `stroke`, `stroke-width`, `stroke-linejoin`, `stroke-linecap`.
  - Does not rely on external CSS or complex features (no filters, masks, clip paths, or embedded fonts).

Hook this up in `App.tsx` to a button labelled **Export sphere SVG**:

- On click:
  - Call `exportSphereSvg(scene, rotation)`.
  - Create a `Blob` from the string (`type: 'image/svg+xml'`).
  - Create a temporary object URL and trigger a download of `sphere-export.svg`.

The resulting SVG file should be self-contained and usable in Illustrator/Affinity without extra dependencies.

---

## Styling

Keep CSS very minimal and focused:

- A header bar at the top with small typography.
- Two panels side by side underneath, each with a small title bar and an SVG inside.
- SVGs should have a light border and white background.

Simple flexbox layout is fine.

---

## What to generate now

Please generate a **working initial version** of this app, with:

- All the source files needed under `src/`.
- Minimal but correct implementations of:
  - UV editor with Line and Rect tools.
  - Shared scene state.
  - UV → sphere → rotated → orthographic projection.
  - Sphere preview rendering using polylines.
  - Rotation sliders.
  - Export SVG button that downloads the projected sphere as an SVG.

Do not overcomplicate state management or styling; keep it straightforward and readable. After this first implementation, I will ask for refinements.

