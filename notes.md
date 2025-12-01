# Working notes

## Structure
- `src/model/scene.ts` — shape types (line/rect/circle), Vec2, helpers for ids and rect normalization.
- `src/geometry/projection.ts` — UV->sphere mapping, rotation (Rz * Ry * Rx), orthographic projection, tessellation helpers (`tessellateShape`, `projectShapeToXY`) with closed/open tracking.
- `src/uv/UVEditor.tsx` — SVG UV canvas (`viewBox="0 0 1 1"`), tools: select, line, rect, circle. Pointer events convert client coords -> UV, draw preview, finalize shape via `onAddShape`; grid overlay respects `showGuides`.
- `src/sphere/SpherePreview.tsx` — reuses projection helpers to render polygons/polylines on unit sphere viewBox `-1.1 -1.1 2.2 2.2`; optional UV guide lines (meridians/parallels) driven by `showGuides`.
- `src/export/exportSvg.ts` — builds standalone SVG string using same projection path, supports fills for closed shapes, and optionally includes guides when requested.
- `src/App.tsx` — manages scene state, selection, rotation sliders (degrees -> radians), colour editors, guide toggle, export button, layouts. Styling in `src/index.css`.
- Added empty `yarn.lock` in repo root so Yarn treats this as its own project (home dir also has a package.json/yarn.lock).

## Decisions / assumptions
- Back hemisphere culled by `projectOrthographic` (z < 0 returns null). Segments crossing limb simply break; no clipping.
- Tessellation density: preview uses 48–64 samples; stroke width on sphere doubled for visibility.
- Selection highlights via drop-shadow filter; colour editors update selected shape immediately. Fill input disabled for lines.
- Guide lines show simple UV grid (8 divisions) projected; exported when toggle enabled.

## Follow-ups to consider
- Add limb clipping for segments crossing z=0 for cleaner outlines.
- Consider better selection visuals (overlay layer) and basic edit/delete/undo.
- Persist scenes (localStorage) and allow importing/exporting UV data.
- Allow configuring guide density or loading a UV texture image instead of lines.
