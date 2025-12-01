import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [strokeInput, setStrokeInput] = useState('#000000');
  const [fillInput, setFillInput] = useState('#e5e5e5');
  const [showGuides, setShowGuides] = useState(true);
  const [history, setHistory] = useState<Scene[]>([]);
  const [future, setFuture] = useState<Scene[]>([]);
  const sceneRef = useRef(scene);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  const rotation = useMemo<Rotation>(
    () => ({
      rx: degToRad(rotX),
      ry: degToRad(rotY),
      rz: degToRad(rotZ),
    }),
    [rotX, rotY, rotZ],
  );

  const selectedShape = useMemo(() => scene.shapes.find((s) => s.id === selectedId) ?? null, [scene.shapes, selectedId]);

  useEffect(() => {
    if (!selectedShape) return;
    setStrokeInput(selectedShape.stroke);
    if (selectedShape.type !== 'line') {
      setFillInput(selectedShape.fill ?? '#e5e5e5');
    }
  }, [selectedShape]);

  const pushHistory = () => {
    setHistory((h) => [...h, sceneRef.current]);
    setFuture([]);
  };

  const handleAddShape = (shape: Shape) => {
    pushHistory();
    setScene((prev) => ({ shapes: [...prev.shapes, shape] }));
    setSelectedId(shape.id);
    setStrokeInput(shape.stroke);
    if (shape.type !== 'line') {
      setFillInput(shape.fill ?? '#e5e5e5');
    }
  };

  const handleUpdateShape = (id: string, updater: (shape: Shape) => Shape, recordHistory = true) => {
    if (recordHistory) pushHistory();
    setScene((prev) => ({
      shapes: prev.shapes.map((s) => (s.id === id ? updater(s) : s)),
    }));
  };

  const handleUndo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [sceneRef.current, ...f]);
    setScene(prev);
    setSelectedId((id) => (prev.shapes.some((s) => s.id === id) ? id : null));
  };

  const handleExport = () => {
    const svgString = exportSphereSvg(scene, rotation, { showGuides });
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
        <label className="checkbox">
          <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />
          Show UV guides
        </label>

        <div className="color-controls">
          {selectedShape ? (
            <>
              <span>Selected: {selectedShape.type}</span>
              <label>
                Stroke
                <input
                  type="color"
                  value={strokeInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStrokeInput(value);
                    if (!selectedId) return;
                    handleUpdateShape(
                      selectedId,
                      (s) => ({
                        ...s,
                        stroke: value,
                      }),
                      true,
                    );
                  }}
                />
              </label>
              <label>
                Fill
                <input
                  type="color"
                  value={fillInput}
                  disabled={selectedShape.type === 'line'}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFillInput(value);
                    if (!selectedId) return;
                    handleUpdateShape(
                      selectedId,
                      (s) => {
                        if (s.type === 'line') return s;
                        return { ...s, fill: value };
                      },
                      true,
                    );
                  }}
                />
              </label>
            </>
          ) : (
            <span>No selection</span>
          )}
        </div>
        <button type="button" className="secondary-button" onClick={handleUndo} disabled={!history.length}>
          Undo
        </button>

        <button type="button" className="export-button" onClick={handleExport}>
          Export sphere SVG
        </button>
      </header>

      <main className="main">
        <UVEditor
          scene={scene}
          onAddShape={handleAddShape}
          selectedId={selectedId}
          onSelectShape={setSelectedId}
          onStartShapeTransform={pushHistory}
          onTransformShape={(id, shape) => handleUpdateShape(id, () => shape, false)}
          showGuides={showGuides}
        />
        <SpherePreview scene={scene} rotation={rotation} showGuides={showGuides} />
      </main>
    </div>
  );
};

export default App;
