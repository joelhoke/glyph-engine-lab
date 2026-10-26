// Site adapter for the canonical playground's model/load/framing functions.
const rig = mode === 'gallery' ? { apply() {} } : createRig(THREE, scene);
const welcome = createGarageWelcome();
let illumination = [], active = true, reduced = false, disposed = false, previous = 0;
let bounds = mount.getBoundingClientRect();
let preparing = false;
const gallery = mode === 'gallery';
const galleryEntry = id => ({ id, scale: 1, x: 0, z: 0 });
const focused = () => sequence.vehicles.find(item => item.lighting);
const road = createGarageRoad(THREE, scene, gallery ? [galleryEntry('lighting')] : GARAGE_COMPOSITION);
road.setFit(cameraFit);
const roadMarks = road.object;
const raycaster = new THREE.Raycaster();
function lightState() {
  if (disposed) return;
  const lamp = focused()?.lighting;
  if (controls) controls.enabled = active && !sequence.busy;
  onState({ busy: sequence.busy, hasLights: !!lamp, lightsOn: !!lamp && lamp.getState().beams !== 'off', lamps: lamp?.getState() ?? DEFAULT_LIGHT_STATE, night, orbit: !!controls?.autoRotate, wire, vehicles: sequence.busy ? [] : sequence.vehicles.map(item => item.id) });
  if (!gallery && !sequence.busy && focused()) placeVehicleButtons();
  invalidate();
}
function placeVehicleButtons() {
  camera.updateMatrixWorld();
  for (const record of sequence.vehicles) {
  const vehicle = record.object;
  vehicle.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(vehicle), points = [];
  for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
    const p = new THREE.Vector3(x,y,z).project(camera); points.push({x:(p.x+1)*bounds.width/2,y:(1-p.y)*bounds.height/2});
  }
  const left = Math.max(0,Math.min(...points.map(p=>p.x))), top = Math.max(0,Math.min(...points.map(p=>p.y)));
  mount.style.setProperty(`--vehicle-${record.id}-left`,`${left}px`); mount.style.setProperty(`--vehicle-${record.id}-top`,`${top}px`);
  mount.style.setProperty(`--vehicle-${record.id}-width`,`${Math.max(0,Math.min(bounds.width,Math.max(...points.map(p=>p.x)))-left)}px`);
  mount.style.setProperty(`--vehicle-${record.id}-height`,`${Math.max(0,Math.min(bounds.height,Math.max(...points.map(p=>p.y)))-top)}px`);
  }
}
function releaseVehicle(record) {
  if (record.lighting) welcome.start(null, true);
  record.lighting?.dispose(); scene.remove(record.object); dispose(record.object);
}
const sequence = createGarageSequence({
  entries: gallery ? [galleryEntry('lighting')] : GARAGE_COMPOSITION,
  gallery, distance: () => 14 * cameraFit, changed: lightState, releaseVehicle,
  loadVehicle: async entry => {
    // Detach the loader's selection pointers so its canonical cleanup cannot
    // dispose a car already retained in the shared composition.
    vehicle = null; lighting = null;
    let record;
    try {
      const loaded = await load(entry.id);
      if (!loaded || disposed) return null;
      placeGarageVehicle(vehicle, entry);
      record = { object: vehicle, lighting, wheels: createVehicleWheels(THREE, vehicle, entry.id), id: entry.id, position: vehicle.position.clone() };
      record.object.position.z -= 14 * cameraFit;
      record.lighting?.setState({ beams: 'low', fog: true, accent: true, tails: true, signals: 'off' });
      preparing = true;
      rig.apply(illumination, {left:0,top:0,width:innerWidth,height:innerHeight}, bounds);
      status.hidden = false; status.textContent = 'Preparing model…';
      await prepareGarageVehicle(renderer, scene, camera, record.object);
      if (disposed) { releaseVehicle(record); return null; }
      if (record.lighting) welcome.start(record.lighting, reduced);
      status.hidden = true;
      return record;
    } catch (error) {
      if (record) releaseVehicle(record);
      if (!disposed) { status.hidden = false; status.textContent = 'Unable to prepare this car.'; console.error(error); }
      return null;
    } finally { preparing = false; }
  },
});
const loop = createFrameLoop({
  isParked: () => disposed || document.hidden || !active,
  keepRunning: () => !reduced,
  requestFrame: callback => setTimeout(() => callback(performance.now()), 1000 / 30),
  cancelFrame: handle => clearTimeout(handle),
  frame: now => {
    const dt = previous ? Math.min((now - previous) / 1000, .05) : 0; previous = now;
    if (!reduced) roadMarks.position.z = (roadMarks.position.z - dt * 3) % 2;
    if (controls && !sequence.busy) controls.update(reduced ? 0 : dt);
    if (welcome.update(reduced ? 0 : dt)) lightState();
    const before = sequence.vehicles.map(item => item.object.position.z);
    sequence.update(reduced ? 0 : dt);
    if (!reduced) sequence.vehicles.forEach((item, index) => item.wheels?.advance(dt * 3 + item.object.position.z - before[index]));
    rig.apply(illumination, {left:0,top:0,width:innerWidth,height:innerHeight}, bounds);
    // Keep completed cars visible during downloads; freeze only GPU preparation.
    if (!preparing) renderFrame();
  },
});
function invalidate() { loop.renderOnce(); }
const resize = new ResizeObserver(() => {
  bounds = mount.getBoundingClientRect();
  const w = Math.max(1,bounds.width), h = Math.max(1,bounds.height);
  renderer.setSize(w,h); composer?.setSize(w,h); camera.aspect = w/h;
  const fit = Math.max(1,1.12/camera.aspect);
  camera.position.sub(cameraTarget).multiplyScalar(fit/cameraFit).add(cameraTarget);
  cameraFit=fit; road.setFit(fit);
  // Reference composition: large quarter view, center-left, slightly above center.
  camera.setViewOffset(w,h,w*(!gallery && w > 700 ? .12 : 0),h*.02,w,h);
  camera.lookAt(cameraTarget); camera.updateProjectionMatrix();
  if (!gallery && !sequence.busy && focused()) placeVehicleButtons();
  invalidate();
}); resize.observe(mount);
const visibility = () => { previous=0; if (document.hidden) loop.park(); else loop.resume(); };
document.addEventListener('visibilitychange',visibility);
const controlsChange = () => invalidate();
controls?.addEventListener('change', controlsChange);
let press = null;
const pointerDown = event => { press = { x:event.clientX, y:event.clientY }; };
const pointerUp = event => {
  if (press && Math.hypot(event.clientX-press.x,event.clientY-press.y)<5) toggleVehicleLights({x:event.clientX,y:event.clientY});
  press = null;
};
if (gallery) { renderer.domElement.addEventListener('pointerdown',pointerDown); renderer.domElement.addEventListener('pointerup',pointerUp); }
view('hero'); sequence.start(); invalidate();
function pickVehicle(point) {
  if (sequence.busy) return null;
  camera.updateMatrixWorld();
  raycaster.setFromCamera({x:(point.x-bounds.left)/bounds.width*2-1,y:1-(point.y-bounds.top)/bounds.height*2},camera);
  let closest = Infinity, id = null;
  for (const record of sequence.vehicles) {
    record.object.updateMatrixWorld(true);
    const hit = raycaster.intersectObject(record.object,true)[0];
    if (hit && hit.distance < closest) { closest = hit.distance; id = record.id; }
  }
  return id;
}
function toggleVehicleLights(point) {
  const record = focused();
  if (!record || sequence.busy || (point && pickVehicle(point) !== record.id)) return;
  welcome.toggle(); lightState();
}

return {
  pickVehicle,
  load(id) {
    if (!catalog[id] || sequence.busy || !gallery) return false;
    view('hero'); return sequence.select(galleryEntry(id));
  },
  setNight(value) { if (gallery) { setNight(value); lightState(); } },
  setLights(patch) { if (gallery && !sequence.busy && focused()) { welcome.setState(patch); lightState(); } },
  setView(name) { if (gallery && !sequence.busy && ['hero','front','side','passenger','rear','top'].includes(name)) { view(name); lightState(); } },
  setOrbit(value) { if (controls && !sequence.busy) { controls.autoRotate=value && !reduced; lightState(); } },
  setWire(value) {
    if (!gallery || sequence.busy) return;
    wire=value;
    sequence.vehicles.forEach(record=>record.object.traverse(node=>{if(node.isMesh)(Array.isArray(node.material)?node.material:[node.material]).forEach(material=>material.wireframe=value)}));
    lightState();
  },
  toggleLights: toggleVehicleLights,
  setActive(value, reduce) { active=value; reduced=reduce; sequence.setReduced(reduce); if (reduce) { welcome.settle(); if (controls) controls.autoRotate=false; } previous=0; lightState(); if (active) loop.resume(); else loop.park(); },
  setIllumination(value) { illumination=value; invalidate(); },
  dispose() {
    disposed=true; token++; loop.dispose(); resize.disconnect(); document.removeEventListener('visibilitychange',visibility);
    welcome.start(null, true); sequence.dispose();
    controls?.removeEventListener('change',controlsChange); controls?.dispose();
    renderer.domElement.removeEventListener('pointerdown',pointerDown); renderer.domElement.removeEventListener('pointerup',pointerUp);
    composer?.passes.forEach(pass=>pass.dispose?.()); composer?.dispose(); postTarget?.dispose();
    road.dispose(); dispose(scene); grid.geometry.dispose(); grid.material.dispose(); environmentTarget.dispose();
    renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); spare.clear();
  },
};
