import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createGarageSequence } from './garage/sequence.mjs'
const flush = async () => { for (let i=0;i<8;i++) await Promise.resolve() }
const record = id => ({id,object:new THREE.Group(),position:new THREE.Vector3(1,0,2)})
let pending, loads=[], releases=[]
const make = gallery => createGarageSequence({entries:[{id:'lighting'},...(!gallery?[{id:'mclaren'}]:[])],gallery,
 loadVehicle:entry=>{loads.push(entry.id);return new Promise(resolve=>pending=resolve)},releaseVehicle:r=>releases.push(r.id),distance:()=>14,changed:()=>{}})
const composition=make(false);composition.start()
assert.deepEqual(loads,['lighting'])
const runner=record('lighting');pending(runner);await flush()
assert.equal(composition.vehicles.length,1,'First car arrives without waiting for the second load')
assert.equal(runner.object.position.z,-12)
composition.update(.45)
assert.ok(runner.object.position.z>-12&&runner.object.position.z<2)
assert.equal(runner.object.position.x,1);assert.equal(runner.object.position.y,0);assert.equal(runner.object.scale.x,1,'Perspective, not scale, supplies the approach')
composition.update(.45);await flush()
assert.deepEqual(loads,['lighting','mclaren'],'Second car loads after the first settles')
assert.equal(runner.object.position.z,2)
const f1=record('mclaren');pending(f1);await flush();composition.update(.9);await flush()
assert.equal(composition.busy,false);assert.equal(composition.vehicles.length,2)
composition.dispose();assert.deepEqual(releases,['lighting','mclaren'])
loads=[];releases=[]
const gallery=make(true);gallery.setReduced(true);gallery.start();pending(record('lighting'));await flush()
gallery.setReduced(false)
assert.equal(gallery.select({id:'mclaren'}),true)
assert.equal(gallery.select({id:'lancia'}),false,'Rapid input cannot overlap loads')
gallery.update(.55);await flush();assert.deepEqual(releases,['lighting']);assert.deepEqual(loads,['lighting','mclaren'])
const replacement=record('mclaren');pending(replacement);await flush();gallery.setReduced(true);await flush()
assert.deepEqual(replacement.object.position.toArray(),[1,0,2]);assert.equal(gallery.busy,false)
assert.equal(gallery.select({id:'lancia'}),true);await flush();gallery.dispose()
pending(record('lancia'));await flush();assert.ok(releases.includes('lancia'),'Late loads are released after leaving the page')
console.log('Garage sequence: staggered complete arrivals, fixed road perspective, exit/release/load, input lock, reduced motion and late-load cleanup passed.')
