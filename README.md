# Sphere Editor

React + Vite app for drawing simple UV-space shapes, mapping them onto a sphere, and exporting the projected view as a clean SVG suitable for design tools.

## Getting started

```bash
yarn install
yarn dev
```

Then open the printed local URL (usually http://localhost:5173).

### Build

```bash
yarn build
yarn preview
```

## Usage

- Use the UV Editor (left) to draw **lines**, **rectangles**, or **circles** in UV space.
- Switch to **Select** to pick a shape, see its bounding box, drag/move it, and adjust stroke/fill colours from the UV panel header (fill is disabled for lines).
- Toggle **Show UV guides** to overlay a UV grid on both the editor and the sphere preview for orientation.
- Toggle **UV corner gradient** to overlay a 4-corner gradient on the UV editor and project it onto the sphere surface.
- Toggle **Dot grid overlay** to show colored dots mapped to the sphere (uses fixed corner colours).
- Choose a **Projection type** to alter mapping (orthographic / perspective / stereographic) for orientation checks.
- Adjust rotation sliders (header) to rotate the sphere view (X/Y/Z in degrees).
- The Sphere Preview (right) shows the tessellated projection using the selected projection type.
- Use **Undo** to revert the last change (shape edits, moves, colour changes, additions).
- **Save UV SVG** downloads the current UV scene (unit square) as an SVG with a marker attribute; **Load UV SVG** imports simple line/rect/circle shapes from an SVG (expects unit-space coords). The **Require UV marker** checkbox enforces that the file includes the marker.
- **Save/Load .jojosphere** stores the full scene plus settings (rotation, guides, gradient, dots, projection) in JSON.
- Click **Export sphere SVG** to download a standalone `sphere-export.svg` with the current view (guides included when enabled).

## Notes

- Everything is kept minimal: no external styling dependencies; export uses only basic SVG elements.
- Back-facing geometry is culled (`z < 0`) rather than clipped at the limb; shapes that cross the terminator will break at the back edge. Tessellation density can be raised in `geometry/projection.ts` if needed.
