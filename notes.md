# Working notes

## Structure
- `src/model/scene.ts` — shape types (line/rect), Vec2, helpers for ids and rect normalization.
- `src/geometry/projection.ts` — UV->sphere mapping, rotation (Rz * Ry * Rx), orthographic projection, tessellation helpers (`tessellateShape`, `projectShapeToXY`).
- `src/uv/UVEditor.tsx` — SVG UV canvas (`viewBox="0 0 1 1"`), tools: select (stub), line, rect. Pointer events convert client coords -> UV, draw preview, finalize shape via `onAddShape`.
- `src/sphere/SpherePreview.tsx` — reuses projection helpers to render polylines on unit sphere viewBox `-1.1 -1.1 2.2 2.2`.
- `src/export/exportSvg.ts` — builds standalone SVG string using same projection path (polyline per shape + circle outline).
- `src/App.tsx` — manages scene state, rotation sliders (degrees -> radians), export button, lays out panels. Styling in `src/index.css`.
- Added empty `yarn.lock` in repo root so Yarn treats this as its own project (home dir also has a package.json/yarn.lock).

## Decisions / assumptions
- Back hemisphere culled by `projectOrthographic` (z < 0 returns null). Segments crossing limb simply break; no clipping.
- Tessellation density: preview uses 48 samples per shape (rect edges divide evenly), export uses 64. Stroke width on sphere doubled for visibility.
- Tool state is local to `UVEditor` with inline buttons; selection tool currently a placeholder.

## Follow-ups to consider
- Add limb clipping for segments crossing z=0 for cleaner outlines.
- Support filled rects on sphere (currently only outlines in projection/export).
- Add shape deletion/selection, keyboard shortcuts, undo.
- Persist scenes (localStorage) and allow importing/exporting UV data.
