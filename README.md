# jojosphere Sphere Editor

React + Vite app for drawing simple UV-space shapes, mapping them onto a sphere, and exporting the projected view as a clean SVG suitable for design tools.

## Why I made (vibecoded) this

I had a project at work that involved drawing geometries on a sphere.

Didn't want to manually calculate the geometry on Illustrator/Affinity and wanted to experiment (wasn't feeling like fiddling with Matplotlib).

I could also just use something like Blender but I wanted the export to be an SVG and not a raster.

So uhhh I thought of this and then used a combination of Gemini and Codex and some manual styling to make it happen. Yay.

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