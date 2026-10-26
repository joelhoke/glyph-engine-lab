/** Shared road-aligned arrival/departure for the About composition and car gallery. */
export function createGarageSequence({ entries, gallery = false, loadVehicle, releaseVehicle, distance, changed }) {
  const vehicles = [];
  let busy = false, disposed = false, reduced = false, motion = null;
  const notify = () => { if (!disposed) changed(); };
  function finish() {
    if (!motion) return;
    const current = motion; motion = null;
    current.record.object.position.copy(current.record.position);
    if (current.kind === 'exit') current.record.object.position.z += distance() * 1.35;
    current.resolve();
  }
  function drive(record, kind) {
    if (reduced) return Promise.resolve();
    return new Promise(resolve => {
      motion = { record, kind, elapsed: 0, resolve };
      if (kind === 'enter') record.object.position.z = record.position.z - distance();
      notify();
    });
  }
  async function arrive(entry) {
    const record = await loadVehicle(entry);
    if (!record) return false;
    if (disposed) { releaseVehicle(record); return false; }
    vehicles.push(record);
    if (reduced) record.object.position.copy(record.position);
    await drive(record, 'enter');
    return !disposed;
  }
  async function initial() {
    busy = true; notify();
    try { for (const entry of entries) { if (!await arrive(entry)) break; } }
    finally { busy = false; notify(); }
  }
  return {
    vehicles,
    get busy() { return busy; },
    start() { if (!busy && !disposed && !vehicles.length) void initial(); },
    select(entry) {
      if (!gallery || busy || disposed || vehicles[0]?.id === entry.id) return false;
      busy = true; notify();
      void (async () => {
        try {
          const previous = vehicles[0];
          if (previous) {
            await drive(previous, 'exit');
            if (disposed) return;
            vehicles.shift(); releaseVehicle(previous);
          }
          await arrive(entry);
        } finally { busy = false; notify(); }
      })();
      return true;
    },
    update(dt) {
      if (!motion) return;
      motion.elapsed += dt;
      const t = Math.min(1, motion.elapsed / (motion.kind === 'enter' ? .9 : .55));
      const offset = motion.kind === 'enter' ? -distance() * (1 - t) ** 3 : distance() * 1.35 * t * t;
      motion.record.object.position.copy(motion.record.position);
      motion.record.object.position.z += offset;
      if (t === 1) finish();
    },
    setReduced(value) { reduced = value; if (value) finish(); },
    dispose() { disposed = true; finish(); vehicles.splice(0).forEach(releaseVehicle); },
  };
}
