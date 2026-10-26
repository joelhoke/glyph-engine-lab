/** Keep the authored lighting controller; only About omits unused high-beam sources. */
export function createGarageLighting(root, createVehicleLighting, detailed) {
  const high = [];
  if (!detailed) root.traverse(node => {
    if (node.userData.beam && node.userData.lightChannel === 'high') {
      high.push(node); node.userData.beam = false;
    }
  });
  try { return createVehicleLighting(root); }
  finally { high.forEach(node => { node.userData.beam = true; }); }
}
