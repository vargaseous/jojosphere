import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UVEditor } from './uv/UVEditor';
import { SpherePreview } from './sphere/SpherePreview';
import { initialScene, Scene, Shape } from './model/scene';
import { ProjectionType, Rotation } from './geometry/projection';
import { exportSphereSvg } from './export/exportSvg';
import { sceneToUvSvg, uvSvgToShapes } from './export/uvSvg';
import { JojosphereState, parseJojosphere, serializeJojosphere } from './export/jojosphere';

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jojosphereInputRef = useRef<HTMLInputElement | null>(null);
  const [requireMarker, setRequireMarker] = useState(true);
  const [showGradient, setShowGradient] = useState(false);
  const [showDots, setShowDots] = useState(false);
  const [projectionType, setProjectionType] = useState<ProjectionType>('orthographic');

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

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    pushHistory();
    setScene((prev) => ({ shapes: prev.shapes.filter((s) => s.id !== selectedId) }));
    setSelectedId(null);
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
    const svgString = exportSphereSvg(scene, rotation, { showGuides }, projectionType);
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

  const handleSaveUv = () => {
    const svg = sceneToUvSvg(scene);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'uv-scene.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadUv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      try {
        const shapes = uvSvgToShapes(text, requireMarker);
        pushHistory();
        setScene({ shapes });
        setSelectedId(null);
      } catch (err) {
        // eslint-disable-next-line no-alert
        alert((err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveJojosphere = () => {
    const data: JojosphereState = {
      version: 1,
      rotation: { rotX, rotY, rotZ },
      showGuides,
      showGradient,
      showDots,
      projection: projectionType,
      scene,
    };
    const json = serializeJojosphere(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'scene.jojosphere';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadJojosphere = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const state = parseJojosphere(reader.result as string);
        pushHistory();
        setScene(state.scene);
        setRotX(state.rotation.rotX);
        setRotY(state.rotation.rotY);
        setRotZ(state.rotation.rotZ);
        setShowGuides(state.showGuides);
        setShowGradient(state.showGradient);
        setShowDots(state.showDots);
        setProjectionType(state.projection);
        setSelectedId(null);
      } catch (err) {
        // eslint-disable-next-line no-alert
        alert((err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const triggerLoadUv = () => {
    fileInputRef.current?.click();
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
          Projection scheme
          <select value={projectionType} onChange={(e) => setProjectionType(e.target.value as ProjectionType)}>
            <option value="orthographic">Orthographic</option>
            <option value="perspective">Perspective</option>
            <option value="stereographic">Stereographic</option>
          </select>
        </label>

        <button type="button" className="secondary-button" onClick={handleUndo} disabled={!history.length}>
          Undo
        </button>
        <button type="button" className="secondary-button" onClick={handleSaveUv}>
          Save UV SVG
        </button>
        <button type="button" className="secondary-button" onClick={triggerLoadUv}>
          Load UV SVG
        </button>
        <button type="button" className="secondary-button" onClick={handleSaveJojosphere}>
          Save .jojosphere
        </button>
        <button type="button" className="secondary-button" onClick={() => jojosphereInputRef.current?.click()}>
          Load .jojosphere
        </button>
        <label className="checkbox">
          <input type="checkbox" checked={requireMarker} onChange={(e) => setRequireMarker(e.target.checked)} />
          File import compatibility check
        </label>

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
          showGradient={showGradient}
          showDots={showDots}
          selectedShape={selectedShape}
          strokeInput={strokeInput}
          fillInput={fillInput}
          onStrokeChange={(value) => {
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
          onFillChange={(value) => {
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
          onDeleteSelected={handleDeleteSelected}
        />
        <SpherePreview
          scene={scene}
          rotation={rotation}
          showGuides={showGuides}
          showGradient={showGradient}
          showDots={showDots}
          projectionType={projectionType}
          onToggleGuides={(next) => setShowGuides(next)}
          onToggleGradient={(next) => setShowGradient(next)}
          onToggleDots={(next) => setShowDots(next)}
        />
      </main>
      <input
        ref={jojosphereInputRef}
        type="file"
        accept=".jojosphere,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleLoadJojosphere(file);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/svg+xml"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleLoadUv(file);
          e.target.value = '';
        }}
      />
    </div>
  );
};

export default App;
