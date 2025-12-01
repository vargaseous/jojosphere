import React, { useMemo, useState } from 'react';
import { UVEditor } from './uv/UVEditor';
import { SpherePreview } from './sphere/SpherePreview';
import { initialScene, Scene, Shape } from './model/scene';
import { Rotation } from './geometry/projection';
import { exportSphereSvg } from './export/exportSvg';

const degToRad = (deg: number) => (deg * Math.PI) / 180;

const App: React.FC = () => {
  const [scene, setScene] = useState<Scene>(() => initialScene());
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [rotZ, setRotZ] = useState(0);

  const rotation = useMemo<Rotation>(
    () => ({
      rx: degToRad(rotX),
      ry: degToRad(rotY),
      rz: degToRad(rotZ),
    }),
    [rotX, rotY, rotZ],
  );

  const handleAddShape = (shape: Shape) => {
    setScene((prev) => ({ shapes: [...prev.shapes, shape] }));
  };

  const handleExport = () => {
    const svgString = exportSphereSvg(scene, rotation);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sphere-export.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header className="header">
        <label>
          Rot X (°)
          <input type="range" min={-180} max={180} step={1} value={rotX} onChange={(e) => setRotX(Number(e.target.value))} />
          <span>{rotX}</span>
        </label>
        <label>
          Rot Y (°)
          <input type="range" min={-180} max={180} step={1} value={rotY} onChange={(e) => setRotY(Number(e.target.value))} />
          <span>{rotY}</span>
        </label>
        <label>
          Rot Z (°)
          <input type="range" min={-180} max={180} step={1} value={rotZ} onChange={(e) => setRotZ(Number(e.target.value))} />
          <span>{rotZ}</span>
        </label>
        <button type="button" className="export-button" onClick={handleExport}>
          Export sphere SVG
        </button>
      </header>

      <main className="main">
        <UVEditor scene={scene} onAddShape={handleAddShape} />
        <SpherePreview scene={scene} rotation={rotation} />
      </main>
    </div>
  );
};

export default App;
