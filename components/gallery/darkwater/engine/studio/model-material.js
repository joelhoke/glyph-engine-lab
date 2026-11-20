import { Material, MeshStandardMaterial } from 'three';

// Photogrammetry GLBs often declare KHR_materials_unlit: their color texture
// looks detailed, but ignores every scene light. Relight only that material;
// retain the original asset and all of its texture/geometry data for switching.
export function modelMaterial(source, lighting = 'studio') {
  if(lighting==='original' || !source.isMeshBasicMaterial)return source.clone();
  const material=new MeshStandardMaterial({roughness:.72,metalness:0});
  Material.prototype.copy.call(material,source);
  material.color.copy(source.color);
  for(const key of ['map','alphaMap','aoMap','aoMapIntensity','lightMap','lightMapIntensity','envMap','wireframe','wireframeLinewidth','flatShading']) {
    if(source[key]!==undefined)material[key]=source[key];
  }
  return material;
}
