# Working notes

## Structure
- `src/model/scene.ts` — shape types (line/rect/circle), Vec2, helpers for ids and rect normalization.
- `src/geometry/projection.ts` — UV->sphere mapping, rotation (Rz * Ry * Rx), projection modes (orthographic, perspective, stereographic), tessellation helpers (`tessellateShape`, `projectShapeToXY`) with closed/open tracking and improved clipping: 3D clip to front hemisphere, then arc-aware 2D clipping against the unit circle (segment-circle intersections with arc stitching following polygon winding). Circle tessellation bumped (min 64, doubled samples); clipping arcs only applied to orthographic fill currently.
- `src/uv/UVEditor.tsx` — SVG UV canvas (`viewBox="0 0 1 1"`), tools: select, line, rect, circle. Select mode supports click-to-select and drag-to-move (pushes history on drag start); bounding box shown for selection and can be grabbed to move. Extra transparent hit targets on shapes make selection easier, especially for thin lines. Pointer events convert client coords -> UV, draw preview, finalize shape via `onAddShape`; grid overlay respects `showGuides`. Optional corner gradient and dot grid overlays for orientation (fixed corner colours). Colour pickers live in UV panel header.
- `src/sphere/SpherePreview.tsx` — reuses projection helpers to render polygons/polylines on unit sphere viewBox `-1.1 -1.1 2.2 2.2`; optional UV guide lines (meridians/parallels) driven by `showGuides`. Optional corner-colour dots and tessellated gradient overlay projected to sphere; colours fixed to corner scheme.
- `src/export/exportSvg.ts` — builds standalone SVG string using same projection path, supports fills for closed shapes, and optionally includes guides when requested.
- `src/export/uvSvg.ts` — helper to export current UV scene to SVG and import simple UV-space SVG (line/rect/circle). Export includes `data-uv-scene="true"` marker; import can enforce marker via checkbox. Import assumes unit viewBox values; assigns new ids and defaults for missing stroke/fill.
- `src/export/jojosphere.ts` — JSON save/load of full app state (scene + rotation + guide/gradient/dot/projection toggles), file extension `.jojosphere`.
- `src/App.tsx` — manages scene state, selection, rotation sliders (degrees -> radians), colour editors, guide/gradient toggles, projection type toggle (orthographic/perspective/stereographic), export buttons, layouts; history stack for undo; passes movement handlers to UV editor. Styling in `src/index.css`.
- Added empty `yarn.lock` in repo root so Yarn treats this as its own project (home dir also has a package.json/yarn.lock).

## Decisions / assumptions
- Back hemisphere culled by `projectOrthographic` (z < 0 returns null). Clip-to-limb implemented via z=0 intersection on tessellated segments (no polygon clipping yet).
- Tessellation density: preview uses 48–64 samples; stroke width on sphere doubled for visibility.
- Selection highlights via drop-shadow filter; colour editors update selected shape immediately. Fill input disabled for lines. Moving a shape records history once at drag start; colour changes record on change.
- Guide lines show simple UV grid (8 divisions) projected; exported when toggle enabled.

## Follow-ups to consider
- Improve clipping for filled shapes/partial visibility (polygon clipping to sphere boundary).
- Consider better selection visuals (overlay layer) and basic edit/delete/redo/delete, undo is present.
- Persist scenes (localStorage) and allow importing/exporting UV data.
- Allow configuring guide density or loading a UV texture image instead of lines.
- Clipping: large shapes crossing the limb (e.g., big circles) still show artifacts; arc stitching helps small shapes but needs adaptive handling for large spans.
