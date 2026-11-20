import { Box3, Vector3, Group, Mesh, MeshStandardMaterial, LoadingManager } from 'three';

export const MAX_MODEL_BYTES = 100 * 1024 * 1024;
export const MODEL_MEMORY_BUDGET = 512 * 1024 * 1024;
export const SCENE_BUDGET = 16;

// Cost estimates include the direct and reflected render passes. They are an
// admission budget, not a frame-rate guarantee. Never alter an asset to fit it.
export function modelCost(stats) {
  return Math.max(1, Math.ceil(Math.max(stats.triangles / 125000, stats.drawCalls / 16, stats.bytes / (32 * 1024 * 1024))));
}
export function sceneCapacity(bodies, model = null) {
  const used = bodies.reduce((sum, body) => sum + (body.cost ?? 1), 0);
  const cost = model?.cost ?? 1;
  return { used, cost, remaining: Math.max(0, Math.floor((SCENE_BUDGET - used) / cost)) };
}

// Validate without rewriting the GLB: geometry, UVs, materials and embedded
// images reach GLTFLoader byte-for-byte. Fail explicitly for missing decoders.
export function prepareGLB(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0,true)!==0x46546c67 || view.getUint32(4,true)!==2 || view.getUint32(8,true)!==buffer.byteLength) throw new Error('This is not a valid GLB 2.0 file.');
  const length=view.getUint32(12,true);
  if(view.getUint32(16,true)!==0x4e4f534a || length+20>buffer.byteLength)throw new Error('The GLB file is incomplete.');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));
  if([...(json.buffers??[]),...(json.images??[])].some(b=>b.uri && !b.uri.startsWith('data:')))throw new Error('Export a self-contained GLB with embedded geometry and textures.');
  const supported = new Set(['KHR_materials_unlit','KHR_mesh_quantization','EXT_meshopt_compression','KHR_texture_transform','KHR_materials_clearcoat','KHR_materials_dispersion','KHR_materials_ior','KHR_materials_sheen','KHR_materials_specular','KHR_materials_transmission','KHR_materials_volume','KHR_materials_emissive_strength','KHR_materials_iridescence','KHR_materials_anisotropy','EXT_texture_webp','EXT_texture_avif','EXT_mesh_gpu_instancing']);
  for(const extension of json.extensionsRequired??[])if(!supported.has(extension))throw new Error(`This model requires ${extension}. Export a GLB with uncompressed geometry and PNG or JPEG textures to preserve its appearance.`);
  if((json.meshes??[]).some(m=>m.primitives.some(p=>p.extensions?.KHR_draco_mesh_compression)))throw new Error('Export the GLB without Draco compression; geometry and textures will be kept at full detail.');
  if((json.textures??[]).some(t=>t.extensions?.KHR_texture_basisu))throw new Error('Export the GLB with PNG or JPEG textures instead of KTX2 textures.');
  return buffer;
}

export function disposeModel(model) {
  const geometries=new Set(),materials=new Set(),textures=new Set();
  model?.scene?.traverse(o=>{
    if(o.geometry)geometries.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}
  });
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
  const images=new Set();for(const t of textures){if(t.source?.data)images.add(t.source.data);t.dispose();}
  for(const image of images)image.close?.();
}

export function modelFromScene(root,name) {
  root.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(root,true),extent=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
  const size=Math.max(extent.x,extent.y,extent.z),buffers=new Set(),textures=new Set();
  let triangles=0,drawCalls=0,bytes=0,maxTextureDimension=0,unlit=false;
  root.traverseVisible(o=>{
    if(o.isLine || o.isPoints)throw new Error('Export this model as triangle meshes; line and point primitives are not supported.');
    if(!o.isMesh)return;
    const g=o.geometry,p=g.attributes.position;if(!p)return;
    for(let i=0;i<p.count;i++)if(!Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)))throw new Error('The model contains invalid coordinates.');
    triangles+=Math.floor((g.index?.count??p.count)/3)*(o.isInstancedMesh?o.count:1);
    const materials=Array.isArray(o.material)?o.material:[o.material];
    unlit ||= materials.some(m=>m.isMeshBasicMaterial);
    drawCalls+=Math.max(1,g.groups.length)* (materials.some(m=>m.transmission>0)?3:1);
    for(const attribute of [g.index,...Object.values(g.attributes),...Object.values(g.morphAttributes).flat(),o.instanceMatrix,o.instanceColor]) {
      const buffer=(attribute?.data?.array??attribute?.array)?.buffer;if(buffer)buffers.add(buffer);
    }
    for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  });
  for(const buffer of buffers)bytes+=buffer.byteLength;
  const sources=new Set();
  for(const texture of textures) {
    if(sources.has(texture.source))continue;sources.add(texture.source);
    const image=texture.source.data;
    maxTextureDimension=Math.max(maxTextureDimension,image?.width??0,image?.height??0);
    bytes+=(image?.width??1)*(image?.height??1)*4*(texture.generateMipmaps?4/3:1);
  }
  if(!triangles)throw new Error('No usable triangle mesh was found in this file.');
  if(!Number.isFinite(size)||size<1e-8)throw new Error('The model has invalid bounds.');
  const stats={triangles,drawCalls,bytes,maxTextureDimension},cost=modelCost(stats);
  if(cost>SCENE_BUDGET)throw new Error('This model exceeds the scene budget at full detail. Export a lighter copy, or use fewer/lower-resolution textures. No detail has been reduced.');
  // Normalize only the wrapper. All original buffers, hierarchy, material
  // assignments, skinning and morph weights remain untouched.
  const scene=new Group(),offset=new Group();offset.position.copy(center).negate();offset.add(root);scene.add(offset);scene.scale.setScalar(1/size);scene.updateMatrixWorld(true);
  return {name,scene,extent:extent.divideScalar(size),stats,cost,unlit,lighting:'studio',sourceTriangles:triangles};
}

export async function readModel(file,onProgress=()=>{}) {
  if(!file || file.size>MAX_MODEL_BYTES)throw new Error('Choose a model smaller than 100 MB.');
  const extension=file.name.split('.').pop().toLowerCase();
  if(!['glb','obj','stl'].includes(extension))throw new Error('Choose a GLB, OBJ, or STL file.');
  let root;
  try {
    onProgress('Reading original geometry and materials…');
    if(extension==='obj') {
      const {OBJLoader}=await import('three/addons/loaders/OBJLoader.js');
      const text=await file.text();
      if(/^\s*mtllib\s+/m.test(text))throw new Error('This OBJ references a separate material file. Export a GLB with embedded materials and textures to keep its appearance.');
      root=new OBJLoader().parse(text);
    } else if(extension==='stl') {
      const {STLLoader}=await import('three/addons/loaders/STLLoader.js');
      const geometry=new STLLoader().parse(await file.arrayBuffer());
      root=new Group();root.add(new Mesh(geometry,new MeshStandardMaterial({color:0xc4c8d0,roughness:.45,vertexColors:!!geometry.attributes.color})));
    } else {
      const [{GLTFLoader},{MeshoptDecoder}]=await Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('three/addons/libs/meshopt_decoder.module.js')]);
      const manager=new LoadingManager();let resourceError=false;
      manager.onError=()=>{resourceError=true;};
      manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;throw new Error('Export a self-contained GLB with embedded textures.');});
      const gltf=await new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder).parseAsync(prepareGLB(await file.arrayBuffer()),'');
      root=gltf.scene;
      if(resourceError)throw new Error('A model texture could not be opened. Export a GLB with embedded PNG or JPEG textures.');
    }
    onProgress('Checking scene capacity…');
    return modelFromScene(root,file.name);
  } catch(error) {if(root)disposeModel({scene:root});throw error;}
}

export class ModelLibrary {
  models=[];revision=0;nextId=1;
  constructor(maxTextureSize=Infinity){this.maxTextureSize=maxTextureSize;}
  add(model) {
    if(model.stats.maxTextureDimension>this.maxTextureSize)throw new Error(`A model texture exceeds this device’s ${this.maxTextureSize}px limit. Export smaller textures; this upload has not been resized.`);
    if(this.models.reduce((sum,m)=>sum+m.stats.bytes,0)+model.stats.bytes>MODEL_MEMORY_BUDGET)throw new Error('The model library is full. Remove an uploaded model to free memory.');
    const asset={...model,id:`model-${this.nextId++}`};this.models.push(asset);this.revision++;return asset;
  }
  get(id){return this.models.find(m=>m.id===id);}
  remove(id){const asset=this.get(id);this.models=this.models.filter(m=>m.id!==id);disposeModel(asset);this.revision++;}
}
