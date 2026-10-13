import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadGltfModel } from '../renderers/gltfModel';
import { prepareFilament } from './filament';
import { VIEW, GLASS } from './config';

export const EDISON_MODEL_URL = '/assets/about-light-study/models/edison/scene.gltf';

/** Shared housing and collar for the hanging fixture and smart-home preview. */
export function createBulbHousing() {
  const object = new THREE.Group();
  const socketMaterial = new THREE.MeshStandardMaterial({
    color: '#528ed1', roughness: 0.55, metalness: 0.35,
  });
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.027, VIEW.socketTop - VIEW.socketBottom, 48), socketMaterial);
  socket.position.y = (VIEW.socketTop + VIEW.socketBottom) / 2 - VIEW.socketTop;
  socket.castShadow = true;
  object.add(socket);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0275, 0.0275, 0.006, 48), socketMaterial);
  collar.position.y = VIEW.socketBottom + 0.003 - VIEW.socketTop;
  collar.castShadow = true;
  object.add(collar);
  return { object, material: socketMaterial };
}

/** One Edison geometry/material setup; renderers supply their glass capture when needed. */
export async function loadEdisonBulb(registerGlass?: (mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>) => void) {
  const loaded = await loadGltfModel({ THREE, GLTFLoader }, EDISON_MODEL_URL);
  const model = loaded.object;
  model.name = 'edison-bulb';
  // The supplied model is upright after its glTF root transform. Turn it cap-up.
  model.rotation.z = Math.PI;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const height = bounds.max.y - bounds.min.y;
  model.scale.setScalar(VIEW.bulbHeight / height);
  model.updateMatrixWorld(true);
  bounds.setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x, VIEW.bulbTop - VIEW.socketTop - bounds.max.y, -center.z);

  const filamentMaterials: THREE.MeshStandardMaterial[] = [];
  const glassMaterials: THREE.MeshPhysicalMaterial[] = [];
  const lightPosition = new THREE.Vector3();
  let filament: THREE.Mesh | undefined;
  const oldMaterials = new Set<THREE.Material>();
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = false;
    object.receiveShadow = false;
    const original = object.material as THREE.MeshStandardMaterial;
    oldMaterials.add(original);
    if (original.name === 'glass') {
      object.material = new THREE.MeshPhysicalMaterial({
        name: 'bulb-glass', color: '#fff7e9', metalness: 0, roughness: GLASS.roughness,
        transmission: GLASS.transmission, ior: GLASS.ior,
        envMapIntensity: GLASS.environmentIntensity, side: THREE.FrontSide,
      });
      glassMaterials.push(object.material);
      registerGlass?.(object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>);
    } else if (original.name === 'glass-thicker') {
      // Nested transmission isn't supported by the forward transmission pass.
      // Keep the inner support softly transparent instead.
      object.material = new THREE.MeshPhysicalMaterial({
        name: 'inner-glass', color: '#d9d3c8', roughness: 0.1,
        transparent: true, opacity: 0.16, depthWrite: false,
        envMapIntensity: 0.3,
      });
    } else {
      const material = original.clone();
      object.material = material;
      if (original.name === 'glow') {
        prepareFilament(material);
        filamentMaterials.push(material);
        filament = object;
      } else if (original.name === 'gold') {
        // The screw base is enclosed by the socket, not exposed decorative metal.
        object.visible = false;
        material.color.set('#927040');
        material.metalness = 0.85;
        material.roughness = 0.3;
        object.castShadow = true;
      } else {
        material.color.set(original.name === 'black' ? '#141211' : '#3c3430');
        material.roughness = 0.38;
        material.metalness = 0.6;
      }
    }
  });
  oldMaterials.forEach((material) => material.dispose());
  // Measure the filament while the model is still in fixture-local space.
  // A newly parented model can otherwise inherit a stale fixture world matrix
  // when its cached assets finish loading before the first rendered frame.
  model.updateMatrixWorld(true);
  if (filament) {
    new THREE.Box3().setFromObject(filament).getCenter(lightPosition);
  }
  return { object: model, filamentMaterials, glassMaterials, lightPosition, dispose: loaded.dispose };
}
