import { Scene } from '../model/scene';
import { ProjectionType } from '../geometry/projection';

export interface JojosphereState {
  version: 1;
  rotation: { rotX: number; rotY: number; rotZ: number };
  showGuides: boolean;
  showGradient: boolean;
  showDots: boolean;
  fadeBackfaces?: boolean;
  projection?: ProjectionType;
  flipU?: boolean;
  flipV?: boolean;
  transparentSphere?: boolean;
  scene: Scene;
}

export function serializeJojosphere(state: JojosphereState): string {
  return JSON.stringify(state, null, 2);
}

export function parseJojosphere(text: string): JojosphereState {
  const parsed = JSON.parse(text);
  if (parsed.version !== 1) {
    throw new Error('Unsupported jojosphere version');
  }
  if (!parsed.scene || !Array.isArray(parsed.scene.shapes)) {
    throw new Error('Invalid scene in jojosphere file');
  }
  return parsed as JojosphereState;
}
