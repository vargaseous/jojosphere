import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UVEditor } from './uv/UVEditor';
import { SpherePreview } from './sphere/SpherePreview';
import { initialScene, Scene, Shape, createId } from './model/scene';
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  const [projectionType, setProjectionType] = useState<ProjectionType>('perspective');
  const [flipU, setFlipU] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [transparentSphere, setTransparentSphere] = useState(false);
  const [fadeBackfaces, setFadeBackfaces] = useState(false);

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

  const selectedShapes = useMemo(
    () => scene.shapes.filter((s) => selectedIds.includes(s.id)),
    [scene.shapes, selectedIds],
  );
  const primarySelected = selectedShapes[0] ?? null;

  useEffect(() => {
    if (!primarySelected) return;
    setStrokeInput(primarySelected.stroke);
    if (primarySelected.type === 'rect' || primarySelected.type === 'circle' || primarySelected.type === 'polygon') {
      setFillInput(primarySelected.fill ?? '#e5e5e5');
    }
  }, [primarySelected]);

  const pushHistory = () => {
    setHistory((h) => [...h, sceneRef.current]);
    setFuture([]);
  };

  const handleAddShape = (shape: Shape) => {
    pushHistory();
    setScene((prev) => ({ shapes: [...prev.shapes, shape] }));
    setSelectedIds([shape.id]);
    setStrokeInput(shape.stroke);
    if (shape.type === 'rect' || shape.type === 'circle') {
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
    if (!selectedIds.length) return;
    pushHistory();
    setScene((prev) => ({ shapes: prev.shapes.filter((s) => !selectedIds.includes(s.id)) }));
    setSelectedIds([]);
  };

  const handleDuplicateSelected = () => {
    if (!selectedIds.length) return;
    const shapesToCopy = scene.shapes.filter((s) => selectedIds.includes(s.id));
    if (!shapesToCopy.length) return;
    pushHistory();
    const clones = shapesToCopy.map((shape) => ({ ...shape, id: createId('dup') }));
    setScene((prev) => ({ shapes: [...prev.shapes, ...clones] }));
    setSelectedIds(clones.map((c) => c.id));
  };

  const updateSelectedShapes = (updater: (shape: Shape) => Shape) => {
    if (!selectedIds.length) return;
    pushHistory();
    setScene((prev) => ({
      shapes: prev.shapes.map((s) => (selectedIds.includes(s.id) ? updater(s) : s)),
    }));
  };

  const shapeBounds = (shape: Shape) => {
    if (shape.type === 'line') {
      return {
        minU: Math.min(shape.a.u, shape.b.u),
        maxU: Math.max(shape.a.u, shape.b.u),
        minV: Math.min(shape.a.v, shape.b.v),
        maxV: Math.max(shape.a.v, shape.b.v),
      };
    }
    if (shape.type === 'rect') {
      return {
        minU: shape.origin.u,
        maxU: shape.origin.u + shape.size.w,
        minV: shape.origin.v,
        maxV: shape.origin.v + shape.size.h,
      };
    }
    if (shape.type === 'polygon') {
      return {
        minU: shape.center.u - shape.radius,
        maxU: shape.center.u + shape.radius,
        minV: shape.center.v - shape.radius,
        maxV: shape.center.v + shape.radius,
      };
    }
    if (shape.type === 'circle') {
      return {
        minU: shape.center.u - shape.radius,
        maxU: shape.center.u + shape.radius,
        minV: shape.center.v - shape.radius,
        maxV: shape.center.v + shape.radius,
      };
    }
    if (shape.type === 'latitude') {
      return { minU: 0, maxU: 1, minV: shape.v, maxV: shape.v };
    }
    return { minU: shape.u, maxU: shape.u, minV: 0, maxV: 1 };
  };

  const moveShapeBy = (shape: Shape, du: number, dv: number): Shape => {
    if (shape.type === 'line') {
      return { ...shape, a: { u: shape.a.u + du, v: shape.a.v + dv }, b: { u: shape.b.u + du, v: shape.b.v + dv } };
    }
    if (shape.type === 'rect') {
      return { ...shape, origin: { u: shape.origin.u + du, v: shape.origin.v + dv } };
    }
    if (shape.type === 'polygon') {
      return { ...shape, center: { u: shape.center.u + du, v: shape.center.v + dv } };
    }
    if (shape.type === 'circle') {
      return { ...shape, center: { u: shape.center.u + du, v: shape.center.v + dv } };
    }
    if (shape.type === 'latitude') {
      return { ...shape, v: shape.v + dv };
    }
    if (shape.type === 'longitude') {
      return { ...shape, u: shape.u + du };
    }
    return shape;
  };

  const shapeCenter = (shape: Shape): { u: number; v: number } => {
    if (shape.type === 'line') return { u: (shape.a.u + shape.b.u) / 2, v: (shape.a.v + shape.b.v) / 2 };
    if (shape.type === 'rect') return { u: shape.origin.u + shape.size.w / 2, v: shape.origin.v + shape.size.h / 2 };
    if (shape.type === 'polygon') return shape.center;
    if (shape.type === 'circle') return shape.center;
    if (shape.type === 'latitude') return { u: 0.5, v: shape.v };
    return { u: shape.u, v: 0.5 };
  };

  const setShapeCenter = (shape: Shape, u: number, v: number): Shape => {
    const center = shapeCenter(shape);
    const du = u - center.u;
    const dv = v - center.v;
    return moveShapeBy(shape, du, dv);
  };

  const alignSelected = (axis: 'h' | 'v', mode: 'start' | 'center' | 'end') => {
    const targets = selectedShapes.filter((s) => s.type !== 'latitude' && s.type !== 'longitude');
    if (targets.length < 2) return;
    const bounds = targets.map(shapeBounds);
    const globalMin = axis === 'h' ? Math.min(...bounds.map((b) => b.minU)) : Math.min(...bounds.map((b) => b.minV));
    const globalMax = axis === 'h' ? Math.max(...bounds.map((b) => b.maxU)) : Math.max(...bounds.map((b) => b.maxV));
    const targetCoord =
      mode === 'start' ? globalMin : mode === 'end' ? globalMax : (globalMin + globalMax) / 2;

    pushHistory();
    setScene((prev) => ({
      shapes: prev.shapes.map((s) => {
        if (!selectedIds.includes(s.id)) return s;
        if (s.type === 'latitude' || s.type === 'longitude') return s;
        const b = shapeBounds(s);
        const center = shapeCenter(s);
        if (axis === 'h') {
          if (mode === 'center') return setShapeCenter(s, targetCoord, center.v);
          if (mode === 'start') return moveShapeBy(s, targetCoord - b.minU, 0);
          return moveShapeBy(s, targetCoord - b.maxU, 0);
        }
        if (mode === 'center') return setShapeCenter(s, center.u, targetCoord);
        if (mode === 'start') return moveShapeBy(s, 0, targetCoord - b.minV);
        return moveShapeBy(s, 0, targetCoord - b.maxV);
      }),
    }));
  };

  const distributeSelected = (axis: 'h' | 'v') => {
    const targets = selectedShapes.filter((s) => s.type !== 'latitude' && s.type !== 'longitude');
    if (targets.length < 3) return;
    const sorted = [...targets].sort((a, b) => (axis === 'h' ? shapeCenter(a).u - shapeCenter(b).u : shapeCenter(a).v - shapeCenter(b).v));
    const centers = sorted.map((s) => shapeCenter(s));
    const min = axis === 'h' ? centers[0].u : centers[0].v;
    const max = axis === 'h' ? centers[centers.length - 1].u : centers[centers.length - 1].v;
    const step = (max - min) / (centers.length - 1);

    pushHistory();
    setScene((prev) => ({
      shapes: prev.shapes.map((s) => {
        const idx = sorted.findIndex((item) => item.id === s.id);
        if (idx === -1) return s;
        const target = min + step * idx;
        const current = shapeCenter(s);
        return axis === 'h' ? setShapeCenter(s, target, current.v) : setShapeCenter(s, current.u, target);
      }),
    }));
  };

  const handleUndo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [sceneRef.current, ...f]);
    setScene(prev);
    setSelectedIds((ids) => ids.filter((id) => prev.shapes.some((s) => s.id === id)));
  };

  const handleExport = () => {
    const svgString = exportSphereSvg(
      scene,
      rotation,
      { showGuides, orientation: { flipU, flipV }, transparentSphere, fadeBackfaces },
      projectionType,
    );
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
        setSelectedIds([]);
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
      fadeBackfaces,
      projection: projectionType,
      flipU,
      flipV,
      transparentSphere,
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
        setFadeBackfaces(state.fadeBackfaces ?? false);
        setProjectionType(state.projection ?? 'perspective');
        setFlipU(state.flipU ?? false);
        setFlipV(state.flipV ?? false);
        setTransparentSphere(state.transparentSphere ?? false);
        setSelectedIds([]);
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
          <input
            className="number-input"
            type="number"
            min={-180}
            max={180}
            step={1}
            value={rotX}
            onChange={(e) => setRotX(Number(e.target.value))}
          />
        </label>
        <label>
          Rot Y (°)
          <input type="range" min={-180} max={180} step={1} value={rotY} onChange={(e) => setRotY(Number(e.target.value))} />
          <input
            className="number-input"
            type="number"
            min={-180}
            max={180}
            step={1}
            value={rotY}
            onChange={(e) => setRotY(Number(e.target.value))}
          />
        </label>
        <label>
          Rot Z (°)
          <input type="range" min={-180} max={180} step={1} value={rotZ} onChange={(e) => setRotZ(Number(e.target.value))} />
          <input
            className="number-input"
            type="number"
            min={-180}
            max={180}
            step={1}
            value={rotZ}
            onChange={(e) => setRotZ(Number(e.target.value))}
          />
        </label>
        <label className="checkbox">
          Projection scheme
          <select value={projectionType} onChange={(e) => setProjectionType(e.target.value as ProjectionType)}>
            <option value="orthographic">Orthographic</option>
            <option value="perspective">Perspective</option>
            <option value="stereographic">Stereographic</option>
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={flipU} onChange={(e) => setFlipU(e.target.checked)} />
          Flip U
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={flipV} onChange={(e) => setFlipV(e.target.checked)} />
          Flip V
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
          selectedIds={selectedIds}
          onSelectShapes={setSelectedIds}
          onStartShapeTransform={pushHistory}
          onTransformShape={(id, shape) => handleUpdateShape(id, () => shape, false)}
          showGuides={showGuides}
          showGradient={showGradient}
          showDots={showDots}
          selectedShapes={selectedShapes}
          strokeInput={strokeInput}
          fillInput={fillInput}
          onStrokeChange={(value) => {
            setStrokeInput(value);
            if (!selectedIds.length) return;
            updateSelectedShapes((s) => ({ ...s, stroke: value }));
          }}
          onFillChange={(value) => {
            setFillInput(value);
            if (!selectedIds.length) return;
            updateSelectedShapes((s) => {
              if (s.type === 'line' || s.type === 'latitude' || s.type === 'longitude') return s;
              return { ...s, fill: value };
            });
          }}
          onDeleteSelected={handleDeleteSelected}
          onDuplicateSelected={handleDuplicateSelected}
          onAlign={alignSelected}
          onDistribute={distributeSelected}
        />
        <SpherePreview
          scene={scene}
          rotation={rotation}
          showGuides={showGuides}
          showGradient={showGradient}
          showDots={showDots}
          transparentSphere={transparentSphere}
          fadeBackfaces={fadeBackfaces}
          projectionType={projectionType}
          orientation={{ flipU, flipV }}
          onToggleGuides={(next) => setShowGuides(next)}
          onToggleGradient={(next) => setShowGradient(next)}
          onToggleDots={(next) => setShowDots(next)}
          onToggleTransparentSphere={(next) => setTransparentSphere(next)}
          onToggleFadeBackfaces={(next) => setFadeBackfaces(next)}
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
