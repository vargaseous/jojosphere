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

- Use the UV Editor (left) to draw lines or rectangles inside the unit square.
- Adjust rotation sliders (header) to rotate the sphere view (X/Y/Z in degrees).
- The Sphere Preview (right) shows the tessellated projection on the front hemisphere using an orthographic camera.
- Click **Export sphere SVG** to download a standalone `sphere-export.svg` with the current view.

## Notes

- Everything is kept minimal: no external styling dependencies; export uses only basic SVG elements.
- Back-facing geometry is culled (`z < 0`) rather than clipped at the limb; shapes that cross the terminator will break at the back edge. Tessellation density can be raised in `geometry/projection.ts` if needed.
