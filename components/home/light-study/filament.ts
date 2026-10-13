import * as THREE from 'three';
import { LIGHTING } from './config';

/** The coil is a physical wire; its emitted light is a separate material channel. */
export function prepareFilament(material: THREE.MeshStandardMaterial) {
  material.color.set('#b9ac97');
  material.roughness = 0.4;
  material.metalness = 0.25;
  material.envMapIntensity = 0.65;
  material.transparent = false;
  material.opacity = 1;
  material.visible = true;
}

export function setFilamentEmission(material: THREE.MeshStandardMaterial, color: THREE.Color, level: number) {
  material.emissive.copy(color);
  material.emissiveIntensity = LIGHTING.filamentEmission * Math.max(0, level);
}
