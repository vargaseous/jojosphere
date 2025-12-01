import React from 'react';
import { Scene } from '../model/scene';
import { Rotation, projectShapeToXY } from '../geometry/projection';

interface SpherePreviewProps {
  scene: Scene;
  rotation: Rotation;
}

export const SpherePreview: React.FC<SpherePreviewProps> = ({ scene, rotation }) => {
  return (
    <div className="panel">
      <div className="panel-header">Sphere Preview</div>
      <div className="panel-body">
        <svg viewBox="-1.1 -1.1 2.2 2.2">
          <circle cx={0} cy={0} r={1} fill="#fafafa" stroke="#cccccc" strokeWidth={0.01} />
          <g>
            {scene.shapes.map((shape) => {
              const points = projectShapeToXY(shape, rotation, 48);
              if (!points.length) return null;
              const pointString = points.map((p) => `${p.x},${p.y}`).join(' ');
              const stroke = shape.stroke;
              const strokeWidth = shape.strokeWidth * 2; // Slightly thicker for visibility on sphere
              return (
                <polyline
                  key={shape.id}
                  points={pointString}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};
