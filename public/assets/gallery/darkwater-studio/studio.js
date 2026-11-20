import{a as Qi}from"./chunks/chunk-V2SWVJAK.js";import{$ as lt,B as gt,C as qe,D as pe,E as G,Ea as Wi,F as se,G as _,Ia as Yi,J as de,Ja as ct,K as $,Ka as Bi,L as Pe,M as rt,Ma as kt,N as Qe,O as Xe,P as ue,Q as nt,R as ji,Ra as dt,S as yt,Sa as mi,T as Ze,Ta as It,U as Fi,Ua as Gi,V as ve,Y as Oi,Z as qi,_ as Rt,a as De,aa as z,b as Le,d as ot,da as fi,e as zt,f as Di,g as st,ga as Xi,h as Li,ha as Ui,i as at,ia as Me,j as ui,l as ye,na as le,o as _e,oa as he,pa as Vi,q as Hi,qa as vt,r as Re,ra as bt,s as ne,sa as Pt,t as Ge,ta as Ue,ua as Ve,va as At,ya as Ni}from"./chunks/chunk-TJXWAWUJ.js";var Zi={type:"change"},gi={type:"start"},Ki={type:"end"},Ct=new Rt,$i=new Oi,Ao=Math.cos(70*pe.DEG2RAD),te=new _,fe=2*Math.PI,W={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},xi=1e-6,Dt=class extends It{constructor(e,t=null){super(e,t),this.state=W.NONE,this.target=new _,this.cursor=new _,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:De.ROTATE,MIDDLE:De.DOLLY,RIGHT:De.PAN},this.touches={ONE:Le.ROTATE,TWO:Le.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new _,this._lastQuaternion=new se,this._lastTargetPosition=new _,this._quat=new se().setFromUnitVectors(e.up,new _(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new mi,this._sphericalDelta=new mi,this._scale=1,this._panOffset=new _,this._rotateStart=new G,this._rotateEnd=new G,this._rotateDelta=new G,this._panStart=new G,this._panEnd=new G,this._panDelta=new G,this._dollyStart=new G,this._dollyEnd=new G,this._dollyDelta=new G,this._dollyDirection=new _,this._mouse=new G,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Io.bind(this),this._onPointerDown=ko.bind(this),this._onPointerUp=Co.bind(this),this._onContextMenu=qo.bind(this),this._onMouseWheel=Ho.bind(this),this._onKeyDown=jo.bind(this),this._onTouchStart=Fo.bind(this),this._onTouchMove=Oo.bind(this),this._onMouseDown=Do.bind(this),this._onMouseMove=Lo.bind(this),this._interceptControlDown=Xo.bind(this),this._interceptControlUp=Uo.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=W.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents();let e=this.domElement.getRootNode();e.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),e.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(Zi),this.update(),this.state=W.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;te.copy(t).sub(this.target),te.applyQuaternion(this._quat),this._spherical.setFromVector3(te),this.autoRotate&&this.state===W.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,o=this.maxAzimuthAngle;isFinite(i)&&isFinite(o)&&(i<-Math.PI?i+=fe:i>Math.PI&&(i-=fe),o<-Math.PI?o+=fe:o>Math.PI&&(o-=fe),i<=o?this._spherical.theta=Math.max(i,Math.min(o,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+o)/2?Math.max(i,this._spherical.theta):Math.min(o,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let s=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let r=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),s=r!=this._spherical.radius}if(te.setFromSpherical(this._spherical),te.applyQuaternion(this._quatInverse),t.copy(this.target).add(te),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let r=null;if(this.object.isPerspectiveCamera){let a=te.length();r=this._clampDistance(a*this._scale);let c=a-r;this.object.position.addScaledVector(this._dollyDirection,c),this.object.updateMatrixWorld(),s=!!c}else if(this.object.isOrthographicCamera){let a=new _(this._mouse.x,this._mouse.y,0);a.unproject(this.object);let c=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),s=c!==this.object.zoom;let l=new _(this._mouse.x,this._mouse.y,0);l.unproject(this.object),this.object.position.sub(l).add(a),this.object.updateMatrixWorld(),r=te.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;r!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(r).add(this.object.position):(Ct.origin.copy(this.object.position),Ct.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Ct.direction))<Ao?this.object.lookAt(this.target):($i.setFromNormalAndCoplanarPoint(this.object.up,this.target),Ct.intersectPlane($i,this.target))))}else if(this.object.isOrthographicCamera){let r=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),r!==this.object.zoom&&(this.object.updateProjectionMatrix(),s=!0)}return this._scale=1,this._performCursorZoom=!1,s||this._lastPosition.distanceToSquared(this.object.position)>xi||8*(1-this._lastQuaternion.dot(this.object.quaternion))>xi||this._lastTargetPosition.distanceToSquared(this.target)>xi?(this.dispatchEvent(Zi),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?fe/60*this.autoRotateSpeed*e:fe/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){te.setFromMatrixColumn(t,0),te.multiplyScalar(-e),this._panOffset.add(te)}_panUp(e,t){this.screenSpacePanning===!0?te.setFromMatrixColumn(t,1):(te.setFromMatrixColumn(t,0),te.crossVectors(this.object.up,te)),te.multiplyScalar(e),this._panOffset.add(te)}_pan(e,t){let i=this.domElement;if(this.object.isPerspectiveCamera){let o=this.object.position;te.copy(o).sub(this.target);let s=te.length();s*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*s/i.clientHeight,this.object.matrix),this._panUp(2*t*s/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let i=this.domElement.getBoundingClientRect(),o=e-i.left,s=t-i.top,r=i.width,a=i.height;this._mouse.x=o/r*2-1,this._mouse.y=-(s/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(fe*this._rotateDelta.x/t.clientHeight),this._rotateUp(fe*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(fe*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-fe*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(fe*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-fe*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),o=.5*(e.pageY+t.y);this._rotateStart.set(i,o)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),o=.5*(e.pageY+t.y);this._panStart.set(i,o)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,o=e.pageY-t.y,s=Math.sqrt(i*i+o*o);this._dollyStart.set(0,s)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let i=this._getSecondPointerPosition(e),o=.5*(e.pageX+i.x),s=.5*(e.pageY+i.y);this._rotateEnd.set(o,s)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(fe*this._rotateDelta.x/t.clientHeight),this._rotateUp(fe*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),o=.5*(e.pageY+t.y);this._panEnd.set(i,o)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,o=e.pageY-t.y,s=Math.sqrt(i*i+o*o);this._dollyEnd.set(0,s),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let r=(e.pageX+t.x)*.5,a=(e.pageY+t.y)*.5;this._updateZoomParameters(r,a)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new G,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}};function ko(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function Io(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}function Co(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Ki),this.state=W.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function Do(n){let e;switch(n.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case De.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=W.DOLLY;break;case De.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=W.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=W.ROTATE}break;case De.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=W.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=W.PAN}break;default:this.state=W.NONE}this.state!==W.NONE&&this.dispatchEvent(gi)}function Lo(n){switch(this.state){case W.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case W.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case W.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}function Ho(n){this.enabled===!1||this.enableZoom===!1||this.state!==W.NONE||(n.preventDefault(),this.dispatchEvent(gi),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(Ki))}function jo(n){this.enabled!==!1&&this._handleKeyDown(n)}function Fo(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case Le.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(n),this.state=W.TOUCH_ROTATE;break;case Le.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(n),this.state=W.TOUCH_PAN;break;default:this.state=W.NONE}break;case 2:switch(this.touches.TWO){case Le.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=W.TOUCH_DOLLY_PAN;break;case Le.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=W.TOUCH_DOLLY_ROTATE;break;default:this.state=W.NONE}break;default:this.state=W.NONE}this.state!==W.NONE&&this.dispatchEvent(gi)}function Oo(n){switch(this._trackPointer(n),this.state){case W.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case W.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case W.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case W.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=W.NONE}}function qo(n){this.enabled!==!1&&n.preventDefault()}function Xo(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function Uo(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var $e=new dt,K=new _,Ne=new _,Q=new se,Ji={X:new _(1,0,0),Y:new _(0,1,0),Z:new _(0,0,1)},yi={type:"change"},eo={type:"mouseDown",mode:null},to={type:"mouseUp",mode:null},io={type:"objectChange"},Ot=class extends It{constructor(e,t=null){super(void 0,t);let i=new bi(this);this._root=i;let o=new wi;this._gizmo=o,i.add(o);let s=new Ei;this._plane=s,i.add(s);let r=this;function a(f,m){let g=m;Object.defineProperty(r,f,{get:function(){return g!==void 0?g:m},set:function(x){g!==x&&(g=x,s[f]=x,o[f]=x,r.dispatchEvent({type:f+"-changed",value:x}),r.dispatchEvent(yi))}}),r[f]=m,s[f]=m,o[f]=m}a("camera",e),a("object",void 0),a("enabled",!0),a("axis",null),a("mode","translate"),a("translationSnap",null),a("rotationSnap",null),a("scaleSnap",null),a("space","world"),a("size",1),this.viewport=null,a("dragging",!1),a("showX",!0),a("showY",!0),a("showZ",!0),a("showXY",!0),a("showYZ",!0),a("showXZ",!0),a("showXYZE",!0),a("showE",!0),a("minX",-1/0),a("maxX",1/0),a("minY",-1/0),a("maxY",1/0),a("minZ",-1/0),a("maxZ",1/0);let c=new _,l=new _,p=new se,u=new se,v=new _,S=new se,E=new _,b=new _,A=new _,L=0,d=new _;a("worldPosition",c),a("worldPositionStart",l),a("worldQuaternion",p),a("worldQuaternionStart",u),a("cameraPosition",v),a("cameraQuaternion",S),a("pointStart",E),a("pointEnd",b),a("rotationAxis",A),a("rotationAngle",L),a("eye",d),this._offset=new _,this._startNorm=new _,this._endNorm=new _,this._cameraScale=new _,this._parentPosition=new _,this._parentQuaternion=new se,this._parentQuaternionInv=new se,this._parentScale=new _,this._worldScaleStart=new _,this._worldQuaternionInv=new se,this._worldScale=new _,this._positionStart=new _,this._quaternionStart=new se,this._scaleStart=new _,this._getPointer=Vo.bind(this),this._onPointerDown=Wo.bind(this),this._onPointerHover=No.bind(this),this._onPointerMove=Yo.bind(this),this._onPointerUp=Bo.bind(this),t!==null&&this.connect(t)}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointermove",this._onPointerHover),this.domElement.addEventListener("pointerup",this._onPointerUp),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerHover),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.style.touchAction=""}getHelper(){return this._root}pointerHover(e){if(this.object===void 0||this.dragging===!0)return;e!==null&&$e.setFromCamera(e,this.camera);let t=vi(this._gizmo.picker[this.mode],$e);t?this.axis=t.object.name:this.axis=null}pointerDown(e){if(!(this.object===void 0||this.dragging===!0||e!=null&&e.button!==0)&&this.axis!==null){e!==null&&$e.setFromCamera(e,this.camera);let t=vi(this._plane,$e,!0);t&&(this.object.updateMatrixWorld(),this.object.parent.updateMatrixWorld(),this._positionStart.copy(this.object.position),this._quaternionStart.copy(this.object.quaternion),this._scaleStart.copy(this.object.scale),this.object.matrixWorld.decompose(this.worldPositionStart,this.worldQuaternionStart,this._worldScaleStart),this.pointStart.copy(t.point).sub(this.worldPositionStart)),this.dragging=!0,eo.mode=this.mode,this.dispatchEvent(eo)}}pointerMove(e){let t=this.axis,i=this.mode,o=this.object,s=this.space;if(i==="scale"?s="local":(t==="E"||t==="XYZE"||t==="XYZ")&&(s="world"),o===void 0||t===null||this.dragging===!1||e!==null&&e.button!==-1)return;e!==null&&$e.setFromCamera(e,this.camera);let r=vi(this._plane,$e,!0);if(r){if(this.pointEnd.copy(r.point).sub(this.worldPositionStart),i==="translate")this._offset.copy(this.pointEnd).sub(this.pointStart),s==="local"&&t!=="XYZ"&&this._offset.applyQuaternion(this._worldQuaternionInv),t.indexOf("X")===-1&&(this._offset.x=0),t.indexOf("Y")===-1&&(this._offset.y=0),t.indexOf("Z")===-1&&(this._offset.z=0),s==="local"&&t!=="XYZ"?this._offset.applyQuaternion(this._quaternionStart).divide(this._parentScale):this._offset.applyQuaternion(this._parentQuaternionInv).divide(this._parentScale),o.position.copy(this._offset).add(this._positionStart),this.translationSnap&&(s==="local"&&(o.position.applyQuaternion(Q.copy(this._quaternionStart).invert()),t.search("X")!==-1&&(o.position.x=Math.round(o.position.x/this.translationSnap)*this.translationSnap),t.search("Y")!==-1&&(o.position.y=Math.round(o.position.y/this.translationSnap)*this.translationSnap),t.search("Z")!==-1&&(o.position.z=Math.round(o.position.z/this.translationSnap)*this.translationSnap),o.position.applyQuaternion(this._quaternionStart)),s==="world"&&(o.getWorldPosition(K),t.search("X")!==-1&&(K.x=Math.round(K.x/this.translationSnap)*this.translationSnap),t.search("Y")!==-1&&(K.y=Math.round(K.y/this.translationSnap)*this.translationSnap),t.search("Z")!==-1&&(K.z=Math.round(K.z/this.translationSnap)*this.translationSnap),o.position.copy(o.parent.worldToLocal(K)))),o.position.x=Math.max(this.minX,Math.min(this.maxX,o.position.x)),o.position.y=Math.max(this.minY,Math.min(this.maxY,o.position.y)),o.position.z=Math.max(this.minZ,Math.min(this.maxZ,o.position.z));else if(i==="scale"){if(t.search("XYZ")!==-1){let a=this.pointEnd.length()/this.pointStart.length();this.pointEnd.dot(this.pointStart)<0&&(a*=-1),Ne.set(a,a,a)}else K.copy(this.pointStart),Ne.copy(this.pointEnd),K.applyQuaternion(this._worldQuaternionInv),Ne.applyQuaternion(this._worldQuaternionInv),Ne.divide(K),t.search("X")===-1&&(Ne.x=1),t.search("Y")===-1&&(Ne.y=1),t.search("Z")===-1&&(Ne.z=1);o.scale.copy(this._scaleStart).multiply(Ne),this.scaleSnap&&(t.search("X")!==-1&&(o.scale.x=Math.round(o.scale.x/this.scaleSnap)*this.scaleSnap||this.scaleSnap),t.search("Y")!==-1&&(o.scale.y=Math.round(o.scale.y/this.scaleSnap)*this.scaleSnap||this.scaleSnap),t.search("Z")!==-1&&(o.scale.z=Math.round(o.scale.z/this.scaleSnap)*this.scaleSnap||this.scaleSnap))}else if(i==="rotate"){this._offset.copy(this.pointEnd).sub(this.pointStart);let a=20/this.worldPosition.distanceTo(K.setFromMatrixPosition(this.camera.matrixWorld)),c=!1;t==="XYZE"?(this.rotationAxis.copy(this._offset).cross(this.eye).normalize(),this.rotationAngle=this._offset.dot(K.copy(this.rotationAxis).cross(this.eye))*a):(t==="X"||t==="Y"||t==="Z")&&(this.rotationAxis.copy(Ji[t]),K.copy(Ji[t]),s==="local"&&K.applyQuaternion(this.worldQuaternion),K.cross(this.eye),K.length()===0?c=!0:this.rotationAngle=this._offset.dot(K.normalize())*a),(t==="E"||c)&&(this.rotationAxis.copy(this.eye),this.rotationAngle=this.pointEnd.angleTo(this.pointStart),this._startNorm.copy(this.pointStart).normalize(),this._endNorm.copy(this.pointEnd).normalize(),this.rotationAngle*=this._endNorm.cross(this._startNorm).dot(this.eye)<0?1:-1),this.rotationSnap&&(this.rotationAngle=Math.round(this.rotationAngle/this.rotationSnap)*this.rotationSnap),s==="local"&&t!=="E"&&t!=="XYZE"?(o.quaternion.copy(this._quaternionStart),o.quaternion.multiply(Q.setFromAxisAngle(this.rotationAxis,this.rotationAngle)).normalize()):(this.rotationAxis.applyQuaternion(this._parentQuaternionInv),o.quaternion.copy(Q.setFromAxisAngle(this.rotationAxis,this.rotationAngle)),o.quaternion.multiply(this._quaternionStart).normalize())}this.dispatchEvent(yi),this.dispatchEvent(io)}}pointerUp(e){e!==null&&e.button!==0||(this.dragging&&this.axis!==null&&(to.mode=this.mode,this.dispatchEvent(to)),this.dragging=!1,this.axis=null)}dispose(){this.disconnect(),this._root.dispose()}attach(e){return this.object=e,this._root.visible=!0,this}detach(){return this.object=void 0,this.axis=null,this._root.visible=!1,this}reset(){this.enabled&&this.dragging&&(this.object.position.copy(this._positionStart),this.object.quaternion.copy(this._quaternionStart),this.object.scale.copy(this._scaleStart),this.dispatchEvent(yi),this.dispatchEvent(io),this.pointStart.copy(this.pointEnd))}getRaycaster(){return $e}getMode(){return this.mode}setMode(e){this.mode=e}setTranslationSnap(e){this.translationSnap=e}setRotationSnap(e){this.rotationSnap=e}setScaleSnap(e){this.scaleSnap=e}setSize(e){this.size=e}setSpace(e){this.space=e}setColors(e,t,i,o){let s=this._gizmo.materialLib;s.xAxis.color.set(e),s.yAxis.color.set(t),s.zAxis.color.set(i),s.active.color.set(o),s.xAxisTransparent.color.set(e),s.yAxisTransparent.color.set(t),s.zAxisTransparent.color.set(i),s.activeTransparent.color.set(o),s.xAxis._color&&s.xAxis._color.set(e),s.yAxis._color&&s.yAxis._color.set(t),s.zAxis._color&&s.zAxis._color.set(i),s.active._color&&s.active._color.set(o),s.xAxisTransparent._color&&s.xAxisTransparent._color.set(e),s.yAxisTransparent._color&&s.yAxisTransparent._color.set(t),s.zAxisTransparent._color&&s.zAxisTransparent._color.set(i),s.activeTransparent._color&&s.activeTransparent._color.set(o)}};function Vo(n){if(this.domElement.ownerDocument.pointerLockElement)return{x:0,y:0,button:n.button};{let e=this.domElement.getBoundingClientRect(),t=this.viewport,i,o,s,r;return t!==null?(i=t.x,o=e.height-t.y-t.w,s=t.z,r=t.w):(i=0,o=0,s=e.width,r=e.height),{x:(n.clientX-e.left-i)/s*2-1,y:-(n.clientY-e.top-o)/r*2+1,button:n.button}}}function No(n){if(this.enabled)switch(n.pointerType){case"mouse":case"pen":this.pointerHover(this._getPointer(n));break}}function Wo(n){this.enabled&&(document.pointerLockElement||this.domElement.setPointerCapture(n.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.pointerHover(this._getPointer(n)),this.pointerDown(this._getPointer(n)))}function Yo(n){this.enabled&&this.pointerMove(this._getPointer(n))}function Bo(n){this.enabled&&(this.domElement.releasePointerCapture(n.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.pointerUp(this._getPointer(n)))}function vi(n,e,t){let i=e.intersectObject(n,!0);for(let o=0;o<i.length;o++)if(i[o].object.visible||t)return i[o];return!1}var Lt=new rt,Y=new _(0,1,0),oo=new _(0,0,0),so=new Pe,Ht=new se,Ft=new se,Ae=new _,qt=new Pe,St=new _(1,0,0),Ke=new _(0,1,0),_t=new _(0,0,1),jt=new _,wt=new _,Et=new _,bi=class extends Qe{constructor(e){super(),this.isTransformControlsRoot=!0,this.controls=e,this.visible=!1}updateMatrixWorld(e){let t=this.controls;t.object!==void 0&&(t.object.updateMatrixWorld(),t.object.parent===null?console.error("TransformControls: The attached 3D object must be a part of the scene graph."):t.object.parent.matrixWorld.decompose(t._parentPosition,t._parentQuaternion,t._parentScale),t.object.matrixWorld.decompose(t.worldPosition,t.worldQuaternion,t._worldScale),t._parentQuaternionInv.copy(t._parentQuaternion).invert(),t._worldQuaternionInv.copy(t.worldQuaternion).invert()),t.camera.updateMatrixWorld(),t.camera.matrixWorld.decompose(t.cameraPosition,t.cameraQuaternion,t._cameraScale),t.camera.isOrthographicCamera?t.camera.getWorldDirection(t.eye).negate():t.eye.copy(t.cameraPosition).sub(t.worldPosition).normalize(),this.parent&&(qt.copy(this.parent.matrixWorld).invert(),qt.decompose(this.position,this.quaternion,this.scale)),super.updateMatrixWorld(e)}dispose(){this.traverse(function(e){e.geometry&&e.geometry.dispose(),e.material&&e.material.dispose()})}},wi=class extends Qe{constructor(){super(),this.isTransformControlsGizmo=!0,this.type="TransformControlsGizmo";let e=new lt({depthTest:!1,depthWrite:!1,fog:!1,toneMapped:!1,transparent:!0}),t=new Ui({depthTest:!1,depthWrite:!1,fog:!1,toneMapped:!1,transparent:!0}),i=e.clone();i.opacity=.15;let o=t.clone();o.opacity=.5;let s=e.clone();s.color.setHex(16711680);let r=e.clone();r.color.setHex(65280);let a=e.clone();a.color.setHex(255);let c=e.clone();c.color.setHex(16711680),c.opacity=.5;let l=e.clone();l.color.setHex(65280),l.opacity=.5;let p=e.clone();p.color.setHex(255),p.opacity=.5;let u=e.clone();u.opacity=.25;let v=e.clone();v.color.setHex(16776960),v.opacity=.25;let S=e.clone();S.color.setHex(16776960);let E=e.clone();E.color.setHex(7895160),this.materialLib={xAxis:s,yAxis:r,zAxis:a,active:S,xAxisTransparent:c,yAxisTransparent:l,zAxisTransparent:p,activeTransparent:v};let b=new he(0,.04,.1,12);b.translate(0,.05,0);let A=new le(.08,.08,.08);A.translate(0,.04,0);let L=new ve;L.setAttribute("position",new Ze([0,0,0,1,0,0],3));let d=new he(.0075,.0075,.5,3);d.translate(0,.25,0);function f(q,N){let X=new Ue(q,.0075,3,64,N*Math.PI*2);return X.rotateY(Math.PI/2),X.rotateX(Math.PI/2),X}function m(){let q=new ve;return q.setAttribute("position",new Ze([0,0,0,1,1,1],3)),q}let g={X:[[new z(b,s),[.5,0,0],[0,0,-Math.PI/2]],[new z(b,s),[-.5,0,0],[0,0,Math.PI/2]],[new z(d,s),[0,0,0],[0,0,-Math.PI/2]]],Y:[[new z(b,r),[0,.5,0]],[new z(b,r),[0,-.5,0],[Math.PI,0,0]],[new z(d,r)]],Z:[[new z(b,a),[0,0,.5],[Math.PI/2,0,0]],[new z(b,a),[0,0,-.5],[-Math.PI/2,0,0]],[new z(d,a),null,[Math.PI/2,0,0]]],XYZ:[[new z(new vt(.1,0),u),[0,0,0]]],XY:[[new z(new le(.15,.15,.01),p),[.15,.15,0]]],YZ:[[new z(new le(.15,.15,.01),c),[0,.15,.15],[0,Math.PI/2,0]]],XZ:[[new z(new le(.15,.15,.01),l),[.15,0,.15],[-Math.PI/2,0,0]]]},x={X:[[new z(new he(.2,0,.6,4),i),[.3,0,0],[0,0,-Math.PI/2]],[new z(new he(.2,0,.6,4),i),[-.3,0,0],[0,0,Math.PI/2]]],Y:[[new z(new he(.2,0,.6,4),i),[0,.3,0]],[new z(new he(.2,0,.6,4),i),[0,-.3,0],[0,0,Math.PI]]],Z:[[new z(new he(.2,0,.6,4),i),[0,0,.3],[Math.PI/2,0,0]],[new z(new he(.2,0,.6,4),i),[0,0,-.3],[-Math.PI/2,0,0]]],XYZ:[[new z(new vt(.2,0),i)]],XY:[[new z(new le(.2,.2,.01),i),[.15,.15,0]]],YZ:[[new z(new le(.2,.2,.01),i),[0,.15,.15],[0,Math.PI/2,0]]],XZ:[[new z(new le(.2,.2,.01),i),[.15,0,.15],[-Math.PI/2,0,0]]]},R={START:[[new z(new vt(.01,2),o),null,null,null,"helper"]],END:[[new z(new vt(.01,2),o),null,null,null,"helper"]],DELTA:[[new Me(m(),o),null,null,null,"helper"]],X:[[new Me(L,o),[-1e3,0,0],null,[1e6,1,1],"helper"]],Y:[[new Me(L,o),[0,-1e3,0],[0,0,Math.PI/2],[1e6,1,1],"helper"]],Z:[[new Me(L,o),[0,0,-1e3],[0,-Math.PI/2,0],[1e6,1,1],"helper"]]},w={XYZE:[[new z(f(.5,1),E),null,[0,Math.PI/2,0]]],X:[[new z(f(.5,.5),s)]],Y:[[new z(f(.5,.5),r),null,[0,0,-Math.PI/2]]],Z:[[new z(f(.5,.5),a),null,[0,Math.PI/2,0]]],E:[[new z(f(.75,1),v),null,[0,Math.PI/2,0]]]},P={AXIS:[[new Me(L,o),[-1e3,0,0],null,[1e6,1,1],"helper"]]},k={XYZE:[[new z(new Pt(.25,10,8),i)]],X:[[new z(new Ue(.5,.1,4,24),i),[0,0,0],[0,-Math.PI/2,-Math.PI/2]]],Y:[[new z(new Ue(.5,.1,4,24),i),[0,0,0],[Math.PI/2,0,0]]],Z:[[new z(new Ue(.5,.1,4,24),i),[0,0,0],[0,0,-Math.PI/2]]],E:[[new z(new Ue(.75,.1,2,24),i)]]},D={X:[[new z(A,s),[.5,0,0],[0,0,-Math.PI/2]],[new z(d,s),[0,0,0],[0,0,-Math.PI/2]],[new z(A,s),[-.5,0,0],[0,0,Math.PI/2]]],Y:[[new z(A,r),[0,.5,0]],[new z(d,r)],[new z(A,r),[0,-.5,0],[0,0,Math.PI]]],Z:[[new z(A,a),[0,0,.5],[Math.PI/2,0,0]],[new z(d,a),[0,0,0],[Math.PI/2,0,0]],[new z(A,a),[0,0,-.5],[-Math.PI/2,0,0]]],XY:[[new z(new le(.15,.15,.01),p),[.15,.15,0]]],YZ:[[new z(new le(.15,.15,.01),c),[0,.15,.15],[0,Math.PI/2,0]]],XZ:[[new z(new le(.15,.15,.01),l),[.15,0,.15],[-Math.PI/2,0,0]]],XYZ:[[new z(new le(.1,.1,.1),u)]]},M={X:[[new z(new he(.2,0,.6,4),i),[.3,0,0],[0,0,-Math.PI/2]],[new z(new he(.2,0,.6,4),i),[-.3,0,0],[0,0,Math.PI/2]]],Y:[[new z(new he(.2,0,.6,4),i),[0,.3,0]],[new z(new he(.2,0,.6,4),i),[0,-.3,0],[0,0,Math.PI]]],Z:[[new z(new he(.2,0,.6,4),i),[0,0,.3],[Math.PI/2,0,0]],[new z(new he(.2,0,.6,4),i),[0,0,-.3],[-Math.PI/2,0,0]]],XY:[[new z(new le(.2,.2,.01),i),[.15,.15,0]]],YZ:[[new z(new le(.2,.2,.01),i),[0,.15,.15],[0,Math.PI/2,0]]],XZ:[[new z(new le(.2,.2,.01),i),[.15,0,.15],[-Math.PI/2,0,0]]],XYZ:[[new z(new le(.2,.2,.2),i),[0,0,0]]]},I={X:[[new Me(L,o),[-1e3,0,0],null,[1e6,1,1],"helper"]],Y:[[new Me(L,o),[0,-1e3,0],[0,0,Math.PI/2],[1e6,1,1],"helper"]],Z:[[new Me(L,o),[0,0,-1e3],[0,-Math.PI/2,0],[1e6,1,1],"helper"]]};function H(q){let N=new Qe;for(let X in q)for(let B=q[X].length;B--;){let j=q[X][B][0].clone(),J=q[X][B][1],Z=q[X][B][2],ee=q[X][B][3],V=q[X][B][4];j.name=X,j.tag=V,J&&j.position.set(J[0],J[1],J[2]),Z&&j.rotation.set(Z[0],Z[1],Z[2]),ee&&j.scale.set(ee[0],ee[1],ee[2]),j.updateMatrix();let ce=j.geometry.clone();ce.applyMatrix4(j.matrix),j.geometry=ce,j.renderOrder=1/0,j.position.set(0,0,0),j.rotation.set(0,0,0),j.scale.set(1,1,1),N.add(j)}return N}this.gizmo={},this.picker={},this.helper={},this.add(this.gizmo.translate=H(g)),this.add(this.gizmo.rotate=H(w)),this.add(this.gizmo.scale=H(D)),this.add(this.picker.translate=H(x)),this.add(this.picker.rotate=H(k)),this.add(this.picker.scale=H(M)),this.add(this.helper.translate=H(R)),this.add(this.helper.rotate=H(P)),this.add(this.helper.scale=H(I)),this.picker.translate.visible=!1,this.picker.rotate.visible=!1,this.picker.scale.visible=!1}updateMatrixWorld(e){let i=(this.mode==="scale"?"local":this.space)==="local"?this.worldQuaternion:Ft;this.gizmo.translate.visible=this.mode==="translate",this.gizmo.rotate.visible=this.mode==="rotate",this.gizmo.scale.visible=this.mode==="scale",this.helper.translate.visible=this.mode==="translate",this.helper.rotate.visible=this.mode==="rotate",this.helper.scale.visible=this.mode==="scale";let o=[];o=o.concat(this.picker[this.mode].children),o=o.concat(this.gizmo[this.mode].children),o=o.concat(this.helper[this.mode].children);for(let s=0;s<o.length;s++){let r=o[s];r.visible=!0,r.rotation.set(0,0,0),r.position.copy(this.worldPosition);let a;if(this.camera.isOrthographicCamera?a=(this.camera.top-this.camera.bottom)/this.camera.zoom:a=this.worldPosition.distanceTo(this.cameraPosition)*Math.min(1.9*Math.tan(Math.PI*this.camera.fov/360)/this.camera.zoom,7),r.scale.set(1,1,1).multiplyScalar(a*this.size/4),r.tag==="helper"){r.visible=!1,r.name==="AXIS"?(r.visible=!!this.axis,this.axis==="X"&&(Q.setFromEuler(Lt.set(0,0,0)),r.quaternion.copy(i).multiply(Q),Math.abs(Y.copy(St).applyQuaternion(i).dot(this.eye))>.9&&(r.visible=!1)),this.axis==="Y"&&(Q.setFromEuler(Lt.set(0,0,Math.PI/2)),r.quaternion.copy(i).multiply(Q),Math.abs(Y.copy(Ke).applyQuaternion(i).dot(this.eye))>.9&&(r.visible=!1)),this.axis==="Z"&&(Q.setFromEuler(Lt.set(0,Math.PI/2,0)),r.quaternion.copy(i).multiply(Q),Math.abs(Y.copy(_t).applyQuaternion(i).dot(this.eye))>.9&&(r.visible=!1)),this.axis==="XYZE"&&(Q.setFromEuler(Lt.set(0,Math.PI/2,0)),Y.copy(this.rotationAxis),r.quaternion.setFromRotationMatrix(so.lookAt(oo,Y,Ke)),r.quaternion.multiply(Q),r.visible=this.dragging),this.axis==="E"&&(r.visible=!1)):r.name==="START"?(r.position.copy(this.worldPositionStart),r.visible=this.dragging):r.name==="END"?(r.position.copy(this.worldPosition),r.visible=this.dragging):r.name==="DELTA"?(r.position.copy(this.worldPositionStart),r.quaternion.copy(this.worldQuaternionStart),K.set(1e-10,1e-10,1e-10).add(this.worldPositionStart).sub(this.worldPosition).multiplyScalar(-1),K.applyQuaternion(this.worldQuaternionStart.clone().invert()),r.scale.copy(K),r.visible=this.dragging):(r.quaternion.copy(i),this.dragging?r.position.copy(this.worldPositionStart):r.position.copy(this.worldPosition),this.axis&&(r.visible=this.axis.search(r.name)!==-1));continue}r.quaternion.copy(i),this.mode==="translate"||this.mode==="scale"?(r.name==="X"&&Math.abs(Y.copy(St).applyQuaternion(i).dot(this.eye))>.99&&(r.scale.set(1e-10,1e-10,1e-10),r.visible=!1),r.name==="Y"&&Math.abs(Y.copy(Ke).applyQuaternion(i).dot(this.eye))>.99&&(r.scale.set(1e-10,1e-10,1e-10),r.visible=!1),r.name==="Z"&&Math.abs(Y.copy(_t).applyQuaternion(i).dot(this.eye))>.99&&(r.scale.set(1e-10,1e-10,1e-10),r.visible=!1),r.name==="XY"&&Math.abs(Y.copy(_t).applyQuaternion(i).dot(this.eye))<.2&&(r.scale.set(1e-10,1e-10,1e-10),r.visible=!1),r.name==="YZ"&&Math.abs(Y.copy(St).applyQuaternion(i).dot(this.eye))<.2&&(r.scale.set(1e-10,1e-10,1e-10),r.visible=!1),r.name==="XZ"&&Math.abs(Y.copy(Ke).applyQuaternion(i).dot(this.eye))<.2&&(r.scale.set(1e-10,1e-10,1e-10),r.visible=!1)):this.mode==="rotate"&&(Ht.copy(i),Y.copy(this.eye).applyQuaternion(Q.copy(i).invert()),r.name.search("E")!==-1&&r.quaternion.setFromRotationMatrix(so.lookAt(this.eye,oo,Ke)),r.name==="X"&&(Q.setFromAxisAngle(St,Math.atan2(-Y.y,Y.z)),Q.multiplyQuaternions(Ht,Q),r.quaternion.copy(Q)),r.name==="Y"&&(Q.setFromAxisAngle(Ke,Math.atan2(Y.x,Y.z)),Q.multiplyQuaternions(Ht,Q),r.quaternion.copy(Q)),r.name==="Z"&&(Q.setFromAxisAngle(_t,Math.atan2(Y.y,Y.x)),Q.multiplyQuaternions(Ht,Q),r.quaternion.copy(Q))),r.visible=r.visible&&(r.name.indexOf("X")===-1||this.showX),r.visible=r.visible&&(r.name.indexOf("Y")===-1||this.showY),r.visible=r.visible&&(r.name.indexOf("Z")===-1||this.showZ),r.visible=r.visible&&(r.name.indexOf("E")===-1||this.showX&&this.showY&&this.showZ),r.visible=r.visible&&(r.name.indexOf("XY")===-1||this.showXY),r.visible=r.visible&&(r.name.indexOf("YZ")===-1||this.showYZ),r.visible=r.visible&&(r.name.indexOf("XZ")===-1||this.showXZ),r.visible=r.visible&&(r.name!=="E"||this.showE),r.visible=r.visible&&(r.name!=="XYZE"||this.showXYZE),r.material._color=r.material._color||r.material.color.clone(),r.material._opacity=r.material._opacity||r.material.opacity,r.material.color.copy(r.material._color),r.material.opacity=r.material._opacity,this.enabled&&this.axis&&(r.name===this.axis?(r.material.color.copy(this.materialLib.active.color),r.material.opacity=1):this.axis.split("").some(function(c){return r.name===c})&&(r.material.color.copy(this.materialLib.active.color),r.material.opacity=1))}super.updateMatrixWorld(e)}},Ei=class extends z{constructor(){super(new bt(1e5,1e5,2,2),new lt({visible:!1,wireframe:!0,side:ot,transparent:!0,opacity:.1,toneMapped:!1})),this.isTransformControlsPlane=!0,this.type="TransformControlsPlane"}updateMatrixWorld(e){let t=this.space;switch(this.position.copy(this.worldPosition),this.mode==="scale"&&(t="local"),jt.copy(St).applyQuaternion(t==="local"?this.worldQuaternion:Ft),wt.copy(Ke).applyQuaternion(t==="local"?this.worldQuaternion:Ft),Et.copy(_t).applyQuaternion(t==="local"?this.worldQuaternion:Ft),Y.copy(wt),this.mode){case"translate":case"scale":switch(this.axis){case"X":Y.copy(this.eye).cross(jt),Ae.copy(jt).cross(Y);break;case"Y":Y.copy(this.eye).cross(wt),Ae.copy(wt).cross(Y);break;case"Z":Y.copy(this.eye).cross(Et),Ae.copy(Et).cross(Y);break;case"XY":Ae.copy(Et);break;case"YZ":Ae.copy(jt);break;case"XZ":Y.copy(Et),Ae.copy(wt);break;case"XYZ":case"E":Ae.set(0,0,0);break}break;default:Ae.set(0,0,0)}Ae.length()===0?this.quaternion.copy(this.cameraQuaternion):(qt.lookAt(K.set(0,0,0),Ae,Y),this.quaternion.setFromRotationMatrix(qt)),super.updateMatrixWorld(e)}};var ao=new ve;ao.setAttribute("position",new Ze([-1,-1,0,3,-1,0,-1,3,0],3));var Go=new kt(-1,1,1,-1,0,1),Qo=`
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;function be(n,e={},t={}){return new Ve({glslVersion:qe,vertexShader:Qo,fragmentShader:n,uniforms:e,depthTest:!1,depthWrite:!1,...t})}var Te=class{constructor(e){this.mesh=new z(ao,e),this.mesh.frustumCulled=!1}get material(){return this.mesh.material}set material(e){this.mesh.material=e}render(e,t){e.setRenderTarget(t),e.render(this.mesh,Go)}};var He=256,Zo=8,Mt=[600,85,12,2.1],Xt=9.81,$o=74e-6,Si=300,Vt=`
precision highp float;
precision highp int;
#define N ${He}
#define PI 3.14159265359
#define G ${Xt.toFixed(2)}
#define ST ${$o.toExponential()}
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
float omega(float k) { return sqrt(G * k + ST * k * k * k); }
`,Ko=Vt+`
uniform vec4 uSpecA[2]; // scale, angle, spreadBlend, swell
uniform vec4 uSpecB[2]; // alpha, peakOmega, gamma, shortWavesFade
uniform vec4 uLength;
uniform vec4 uCut;      // c0 hi, c1 hi, c2 hi, -
uniform float uCapFade; // short-wave fade for cascade 3 (cascades 0-2 use uSpecB.w)
uniform uint uSeed;
out vec4 outColor;

uvec2 pcg2d(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v;
}

vec2 gauss(ivec2 id, int c) {
  uvec2 h = pcg2d(uvec2(id) + uvec2(uint(c) * 7919u, uint(c) * 104729u) + uSeed);
  float u1 = (float(h.x) + 1.0) / 4294967296.0;
  float u2 = float(h.y) / 4294967296.0;
  float r = sqrt(-2.0 * log(u1));
  return r * vec2(cos(2.0 * PI * u2), sin(2.0 * PI * u2));
}

float jonswap(float w, vec4 a, vec4 b) {
  float wp = b.y;
  float sigma = w <= wp ? 0.07 : 0.09;
  float r = exp(-(w - wp) * (w - wp) / (2.0 * sigma * sigma * wp * wp));
  float iw = 1.0 / w;
  float q = wp * iw;
  return a.x * b.x * G * G * iw * iw * iw * iw * iw * exp(-1.25 * q * q * q * q) * pow(b.z, r);
}

float normalisation(float s) {
  float s2 = s * s, s3 = s2 * s, s4 = s3 * s;
  if (s < 5.0) return -0.000564 * s4 + 0.00776 * s3 - 0.044 * s2 + 0.192 * s + 0.163;
  return -4.80e-08 * s4 + 1.07e-05 * s3 - 9.53e-04 * s2 + 5.90e-02 * s + 3.93e-01;
}

float directional(float theta, float w, vec4 a, vec4 b) {
  float x = w / b.y;
  float s = x > 1.0 ? 9.77 * pow(x, -2.5) : 6.97 * pow(x, 5.0);
  s += 16.0 * tanh(min(x, 20.0)) * a.w * a.w;
  float t = theta - a.y;
  float cosine2s = normalisation(s) * pow(abs(cos(0.5 * t)), 2.0 * s);
  return mix(2.0 / PI * cos(t) * cos(t), cosine2s, a.z);
}

vec2 h0(ivec2 id, int c) {
  float L = uLength[c];
  float dk = 2.0 * PI / L;
  vec2 k = vec2(id - N / 2) * dk;
  float kl = length(k);
  float lo = c == 0 ? 1e-4 : uCut[c - 1];
  float hi = c == 3 ? 1e4 : uCut[c];
  if (kl < lo || kl > hi) return vec2(0.0);
  float w = omega(kl);
  float dwdk = (G + 3.0 * ST * kl * kl) / (2.0 * w);
  float theta = atan(k.y, k.x);
  float S = 0.0;
  for (int i = 0; i < 2; i++) {
    if (uSpecA[i].x <= 0.0) continue;
    float fade = c == 3 ? uCapFade : uSpecB[i].w;
    S += jonswap(w, uSpecA[i], uSpecB[i]) * directional(theta, w, uSpecA[i], uSpecB[i])
       * exp(-fade * fade * kl * kl);
  }
  return gauss(id, c) * sqrt(2.0 * S * dwdk / kl * dk * dk);
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int c = p.y / N;
  ivec2 id = ivec2(p.x, p.y - c * N);
  vec2 a = h0(id, c);
  vec2 b = h0((N - id) % N, c);
  outColor = vec4(a, b.x, -b.y); // h0(k), conj(h0(-k))
}`,Jo=Vt+`
uniform highp sampler2D uH0;
uniform vec4 uLength;
uniform float uTime;
layout(location = 0) out vec4 out0;
layout(location = 1) out vec4 out1;

// two real fields packed as one complex spectrum: IFFT(A + iB) = a + ib
vec2 pack2(vec2 a, vec2 b) { return vec2(a.x - b.y, a.y + b.x); }

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int c = p.y / N;
  vec2 k = vec2(ivec2(p.x, p.y - c * N) - N / 2) * (2.0 * PI / uLength[c]);
  float kl = length(k);
  float ik = kl > 1e-6 ? 1.0 / kl : 0.0;
  const float W0 = 2.0 * PI / ${Si.toFixed(1)};
  // \u03C9 = n\xB7W0; phase reduced to [0, 2\u03C0) before sin/cos (the capillary cascade reaches \u03C9 \u2248 130)
  float ph = 2.0 * PI * fract(floor(omega(kl) / W0) * (uTime / ${Si.toFixed(1)}));
  vec2 e = vec2(cos(ph), sin(ph));
  vec4 h0 = texelFetch(uH0, p, 0);
  vec2 h = cmul(h0.xy, e) + cmul(h0.zw, vec2(e.x, -e.y));
  vec2 ih = vec2(-h.y, h.x);

  vec2 dx = ih * k.x * ik, dz = ih * k.y * ik;
  vec2 dxdx = -h * k.x * k.x * ik, dzdz = -h * k.y * k.y * ik, dxdz = -h * k.x * k.y * ik;
  vec2 dydx = ih * k.x, dydz = ih * k.y;

  out0 = vec4(pack2(dx, dz), pack2(h, dxdz));
  out1 = vec4(pack2(dydx, dydz), pack2(dxdx, dzdz));
}`,es=Vt+`
uniform highp sampler2D uIn0;
uniform highp sampler2D uIn1;
uniform int uSub;      // sub-transform size 2..N
uniform int uVertical;
layout(location = 0) out vec4 out0;
layout(location = 1) out vec4 out1;

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int i = uVertical == 1 ? p.y % N : p.x;
  int hs = uSub >> 1;
  int e = (i / uSub) * hs + (i & (hs - 1));
  ivec2 pe, po;
  if (uVertical == 1) { int base = p.y - i; pe = ivec2(p.x, base + e); po = ivec2(p.x, base + e + N / 2); }
  else { pe = ivec2(e, p.y); po = ivec2(e + N / 2, p.y); }
  float a = 2.0 * PI * float(i & (uSub - 1)) / float(uSub);
  vec2 tw = vec2(cos(a), sin(a));
  vec4 e0 = texelFetch(uIn0, pe, 0), o0 = texelFetch(uIn0, po, 0);
  vec4 e1 = texelFetch(uIn1, pe, 0), o1 = texelFetch(uIn1, po, 0);
  out0 = vec4(e0.xy + cmul(tw, o0.xy), e0.zw + cmul(tw, o0.zw));
  out1 = vec4(e1.xy + cmul(tw, o1.xy), e1.zw + cmul(tw, o1.zw));
}`,ts=Vt+`
uniform highp sampler2D uIn0;
uniform highp sampler2D uIn1;
uniform sampler2D uPrev;
uniform int uCascade;
uniform float uLambda;
uniform float uDt;
uniform float uFoamRecovery;
layout(location = 0) out vec4 outDisp;
layout(location = 1) out vec4 outSlope;

void main() {
  ivec2 id = ivec2(gl_FragCoord.xy);
  ivec2 p = id + ivec2(0, uCascade * N);
  // undo the centred-k frequency shift
  float s = ((id.x + id.y) & 1) == 0 ? 1.0 : -1.0;
  vec4 a = texelFetch(uIn0, p, 0) * s; // Dx, Dz, Dy, Dxz
  vec4 b = texelFetch(uIn1, p, 0) * s; // Dyx, Dyz, Dxx, Dzz
  float dxx = uLambda * b.z, dzz = uLambda * b.w, dxz = uLambda * a.w;
  float jac = (1.0 + dxx) * (1.0 + dzz) - dxz * dxz;
  vec2 slope = b.xy / max(vec2(1.0 + dxx, 1.0 + dzz), vec2(0.2));
  float prev = texelFetch(uPrev, id, 0).w;
  // foam follows the jacobian down instantly and recovers at a dt-based rate
  float turb = min(jac, prev + uDt * uFoamRecovery / max(jac, 0.5));
  outDisp = vec4(uLambda * a.x, a.z, uLambda * a.y, turb);
  outSlope = vec4(slope, slope * slope);
}`;function ro(n,e){let t=e*1e3;return{alpha:.076*Math.pow(Xt*t/(n*n),-.22),peakOmega:22*Math.pow(n*t/(Xt*Xt),-.33)}}var _i=()=>({windSpeed:9,windDirection:20,fetchKm:120,spreadBlend:.85,windSwell:.25,gamma:3.3,shortWavesFade:.04,capillaryFade:.08,waveScale:1,swellScale:.7,swellWindSpeed:7,swellDirection:-15,swellFetchKm:900,swellSwell:1,choppiness:.85,foamRecovery:.7,timeScale:1}),Ut=class{constructor(e,t=_i()){this.renderer=e,this.params=t,this.time=0,this.dirty=!0,this.parity=0;let i={type:Re,minFilter:ye,magFilter:ye,depthBuffer:!1,generateMipmaps:!1},o=He*Mt.length;this.h0RT=new $(He,o,i);let s={...i,type:ne,count:2};this.ping=new $(He,o,s),this.pong=new $(He,o,s);let r={type:ne,minFilter:Hi,magFilter:_e,wrapS:at,wrapT:at,generateMipmaps:!0,anisotropy:e.capabilities.getMaxAnisotropy(),depthBuffer:!1,count:2};this.out=Mt.map(()=>[new $(He,He,r),new $(He,He,r)]);let a=e.getClearColor(new ue),c=e.getClearAlpha();e.setClearColor(0,1);for(let p of this.out)for(let u of p)e.setRenderTarget(u),e.clear(!0,!1,!1);e.setClearColor(a,c),e.setRenderTarget(null);let l=new de(...Mt);this.initMat=be(Ko,{uSpecA:{value:[new de,new de]},uSpecB:{value:[new de,new de]},uLength:{value:l},uCut:{value:new de(...Mt.slice(1).map(p=>2*Math.PI/p*6),0)},uCapFade:{value:0},uSeed:{value:1337}}),this.evolveMat=be(Jo,{uH0:{value:this.h0RT.texture},uLength:{value:l},uTime:{value:0}}),this.fftMat=be(es,{uIn0:{value:null},uIn1:{value:null},uSub:{value:2},uVertical:{value:0}}),this.assembleMat=be(ts,{uIn0:{value:null},uIn1:{value:null},uPrev:{value:null},uCascade:{value:0},uLambda:{value:1},uDt:{value:0},uFoamRecovery:{value:.45}}),this.quad=new Te(this.initMat),this.lengths=Mt,this.displacement=this.out.map(p=>p[0].textures[0]),this.slope=this.out.map(p=>p[0].textures[1])}updateSpectrum(){let e=this.params,t=this.initMat.uniforms,i=ro(e.windSpeed,e.fetchKm),o=ro(e.swellWindSpeed,e.swellFetchKm),s=pe.degToRad;t.uSpecA.value[0].set(e.waveScale,s(e.windDirection),e.spreadBlend,e.windSwell),t.uSpecB.value[0].set(i.alpha,i.peakOmega,e.gamma,e.shortWavesFade),t.uSpecA.value[1].set(e.swellScale*e.waveScale,s(e.swellDirection),1,e.swellSwell),t.uSpecB.value[1].set(o.alpha,o.peakOmega,e.gamma,e.shortWavesFade),t.uCapFade.value=e.capillaryFade,this.quad.material=this.initMat,this.quad.render(this.renderer,this.h0RT),this.dirty=!1}update(e,t){let i=this.params;t?.begin("sim.evolve"),this.dirty&&this.updateSpectrum(),e*=i.timeScale,this.time=(this.time+e)%Si;let o=this.renderer,s=this.quad;this.evolveMat.uniforms.uTime.value=this.time,s.material=this.evolveMat,s.render(o,this.ping),t?.begin("sim.fft");let r=this.ping,a=this.pong,c=this.fftMat.uniforms;s.material=this.fftMat;for(let u=0;u<2;u++){c.uVertical.value=u;for(let v=1;v<=Zo;v++)c.uSub.value=1<<v,c.uIn0.value=r.textures[0],c.uIn1.value=r.textures[1],s.render(o,a),[r,a]=[a,r]}t?.begin("sim.assemble");let l=this.assembleMat.uniforms;l.uIn0.value=r.textures[0],l.uIn1.value=r.textures[1],l.uLambda.value=i.choppiness,l.uDt.value=e,l.uFoamRecovery.value=i.foamRecovery,s.material=this.assembleMat;let p=this.parity^1;for(let u=0;u<this.out.length;u++)l.uCascade.value=u,l.uPrev.value=this.out[u][this.parity].textures[0],s.render(o,this.out[u][p]),this.displacement[u]=this.out[u][p].textures[0],this.slope[u]=this.out[u][p].textures[1];this.parity=p}};var Nt=6,Mi=32,is=`
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`,os=`
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
`,no=`
uniform sampler2D tSrc;
uniform vec2 uTexel; // source texel size
#ifdef PREFILTER
uniform vec4 uCurve; // threshold-knee, 2*knee, 0.25/knee, threshold
uniform float uClamp;
#endif

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 tap(vec2 o) {
  vec3 c = texture(tSrc, vUv + o * uTexel).rgb;
#ifdef PREFILTER
  c = max(c, 0.0); // negatives (and NaN on most GPUs) -> 0
  float l = max(luma(c), 1e-4);
  c *= min(1.0, uClamp / l);
  l = min(l, uClamp);
  float q = clamp(l - uCurve.x, 0.0, uCurve.y);
  c *= max(uCurve.z * q * q, l - uCurve.w) / l;
#endif
  return c;
}

void main() {
  vec3 a = tap(vec2(-2.0, 2.0)), b = tap(vec2(0.0, 2.0)), c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0, 0.0)), f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0)), h = tap(vec2(0.0, -2.0)), i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0)), k = tap(vec2(1.0, 1.0)), l = tap(vec2(-1.0, -1.0)), m = tap(vec2(1.0, -1.0));
  vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25;
  vec3 g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25;
  vec3 g4 = (j + k + l + m) * 0.25;
#ifdef PREFILTER
  float w0 = 0.125 / (1.0 + luma(g0)), w1 = 0.125 / (1.0 + luma(g1));
  float w2 = 0.125 / (1.0 + luma(g2)), w3 = 0.125 / (1.0 + luma(g3));
  float w4 = 0.5 / (1.0 + luma(g4));
  vec3 r = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
#else
  vec3 r = g4 * 0.5 + (g0 + g1 + g2 + g3) * 0.125;
#endif
  fragColor = vec4(r, 1.0);
}`,ss=`
uniform sampler2D tSrc;
uniform vec2 uTexel; // source (coarser) texel size
void main() {
  vec4 d = uTexel.xyxy * vec4(1.0, 1.0, -1.0, 0.0);
  vec3 s = texture(tSrc, vUv - d.xy).rgb + texture(tSrc, vUv - d.wy).rgb * 2.0 + texture(tSrc, vUv - d.zy).rgb
    + texture(tSrc, vUv + d.zw).rgb * 2.0 + texture(tSrc, vUv).rgb * 4.0 + texture(tSrc, vUv + d.xw).rgb * 2.0
    + texture(tSrc, vUv + d.zy).rgb + texture(tSrc, vUv + d.wy).rgb * 2.0 + texture(tSrc, vUv + d.xy).rgb;
  fragColor = vec4(s * (1.0 / 16.0), 1.0);
}`,as=`
uniform sampler2D tSrc;
uniform vec2 uJitter; // [0,1)^2
void main() {
  float s = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec2 o = (vec2(float(i), float(j)) + uJitter) * 0.25 - 0.5;
    vec3 c = max(texture(tSrc, vUv + o * ${(1/Mi).toFixed(8)}).rgb, 0.0);
    s += log2(clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4, 64.0));
  }
  fragColor = vec4(s * (1.0 / 16.0), 0.0, 0.0, 1.0);
}`,rs=`
uniform sampler2D tSrc;  // metering target, linear filtered
uniform sampler2D tPrev; // previous 1x1 state
uniform vec2 uK;         // blend factor when scene brightens (x) / darkens (y); 1 = snap
uniform vec2 uRange;     // allowed log2 luminance range (from min/max exposure)
void main() {
  float sum = 0.0;
  for (int j = 0; j < 16; j++) for (int i = 0; i < 16; i++)
    sum += texture(tSrc, (vec2(float(i), float(j)) + 0.5) * (1.0 / 16.0)).r;
  float t = clamp(sum * (1.0 / 256.0), uRange.x, uRange.y);
  float prev = texelFetch(tPrev, ivec2(0), 0).r;
  float k = t > prev ? uK.x : uK.y;
  float s = k >= 1.0 ? t : prev + (t - prev) * k;
  if (isnan(s)) s = t;
  fragColor = vec4(s, 0.0, 0.0, 1.0);
}`,ns=`
uniform sampler2D tHdr;
uniform sampler2D tBloom;
uniform sampler2D tExp;   // 1x1 adapted log2 average luminance
uniform float uExposure;  // exposure compensation (auto) or absolute exposure
uniform float uAuto;      // 1 = auto exposure
uniform vec3 uExpo;       // keyValue, minExposure, maxExposure
uniform float uBloom;
uniform vec2 uLook;       // AgX look: power (contrast), saturation
uniform float uFrame;     // 0..255, dither seed
uniform float uDroplets;  // 0..1
uniform float uTime;      // seconds, wraps at 4096
uniform float uAspect;    // width / height
uniform float uResY;      // height in pixels

const mat3 SRGB_TO_REC2020 = mat3(
  vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
const mat3 REC2020_TO_SRGB = mat3(
  vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
const mat3 AGX_INSET = mat3(
  vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
  vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
  vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
const mat3 AGX_OUTSET = mat3(
  vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
  vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
  vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
const float AGX_MIN_EV = -12.47393;
const float AGX_MAX_EV = 4.026069;

vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

vec3 agx(vec3 c) {
  c = AGX_INSET * (SRGB_TO_REC2020 * c);
  c = clamp((log2(max(c, 1e-10)) - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV), 0.0, 1.0);
  c = agxContrast(c);
  // AgX "punchy"-style look in the encoded domain
  c = pow(max(c, 0.0), vec3(uLook.x));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = l + uLook.y * (c - l);
  c = AGX_OUTSET * c;
  return clamp(REC2020_TO_SRGB * pow(max(c, 0.0), vec3(2.2)), 0.0, 1.0);
}

// Dave Hoskins hash without sine
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

// ---- lens droplets (only evaluated when uDroplets > 0) -----------------------------------------
// All lengths are in screen-height units (p = vUv * vec2(aspect, 1)). Each drop is a tiny lens: the
// image under it is sampled from the mirrored side of its centre, sample = centre - (K-1) * d, so it
// looks inverted and slightly magnified, with a faint dark rim.
const float DROP_K = 1.8;

// d: pixel - drop centre, r: radius. Returns (uv offset, darkening).
vec3 lensDrop(vec2 d, float r) {
  float dist = length(d);
  float cov = clamp((r - dist) * uResY + 0.5, 0.0, 1.0); // 1px AA
  if (cov <= 0.0) return vec3(0.0);
  return vec3(-d * DROP_K * cov, 0.22 * smoothstep(0.6, 1.0, dist / r) * cov);
}

// One drop (at most) per grid cell, kept inside its cell so only the own cell is tested.
vec3 dropLayer(vec2 p, float scale, float density, float seed) {
  vec2 q = p * scale + seed * 17.31;
  vec2 id = floor(q);
  vec3 h = hash33(vec3(id, seed)), g = hash33(vec3(id + 57.0, seed));
  if (h.x > density) return vec3(0.0);
  float fade = clamp((uDroplets - g.x * 0.8) * 6.0, 0.0, 1.0); // drops dry up one by one (order = g.x)
  float rf = mix(0.10, 0.24, h.y * h.y);                          // radius, cell units
  vec2 c = rf + vec2(h.z, g.y) * (1.0 - 2.0 * rf);
  return lensDrop((fract(q) - c) / scale, rf * fade / scale);
}

// A drop sliding down the lens, leaving a thin wet trail above it. speed in cycles/s.
// Head enters above the screen and leaves below with its trail fully off-screen, so the wrap never pops.
vec3 streak(vec2 p, float id, float speed, float amp) {
  const float R = 0.016, L = 0.45, W = 0.0035;
  float u = uTime * speed + id * 0.37;
  float cyc = mod(floor(u), 128.0), f = fract(u);
  f += 0.012 * sin(f * 47.0); // stick-slip
  vec3 h = hash33(vec3(id, cyc, 5.1));
  float x0 = (0.08 + 0.84 * h.x) * uAspect;
  float hy = mix(1.0 + R, -R - L, f);
  float hx = x0 + 0.006 * sin(hy * 14.0 + h.y * 6.28);
  vec3 o = lensDrop(p - vec2(hx, hy), R * amp);
  float ty = p.y - hy;
  if (ty > 0.0 && ty < L) {
    float a = smoothstep(0.0, 0.03, ty) * (1.0 - ty / L) * amp;
    float tx = (p.x - x0 - 0.006 * sin(p.y * 14.0 + h.y * 6.28)) / W;
    float cov = clamp((1.0 - abs(tx)) * W * uResY + 0.5, 0.0, 1.0) * a;
    o += vec3(-tx * W * DROP_K * cov, 0.0, 0.12 * smoothstep(0.5, 1.0, abs(tx)) * cov);
  }
  return o;
}

// Returns (uv offset, darkening).
vec3 droplets() {
  vec2 p = vUv * vec2(uAspect, 1.0);
  float sa = smoothstep(0.0, 0.4, uDroplets);
  vec3 a = dropLayer(p, 6.0, 0.30, 0.0) + dropLayer(p, 10.0, 0.20, 1.0) + dropLayer(p, 17.0, 0.06, 2.0)
    + streak(p, 0.0, 0.0625, sa) + streak(p, 1.0, 0.03125, sa);
  return vec3(a.xy / vec2(uAspect, 1.0), min(a.z, 0.5));
}

void main() {
  float ex = uExposure;
  if (uAuto > 0.5) ex *= clamp(uExpo.x * exp2(-texelFetch(tExp, ivec2(0), 0).r), uExpo.y, uExpo.z);

  vec2 uv = vUv;
  float dark = 0.0;
  if (uDroplets > 0.001) {
    vec3 dr = droplets();
    uv += dr.xy;
    dark = dr.z;
  }

  vec3 c = (texture(tHdr, uv).rgb + texture(tBloom, uv).rgb * uBloom) * (ex * (1.0 - dark));
  vec2 d = (vUv - 0.5) * 1.41421356; // |d|^2 = 1 at corners
  c = agx(c) * (1.0 - 0.08 * dot(d, d));
  vec3 o = mix(pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));

  // TPDF dither, +-1/255, after sRGB encoding and before the 8-bit store
  vec3 n = hash33(vec3(gl_FragCoord.xy, uFrame)) + hash33(vec3(gl_FragCoord.xy, uFrame + 17.0));
  fragColor = vec4(o + (n - 1.0) * (1.0 / 255.0), 1.0);
}`,pt=(n,e,t={},i={})=>new Ve({glslVersion:qe,vertexShader:is,fragmentShader:os+n,uniforms:e,defines:t,depthTest:!1,depthWrite:!1,...i}),Wt=class{params={exposure:1,autoExposure:!0,freezeDither:!1,keyValue:.18,adaptUp:2.5,adaptDown:1,minExposure:.05,maxExposure:20,bloomStrength:.06,bloomThreshold:1,bloomClamp:64,contrast:1.12,saturation:1.3,droplets:0};constructor(e){this.renderer=e,this.geometry=new ve,this.geometry.setAttribute("position",new Ze([-1,-1,0,3,-1,0,-1,3,0],3)),this.mesh=new z(this.geometry),this.mesh.frustumCulled=!1,this.camera=new kt(-1,1,1,-1,0,1);let t=()=>({tSrc:{value:null},uTexel:{value:null}});this.matPre=pt(no,{...t(),uCurve:{value:new de},uClamp:{value:64}},{PREFILTER:1}),this.matDown=pt(no,t()),this.matUp=pt(ss,t(),{},{blending:zt,blendEquation:Di,blendSrc:st,blendDst:st}),this.matMeter=pt(as,{tSrc:{value:null},uJitter:{value:new G}}),this.matAdapt=pt(rs,{tSrc:{value:null},tPrev:{value:null},uK:{value:new G(1,1)},uRange:{value:new G(-8,4)}}),this.matComp=pt(ns,{tHdr:{value:null},tBloom:{value:null},tExp:{value:null},uExposure:{value:1},uAuto:{value:1},uExpo:{value:new _(.18,.05,20)},uBloom:{value:0},uLook:{value:new G(1,1)},uFrame:{value:0},uDroplets:{value:0},uTime:{value:0},uAspect:{value:1},uResY:{value:1}}),this.levels=[],this.texel=[new G];for(let s=0;s<Nt;s++)this.levels.push(new $(1,1,{type:ne,format:Ge,minFilter:_e,magFilter:_e,wrapS:ui,wrapT:ui,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1})),this.texel.push(new G);this.meterRT=new $(Mi,Mi,{type:ne,format:Ge,minFilter:_e,magFilter:_e,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1});let i=e.extensions.has("EXT_color_buffer_float");this.adapt=[0,1].map(()=>new $(1,1,{type:i?Re:ne,format:Ge,minFilter:ye,magFilter:ye,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1})),this._cur=0,this._snap=!0,this._frame=0,this._time=0;let o=e.getDrawingBufferSize(new G);this.setSize(o.x,o.y)}setSize(e,t){let i=Math.max(1,Math.floor(e)),o=Math.max(1,Math.floor(t));this.matComp.uniforms.uAspect.value=i/o,this.matComp.uniforms.uResY.value=o,this._snap=!0,this.texel[0].set(1/i,1/o);for(let s=0;s<Nt;s++)i=Math.max(1,Math.floor(i/2)),o=Math.max(1,Math.floor(o/2)),this.levels[s].setSize(i,o),this.texel[s+1].set(1/i,1/o)}_pass(e,t){this.mesh.material=e,this.renderer.setRenderTarget(t),this.renderer.render(this.mesh,this.camera)}_blit(e,t,i,o){e.uniforms.tSrc.value=t,e.uniforms.uTexel.value=i,this._pass(e,o)}_meterExposure(e,t){let i=this.params,o=this.matMeter.uniforms,s=this.matAdapt.uniforms,r=this._frame;o.tSrc.value=e,o.uJitter.value.set(r*.7548776662466927%1,r*.5698402909980532%1),this._pass(this.matMeter,this.meterRT);let a=Math.max(i.keyValue,1e-4),c=Math.max(Math.min(i.minExposure,i.maxExposure),1e-4),l=Math.max(i.minExposure,i.maxExposure,1e-4);s.tSrc.value=this.meterRT.texture,s.tPrev.value=this.adapt[this._cur].texture,s.uK.value.set(this._snap?1:1-Math.exp(-t*i.adaptUp),this._snap?1:1-Math.exp(-t*i.adaptDown)),s.uRange.value.set(Math.log2(a/l),Math.log2(a/c)),this._cur^=1,this._pass(this.matAdapt,this.adapt[this._cur]),this._snap=!1}render(e,t=1/60){let i=this.renderer,o=this.params,s=this.levels,r=this.texel;t=t>0?Math.min(t,1):0,o.freezeDither||(this._frame=this._frame+1&255),this._time=(this._time+t)%4096;let a=i.getRenderTarget(),c=i.autoClear,l=i.info.autoReset;i.autoClear=!1,i.info.autoReset=!1,o.autoExposure?this._meterExposure(e,t):this._snap=!0;let p=o.bloomThreshold,u=Math.max(p*.5,1e-4),v=this.matPre.uniforms;if(v.uCurve.value.set(p-u,2*u,.25/u,p),v.uClamp.value=o.bloomClamp,o.bloomStrength>0){this._blit(this.matPre,e,r[0],s[0]);for(let E=1;E<Nt;E++)this._blit(this.matDown,s[E-1].texture,r[E],s[E]);for(let E=Nt-2;E>=0;E--)this._blit(this.matUp,s[E+1].texture,r[E+2],s[E])}let S=this.matComp.uniforms;S.tHdr.value=e,S.tBloom.value=s[0].texture,S.tExp.value=this.adapt[this._cur].texture,S.uExposure.value=o.exposure,S.uAuto.value=o.autoExposure?1:0,S.uExpo.value.set(o.keyValue,Math.min(o.minExposure,o.maxExposure),Math.max(o.minExposure,o.maxExposure)),S.uLook.value.set(o.contrast,o.saturation),S.uBloom.value=o.bloomStrength,S.uFrame.value=this._frame,S.uDroplets.value=Math.min(Math.max(o.droplets,0),1),S.uTime.value=this._time,this._pass(this.matComp,null),i.setRenderTarget(a),i.autoClear=c,i.info.autoReset=l}dispose(){for(let e of this.levels)e.dispose();this.meterRT.dispose();for(let e of this.adapt)e.dispose();for(let e of[this.matPre,this.matDown,this.matUp,this.matMeter,this.matAdapt,this.matComp])e.dispose();this.geometry.dispose()}};var ls=1;function cs(n={}){return{id:ls++,name:"Light",enabled:!0,color:"#8660ff",intensity:170,x:-3,y:5,z:1,targetX:0,targetZ:0,spread:64,focus:.3,softness:.65,size:.25,...n}}var Yt=class{lights=[];selectedId=null;get selected(){return this.lights.find(e=>e.id===this.selectedId)}add(e={}){if(this.lights.length>=4)return null;let t=cs({name:`Light ${this.lights.length+1}`,...e});return this.lights.push(t),this.selectedId=t.id,t}duplicate(){let e=this.selected;if(!e)return null;let{id:t,...i}=e;return this.add({...i,name:`${e.name} copy`,x:Math.min(10,e.x+1)})}remove(){this.lights=this.lights.filter(e=>e.id!==this.selectedId),this.selectedId=this.lights[0]?.id??null}preset(e){this.lights=[],this.selectedId=null,e==="cross"?(this.add({name:"Glacier",color:"#32cfff",x:-4,y:4.5,z:1,targetX:-1.5,intensity:130,spread:66}),this.add({name:"Amber",color:"#ff9e37",x:4,y:5.5,z:-2,targetX:2,targetZ:-1,intensity:200,spread:62})):e==="white"?this.add({name:"White study",color:"#ffffff",x:-2,y:5,z:-2,intensity:180,spread:42,focus:.5,size:.16}):(this.add({name:"Ultraviolet",color:"#7551ff",x:-3,y:4.5,z:-1,intensity:230,spread:78,targetX:-1}),this.add({name:"Blue hour",color:"#2448ff",x:4,y:5,z:1,intensity:145,spread:70,targetX:2,targetZ:-1})),this.selectedId=this.lights[0].id}},Bt=class{generation=0;events=[];lastTime=-1/0;lastPoint=null;add(e,t,i,o,s,r=!1,a={}){if(r&&(i-this.lastTime<.075||this.lastPoint&&Math.hypot(e-this.lastPoint.x,t-this.lastPoint.z)<o*.28))return!1;if(a.feedback){let c=this.events.findIndex(l=>l.feedback);if(this.events.filter(l=>l.feedback).length>=4||this.events.length===16){if(c<0)return!1;this.events.splice(c,1)}}else this.events.length===16&&this.events.shift();return this.events.push({x:e,z:t,time:i,radius:o,strength:s,y:a.y??0,spray:a.spray??(r?.15:1),feedback:!!a.feedback,bodyId:a.bodyId}),a.feedback||(this.lastTime=i,this.lastPoint={x:e,z:t}),!0}active(e){return this.events.filter(t=>e-t.time<18)}clear(){this.events=[],this.lastTime=-1/0,this.lastPoint=null,this.generation++}},lo=()=>({shape:"sphere",preset:"violet",mode:"interact",camera:"surface",paused:!1,waveStrength:.65,direction:24,detail:1.1,choppiness:.8,speed:.7,brushSize:.45,brushStrength:.28,floorDepth:3,floorVisible:!0,exposure:1.05,bloom:.16,clarity:.8,scattering:.45,caustics:1,resolution:1,causticQuality:384});var ds=100*1024*1024,hs=512*1024*1024,Qt=16;function ps(n){return Math.max(1,Math.ceil(Math.max(n.triangles/125e3,n.drawCalls/16,n.bytes/(32*1024*1024))))}function Zt(n,e=null){let t=n.reduce((o,s)=>o+(s.cost??1),0),i=e?.cost??1;return{used:t,cost:i,remaining:Math.max(0,Math.floor((Qt-t)/i))}}function us(n){let e=new DataView(n);if(n.byteLength<20||e.getUint32(0,!0)!==1179937895||e.getUint32(4,!0)!==2||e.getUint32(8,!0)!==n.byteLength)throw new Error("This is not a valid GLB 2.0 file.");let t=e.getUint32(12,!0);if(e.getUint32(16,!0)!==1313821514||t+20>n.byteLength)throw new Error("The GLB file is incomplete.");let i=JSON.parse(new TextDecoder().decode(new Uint8Array(n,20,t)));if([...i.buffers??[],...i.images??[]].some(s=>s.uri&&!s.uri.startsWith("data:")))throw new Error("Export a self-contained GLB with embedded geometry and textures.");let o=new Set(["KHR_materials_unlit","KHR_mesh_quantization","EXT_meshopt_compression","KHR_texture_transform","KHR_materials_clearcoat","KHR_materials_dispersion","KHR_materials_ior","KHR_materials_sheen","KHR_materials_specular","KHR_materials_transmission","KHR_materials_volume","KHR_materials_emissive_strength","KHR_materials_iridescence","KHR_materials_anisotropy","EXT_texture_webp","EXT_texture_avif","EXT_mesh_gpu_instancing"]);for(let s of i.extensionsRequired??[])if(!o.has(s))throw new Error(`This model requires ${s}. Export a GLB with uncompressed geometry and PNG or JPEG textures to preserve its appearance.`);if((i.meshes??[]).some(s=>s.primitives.some(r=>r.extensions?.KHR_draco_mesh_compression)))throw new Error("Export the GLB without Draco compression; geometry and textures will be kept at full detail.");if((i.textures??[]).some(s=>s.extensions?.KHR_texture_basisu))throw new Error("Export the GLB with PNG or JPEG textures instead of KTX2 textures.");return n}function $t(n){let e=new Set,t=new Set,i=new Set;n?.scene?.traverse(s=>{s.geometry&&e.add(s.geometry);for(let r of Array.isArray(s.material)?s.material:[s.material])if(r){t.add(r);for(let a of Object.values(r))a?.isTexture&&i.add(a)}});for(let s of e)s.dispose();for(let s of t)s.dispose();let o=new Set;for(let s of i)s.source?.data&&o.add(s.source.data),s.dispose();for(let s of o)s.close?.()}function fs(n,e){n.updateMatrixWorld(!0);let t=new ji().setFromObject(n,!0),i=t.getSize(new _),o=t.getCenter(new _),s=Math.max(i.x,i.y,i.z),r=new Set,a=new Set,c=0,l=0,p=0,u=0,v=!1;n.traverseVisible(d=>{if(d.isLine||d.isPoints)throw new Error("Export this model as triangle meshes; line and point primitives are not supported.");if(!d.isMesh)return;let f=d.geometry,m=f.attributes.position;if(!m)return;for(let x=0;x<m.count;x++)if(!Number.isFinite(m.getX(x)+m.getY(x)+m.getZ(x)))throw new Error("The model contains invalid coordinates.");c+=Math.floor((f.index?.count??m.count)/3)*(d.isInstancedMesh?d.count:1);let g=Array.isArray(d.material)?d.material:[d.material];v||=g.some(x=>x.isMeshBasicMaterial),l+=Math.max(1,f.groups.length)*(g.some(x=>x.transmission>0)?3:1);for(let x of[f.index,...Object.values(f.attributes),...Object.values(f.morphAttributes).flat(),d.instanceMatrix,d.instanceColor]){let R=(x?.data?.array??x?.array)?.buffer;R&&r.add(R)}for(let x of g)for(let R of Object.values(x))R?.isTexture&&a.add(R)});for(let d of r)p+=d.byteLength;let S=new Set;for(let d of a){if(S.has(d.source))continue;S.add(d.source);let f=d.source.data;u=Math.max(u,f?.width??0,f?.height??0),p+=(f?.width??1)*(f?.height??1)*4*(d.generateMipmaps?4/3:1)}if(!c)throw new Error("No usable triangle mesh was found in this file.");if(!Number.isFinite(s)||s<1e-8)throw new Error("The model has invalid bounds.");let E={triangles:c,drawCalls:l,bytes:p,maxTextureDimension:u},b=ps(E);if(b>Qt)throw new Error("This model exceeds the scene budget at full detail. Export a lighter copy, or use fewer/lower-resolution textures. No detail has been reduced.");let A=new Xe,L=new Xe;return L.position.copy(o).negate(),L.add(n),A.add(L),A.scale.setScalar(1/s),A.updateMatrixWorld(!0),{name:e,scene:A,extent:i.divideScalar(s),stats:E,cost:b,unlit:v,lighting:"studio",sourceTriangles:c}}async function co(n,e=()=>{}){if(!n||n.size>ds)throw new Error("Choose a model smaller than 100 MB.");let t=n.name.split(".").pop().toLowerCase();if(!["glb","obj","stl"].includes(t))throw new Error("Choose a GLB, OBJ, or STL file.");let i;try{if(e("Reading original geometry and materials\u2026"),t==="obj"){let{OBJLoader:o}=await import("./chunks/OBJLoader-JDMNI4YZ.js"),s=await n.text();if(/^\s*mtllib\s+/m.test(s))throw new Error("This OBJ references a separate material file. Export a GLB with embedded materials and textures to keep its appearance.");i=new o().parse(s)}else if(t==="stl"){let{STLLoader:o}=await import("./chunks/STLLoader-M47MPSAF.js"),s=new o().parse(await n.arrayBuffer());i=new Xe,i.add(new z(s,new At({color:12896464,roughness:.45,vertexColors:!!s.attributes.color})))}else{let[{GLTFLoader:o},{MeshoptDecoder:s}]=await Promise.all([import("./chunks/GLTFLoader-AY75GM3H.js"),import("./chunks/meshopt_decoder.module-AS77BMSU.js")]),r=new Wi,a=!1;if(r.onError=()=>{a=!0},r.setURLModifier(l=>{if(l.startsWith("blob:")||l.startsWith("data:"))return l;throw new Error("Export a self-contained GLB with embedded textures.")}),i=(await new o(r).setMeshoptDecoder(s).parseAsync(us(await n.arrayBuffer()),"")).scene,a)throw new Error("A model texture could not be opened. Export a GLB with embedded PNG or JPEG textures.")}return e("Checking scene capacity\u2026"),fs(i,n.name)}catch(o){throw i&&$t({scene:i}),o}}var Gt=class{models=[];revision=0;nextId=1;constructor(e=1/0){this.maxTextureSize=e}add(e){if(e.stats.maxTextureDimension>this.maxTextureSize)throw new Error(`A model texture exceeds this device\u2019s ${this.maxTextureSize}px limit. Export smaller textures; this upload has not been resized.`);if(this.models.reduce((i,o)=>i+o.stats.bytes,0)+e.stats.bytes>hs)throw new Error("The model library is full. Remove an uploaded model to free memory.");let t={...e,id:`model-${this.nextId++}`};return this.models.push(t),this.revision++,t}get(e){return this.models.find(t=>t.id===e)}remove(e){let t=this.get(e);this.models=this.models.filter(i=>i.id!==e),$t(t),this.revision++}};var Ee=Qt,je=.35,Fe=1.5,ms=1.2,Je=["sphere","pyramid","cube"],Kt=n=>je+(Fe-je)*Math.min(1,Math.max(0,n/ms)),we=(n,e,t)=>Math.max(e,Math.min(t,n)),F=(n,e,t)=>new _(n,e,t),Jt=class{generation=0;current=null;pending=new Set;begin(e,t,i){if(this.current)return null;let o={kind:e,start:t,pointerId:i,generation:this.generation,hit:null,end:null};return this.current=o,this.pending.add(o),o}relocate(e){return e!==this.current?null:(e.revision=(e.revision??0)+1,e.resolved=!1,e.revision)}resolve(e,t,i=0){return!this.pending.has(e)||e.generation!==this.generation||i!==(e.revision??0)?null:(e.hit=t,e.resolved=!0,this.finish(e))}release(e,t){let i=this.current;return!i||i.pointerId!==e?null:(i.end=t,this.current=null,this.finish(i))}finish(e){return!e.resolved||e.end===null?null:(this.pending.delete(e),e.hit?{kind:e.kind,hit:e.hit,size:Kt(e.end-e.start)}:null)}preview(e){let t=this.current;return t?.hit?{kind:t.kind,hit:t.hit,size:Kt(e-t.start)}:null}cancel(){this.generation++,this.current=null,this.pending.clear()}},zi=[];for(let n of[-.5,.5])for(let e of[-.5,.5])for(let t of[-.5,.5])zi.push(F(n,e,t));var Ti=[F(-.5,-.25,-.5),F(.5,-.25,-.5),F(.5,-.25,.5),F(-.5,-.25,.5),F(0,.75,0)],mt={cube:{vertices:zi,normals:[F(1,0,0),F(0,1,0),F(0,0,1)],edges:[F(1,0,0),F(0,1,0),F(0,0,1)],volume:1,bottom:.5},pyramid:{vertices:Ti,normals:[F(0,-1,0),F(1,.5,0).normalize(),F(-1,.5,0).normalize(),F(0,.5,1).normalize(),F(0,.5,-1).normalize()],edges:[F(1,0,0),F(0,0,1),...Ti.slice(0,4).map(n=>Ti[4].clone().sub(n).normalize())],volume:1/3,bottom:.25},sphere:{vertices:[],normals:[],edges:[],volume:Math.PI/6,bottom:.5}};function xs(n){let e=[],t=mt[n].bottom;for(let i=0;i<4;i++)for(let o=0;o<4;o++)for(let s=0;s<4;s++){let r=F((i+.5)/4-.5,(o+.5)/4-t,(s+.5)/4-.5);n==="sphere"&&r.length()>.5||n==="pyramid"&&Math.max(Math.abs(r.x),Math.abs(r.z))+.5*r.y>.375||e.push(r)}return e}for(let n of Je)mt[n].samples=xs(n);function gs(n){let e=n.extent.clone().max(F(.04,.04,.04));return{...mt.cube,vertices:zi.map(t=>t.clone().multiply(e)),samples:mt.cube.samples.map(t=>t.clone().multiply(e)),volume:e.x*e.y*e.z,bottom:e.y/2}}function ut(n){let e=n.geometry??mt[n.kind];return{vertices:e.vertices.map(t=>t.clone().multiplyScalar(n.size).applyQuaternion(n.rotation).add(n.position)),normals:e.normals.map(t=>t.clone().applyQuaternion(n.rotation)),edges:e.edges.map(t=>t.clone().applyQuaternion(n.rotation))}}function ft(n,e,t){if(n.kind==="sphere"){let s=n.position.dot(t);return[s-n.size/2,s+n.size/2]}let i=1/0,o=-1/0;for(let s of e.vertices){let r=s.dot(t);i=Math.min(i,r),o=Math.max(o,r)}return[i,o]}function ys(n,e){let t=e.position.clone().sub(n.position);if(t.length()>n.radius+e.radius)return null;if(n.kind==="sphere"&&e.kind==="sphere"){let c=t.length(),l=(n.size+e.size)/2-c;return l>0?{normal:c>1e-6?t.divideScalar(c):F(1,0,0),depth:l}:null}let i=ut(n),o=ut(e),s=[...i.normals,...o.normals];for(let c of i.edges)for(let l of o.edges)s.push(c.clone().cross(l));if(n.kind==="sphere"||e.kind==="sphere"){let c=n.kind==="sphere"?n.position:e.position,l=n.kind==="sphere"?o:i;for(let p of l.vertices){s.push(p.clone().sub(c));for(let u of l.edges){let v=c.clone().sub(p);s.push(v.addScaledVector(u,-v.dot(u)))}}}let r=1/0,a=null;for(let c of s){if(c.lengthSq()<1e-9)continue;c.normalize();let l=ft(n,i,c),p=ft(e,o,c),u=Math.min(l[1]-p[0],p[1]-l[0]);if(u<=0)return null;u<r&&(r=u,a=c.clone(),t.dot(a)<0&&a.negate())}return a?{normal:a,depth:r}:null}var ei=class{bodies=[];selectedId=null;get selected(){return this.bodies.find(e=>e.id===this.selectedId)??null}select(e){return this.selectedId=this.bodies.some(t=>t.id===e)?e:null,this.selected}generation=0;nextId=1;accumulator=0;lastQueryTime=-1/0;time=0;moveSession=null;add(e,t,i,o=null){if(!Je.includes(e)&&o?.id!==e)throw new Error("Unknown shape");if(i=we(i,je,o?3:Fe),!Zt(this.bodies,o).remaining)if(!o&&this.bodies.length===Ee&&this.bodies.every(p=>Je.includes(p.kind)))this.bodies.shift();else return null;let s=o?gs(o):mt[e],r=this.nextId++,a=F(we(t.x,-9,9),t.y+2+s.bottom*i,we(t.z,-9,9)),c={id:r,kind:e,size:i,cost:o?.cost??1,geometry:s,position:a,velocity:F(0,0,0),rotation:new se().setFromAxisAngle(F(0,1,0),r*2.4),angularVelocity:F(0,0,0),entered:!1,mass:s.volume*i**3*.38,radius:e==="sphere"?i/2:Math.max(...s.vertices.map(p=>p.length()))*i,samples:s.samples.map(p=>p.clone().multiplyScalar(i)),water:s.samples.map(()=>({height:t.y,x:a.x,z:a.z,sx:0,sz:0,vy:0}))};o&&c.rotation.identity();let l=F(0,0,0);for(let p of c.samples)l.add(F(p.y*p.y+p.z*p.z,p.x*p.x+p.z*p.z,p.x*p.x+p.y*p.y));return l.multiplyScalar(c.mass/c.samples.length),c.invInertia=F(1/Math.max(l.x,1e-5),1/Math.max(l.y,1e-5),1/Math.max(l.z,1e-5)),this.bodies.push(c),this.selectedId=c.id,this.generation++,c}resizeModel(e,t){let i=this.bodies.find(o=>o.id===e);return!i||Je.includes(i.kind)?!1:this.resizeBody(e,t)}resizeBody(e,t){let i=this.bodies.find(r=>r.id===e);if(!i||!Number.isFinite(t))return!1;this.endMove();let o=we(t,je,Je.includes(i.kind)?Fe:3),s=o/i.size;i.size=o,i.radius*=s,i.mass*=s**3,i.invInertia.divideScalar(s**5);for(let r of i.samples)r.multiplyScalar(s);return i.velocity.set(0,0,0),i.angularVelocity.set(0,0,0),this.generation++,!0}setSuspended(e,t){let i=this.bodies.find(o=>o.id===e);return i?(this.endMove(),i.suspended=!!t,i.velocity.set(0,0,0),i.angularVelocity.set(0,0,0),t||(i.poseAngles=null,this.rearmImpact(i)),this.generation++,!0):!1}rearmImpact(e){ft(e,ut(e),F(0,1,0))[0]>Math.max(...e.water.map(i=>i.height))+.08&&(e.entered=!1)}constrain(e,t){let i=ut(e);for(let[o,s,r]of[[F(1,0,0),-10,10],[F(0,0,1),-10,10],[F(0,1,0),-t,8]]){let[a,c]=ft(e,i,o);e.position.addScaledVector(o,a<s?s-a:c>r?r-c:0)}}pose(e,t,i=3){let o=this.bodies.find(a=>a.id===e),s=["x","y","z","size","tilt","turn","roll"];if(!o||!Object.keys(t).length||Object.entries(t).some(([a,c])=>!s.includes(a)||!Number.isFinite(c)))return!1;this.endMove(),t.size!==void 0&&this.resizeBody(e,t.size);for(let a of["x","y","z"])t[a]!==void 0&&(o.position[a]=t[a]);let r=o.poseAngles?.clone()??new rt().setFromQuaternion(o.rotation,"XYZ");for(let[a,c]of[["tilt","x"],["turn","y"],["roll","z"]])t[a]!==void 0&&(r[c]=we(t[a],-180,180)*Math.PI/180);return o.rotation.setFromEuler(r).normalize(),o.poseAngles=r,this.constrain(o,i),this.setSuspended(e,!0),!0}remove(e){this.moveSession?.body.id===e&&this.endMove(),this.bodies=this.bodies.filter(t=>t.id!==e),this.selectedId===e&&(this.selectedId=null),this.generation++}clear(){this.endMove(),this.bodies=[],this.selectedId=null,this.generation++,this.accumulator=0,this.lastQueryTime=-1/0}removeModel(e){this.moveSession?.body.kind===e&&this.endMove(),this.bodies=this.bodies.filter(t=>t.kind!==e),this.generation++,this.selected||(this.selectedId=null)}beginMove(e,t,i=new _(0,1,0)){if(this.moveSession)return!1;let o=this.bodies.find(r=>r.id===e);if(!o)return!1;let s=ft(o,ut(o),F(0,1,0)).map(r=>r-o.position.y);return this.moveSession={body:o,hit:t.clone(),normal:i.clone().normalize(),bounds:s,position:o.position.clone(),velocity:o.velocity.clone(),angularVelocity:o.angularVelocity.clone()},o.held=!0,o.velocity.set(0,0,0),o.angularVelocity.set(0,0,0),this.generation++,!0}move(e,t=3){let i=this.moveSession;if(!i)return!1;let o=e.direction.dot(i.normal);if(Math.abs(o)<1e-4)return!1;let s=i.hit.clone().sub(e.origin).dot(i.normal)/o;if(s<0||s>100)return!1;let{body:r,position:a,hit:c}=i,l=e.at(s,new _).sub(c).add(a),p=10-r.radius;return r.position.set(we(l.x,-p,p),we(l.y,-t-i.bounds[0]+.01,8-i.bounds[1]),we(l.z,-p,p)),this.generation++,!0}endMove(e=!1){let t=this.moveSession;if(!t)return;let{body:i}=t;if(e)i.position.copy(t.position),i.velocity.copy(t.velocity),i.angularVelocity.copy(t.angularVelocity);else{let o=Math.max(...i.water.map(s=>s.height));i.position.y+t.bounds[0]>o+.08&&(i.entered=!1)}i.held=!1,this.moveSession=null,this.generation++}query(){let e=[];for(let t of this.bodies)for(let i of t.samples){let o=i.clone().applyQuaternion(t.rotation).add(t.position);e.push(o.x,o.z)}return{generation:this.generation,time:this.time,points:new Float32Array(e)}}ingest(e,t){if(e.generation!==this.generation||e.time<=this.lastQueryTime||t.length!==e.points.length*2)return!1;let i=e.time-this.lastQueryTime,o=0;for(let s of this.bodies)for(let r of s.water){let a=t[o*4],c=e.points[o*2],l=e.points[o*2+1],p=r.height+r.sx*(c-r.x)+r.sz*(l-r.z);r.vy=Number.isFinite(i)&&i>0?we((a-p)/i,-1,1):0,Object.assign(r,{height:a,sx:t[o*4+1],sz:t[o*4+2],x:c,z:l}),o++}return this.lastQueryTime=e.time,!0}impulse(e,t,i,o=null){for(let s of this.bodies){if(!s.entered||s.held||s.suspended||s.id===o)continue;let r=F(s.position.x-e,0,s.position.z-t),a=r.length();a<.001||a>4||s.velocity.addScaledVector(r.normalize(),Math.min(.7,i)*Math.exp(-a*.8))}}step(e,t,i=()=>{}){if(e<=0)return;let o=1/120;for(this.accumulator+=Math.min(e,.1);this.accumulator>=o;){this.accumulator-=o,this.time+=o;for(let s of this.bodies)this.integrate(s,o,t,i);for(let s=0;s<2;s++)for(let r=0;r<this.bodies.length;r++)for(let a=r+1;a<this.bodies.length;a++)this.collide(this.bodies[r],this.bodies[a])}}integrate(e,t,i,o){if(e.held||e.suspended)return;let s=F(0,-9.81*e.mass,0),r=F(0,0,0),a=e.rotation.clone().invert(),c=!1,l=0;for(let S=0;S<e.samples.length;S++){let E=e.samples[S].clone().applyQuaternion(e.rotation),b=E.clone().add(e.position),A=e.water[S],L=A.height+we(A.sx*(b.x-A.x)+A.sz*(b.z-A.z),-.25,.25),d=we((L-b.y)/(e.size/4)+.5,0,1);if(d<=0)continue;c=!0,l=L;let f=e.angularVelocity.clone().cross(E).add(e.velocity),m=e.mass/e.samples.length,g=F(-f.x*m*3.5*d,9.81*m/.38*d-(f.y-A.vy)*m*7*d,-f.z*m*3.5*d);s.add(g),r.add(E.clone().cross(g))}if(c&&!e.entered){e.entered=!0;let S=we(.12+e.size*Math.max(0,-e.velocity.y)*.09,.15,.8),E={x:e.position.x,z:e.position.z,y:l,radius:e.size*.55,strength:S,bodyId:e.id};o(E),this.impulse(E.x,E.z,S,e.id)}e.velocity.addScaledVector(s,t/e.mass).clampLength(0,10),e.position.addScaledVector(e.velocity,t);let p=r.applyQuaternion(a).multiply(e.invInertia).applyQuaternion(e.rotation);e.angularVelocity.addScaledVector(p,t).multiplyScalar(Math.exp(-t*(c?3:.15))).clampLength(0,4);let u=e.angularVelocity.length();u>1e-6&&e.rotation.premultiply(new se().setFromAxisAngle(e.angularVelocity.clone().divideScalar(u),u*t)).normalize();let v=ut(e);for(let[S,E,b]of[[F(1,0,0),-10,10],[F(0,0,1),-10,10],[F(0,1,0),-i,1/0]]){let[A,L]=ft(e,v,S),d=A<E?E-A:L>b?b-L:0;if(!d)continue;e.position.addScaledVector(S,d);let f=e.velocity.dot(S);f*d<0&&e.velocity.addScaledVector(S,-f*1.08),e.angularVelocity.multiplyScalar(.95)}}collide(e,t){let i=ys(e,t);if(!i)return;let{normal:o,depth:s}=i,r=e.held||e.suspended?0:1/e.mass,a=t.held||t.suspended?0:1/t.mass,c=r+a;if(!c)return;let l=Math.max(0,s-.001)*.75/c;e.position.addScaledVector(o,-l*r),t.position.addScaledVector(o,l*a);let p=t.velocity.clone().sub(e.velocity).dot(o);if(p>=0)return;let u=-1.08*p/c;e.velocity.addScaledVector(o,-u*r),t.velocity.addScaledVector(o,u*a);let v=t.velocity.clone().sub(e.velocity);v.addScaledVector(o,-v.dot(o));let S=o.clone().cross(v).multiplyScalar(.08);!e.held&&!e.suspended&&e.angularVelocity.add(S),!t.held&&!t.suspended&&t.angularVelocity.sub(S)}};var ho=`
precision highp float;
uniform sampler2D uDisp,uSlope,uSwellDisp,uSwellSlope;
uniform float uWaveStrength;
in vec2 vUv;
out vec4 outColor;
vec3 displacement(vec2 p){return (textureLod(uDisp,p/12.0,0.0).xyz+textureLod(uSwellDisp,p/24.0,0.0).xyz*.24)*uWaveStrength;}
void main(){
  vec2 p=vUv*24.0,q=p;
  for(int i=0;i<3;i++)q=p-displacement(q).xz;
  float h=displacement(q).y;
  vec2 slope=(textureLod(uSlope,q/12.0,.6).xy+textureLod(uSwellSlope,q/24.0,.6).xy*(.24*85.0/24.0))*uWaveStrength;
  float bound=1.0+h*h/4.0;
  outColor=vec4(h/sqrt(bound),slope/pow(bound,1.5),textureLod(uDisp,q/12.0,0.0).w);
}`,xt=`
precision highp float;
precision highp int;
uniform sampler2D uSurface, uDetail;
uniform float uWaveStrength, uDetailStrength, uChoppiness;
uniform int uRippleCount,uTraceSteps;
uniform vec4 uRipples[${16}];
uniform float uRippleSize[${16}];
const float PI = 3.14159265359;
vec3 impact(vec2 p) {
  vec3 result = vec3(0.0);
  for (int i = 0; i < uRippleCount; i++) {
    vec4 e = uRipples[i];
    if(e.w <= 0.0) continue;
    vec2 delta = p - e.xy;
    float r = max(length(delta), 0.001), age = max(e.z, 0.0), L = max(uRippleSize[i],0.1);
    float speed=1.6+0.6*sqrt(L), width=L*0.65+0.16;
    float d=r-speed*age;
    // Outside the Gaussian support the contribution is below a tenth of a
    // millimeter. Skip expensive trig/exp work without changing visible rings.
    if(abs(d)>width*4.0 && (age>0.8 || r>L*3.0))continue;
    // An immediate crater rebounds into a mound, followed by a travelling ring.
    float q=r/L, core=exp(-q*q*1.5);
    float pulse=-exp(-age*12.0)+0.85*exp(-pow((age-0.24)/0.17,2.0));
    float h=e.w*pulse*core;
    float dh=h*(-3.0*r/(L*L));
    float envelope=exp(-d*d/(2.0*width*width));
    float fade=(1.0-exp(-age*14.0))*exp(-age*0.7);
    float k=3.5/width, phase=k*d;
    float amplitude=e.w*0.65*fade*L/(L+r);
    h+=amplitude*envelope*cos(phase);
    dh+=amplitude*envelope*((-d/(width*width)-1.0/(L+r))*cos(phase)-k*sin(phase));
    result+=vec3(h,delta/r*dh);
  }
  // Smooth saturation bounds overlapping impacts, including their derivatives.
  float bound=1.0+result.x*result.x/(0.7*0.7);
  result=vec3(result.x/sqrt(bound),result.yz/pow(bound,1.5));
  return result;
}
// Return height and slopes; rendering, caustics, picks and both physics queries
// all use this same world-space evaluation.
vec3 wave(vec2 p) {
  vec3 field=textureLod(uSurface,p/24.0,0.0).xyz;
  float h=field.x;vec2 slope=field.yz;
  slope += textureLod(uDetail, p / 2.1, 0.7).xy * uDetailStrength * 0.22;
  return vec3(h, slope) + impact(p);
}
vec3 normalAt(vec2 p) { vec3 w=wave(p); return normalize(vec3(-w.y,1.0,-w.z)); }
float hitWater(vec3 ro, vec3 rd) {
  if (abs(rd.y)<0.0001) return -1.0;
  // Restrict the solve to a slab containing all supported wave displacements.
  float a=(-2.8-ro.y)/rd.y, b=(2.8-ro.y)/rd.y;
  float lo=max(0.001,min(a,b)),hi=min(100.0,max(a,b));
  if(hi<=lo)return -1.0;
  float t=clamp(-ro.y/rd.y,lo,hi);
  for(int i=0;i<uTraceSteps;i++) {
    vec3 p=ro+rd*t,w=wave(p.xz);
    float error=p.y-w.x;
    if(abs(error)<0.002)return t;
    if(error*rd.y>0.0)hi=t;else lo=t;
    float derivative=rd.y-dot(w.yz,rd.xz);
    float candidate=t-error/(abs(derivative)<0.02?(derivative<0.0?-0.02:0.02):derivative);
    t=candidate>lo && candidate<hi?candidate:(lo+hi)*0.5;
  }
  return abs((ro+rd*t).y-wave((ro+rd*t).xz).x)<0.06?t:-1.0;
}
`,ti=`
uniform vec3 uLightPos[4], uLightDir[4], uLightColor[4];
uniform vec4 uBeam[4]; // outer cosine, focus, edge softness, source radius
uniform float uDepth, uClarity;
vec3 absorption() { return vec3(0.18,0.075,0.035)/max(uClarity,0.15); }
vec3 lightAt(int i, vec3 p) {
  vec3 d = p-uLightPos[i];
  float dist2 = dot(d,d);
  float c = dot(normalize(d),uLightDir[i]);
  float edge = mix(0.005,0.85,uBeam[i].z);
  float cone = smoothstep(uBeam[i].x,mix(uBeam[i].x,1.0,edge),c);
  float center = pow(clamp((c-uBeam[i].x)/(1.0-uBeam[i].x),0.0,1.0),uBeam[i].y*5.0);
  return uLightColor[i]*cone*mix(1.0,center,uBeam[i].y)/max(dist2,0.3);
}
float fresnel(float cosine) { return 0.02037+0.97963*pow(1.0-clamp(cosine,0.0,1.0),5.0); }
// Schlick alone is inaccurate at the underwater critical angle. Exact dielectric
// Fresnel approaches total internal reflection continuously instead of popping.
float internalFresnel(float cosine) {
  float ci=clamp(cosine,0.0,1.0), st2=1.333*1.333*(1.0-ci*ci);
  if(st2>=1.0)return 1.0;
  float ct=sqrt(1.0-st2);
  float rs=(1.333*ci-ct)/(1.333*ci+ct);
  float rp=(ci-1.333*ct)/(ci+1.333*ct);
  return 0.5*(rs*rs+rp*rp);
}
`,Ri=`
uniform sampler2D uCausticAtlas;
uniform float uAtlasSize, uCausticStrength;
vec3 sliceLight(int i,int slice,vec3 p) {
  vec2 tile=vec2(float(i),float(slice));
  vec2 uv=p.xz/24.0+0.5;
  if(any(lessThan(uv,vec2(0.0))) || any(greaterThan(uv,vec2(1.0)))) return vec3(0.0);
  float pad=2.0/uAtlasSize;
  vec2 lo=(tile+pad)/vec2(4.0,3.0), hi=(tile+1.0-pad)/vec2(4.0,3.0);
  vec2 atlasUv=(tile+uv)/vec2(4.0,3.0);
  float radius=(0.6+uBeam[i].w*(-p.y)/max(uLightPos[i].y,0.5)*uAtlasSize/24.0)/uAtlasSize;
  vec2 off=radius/vec2(4.0,3.0);
  vec3 c=texture(uCausticAtlas,clamp(atlasUv,lo,hi)).rgb*0.4;
  c+=texture(uCausticAtlas,clamp(atlasUv+vec2(off.x,off.y),lo,hi)).rgb*0.15;
  c+=texture(uCausticAtlas,clamp(atlasUv+vec2(-off.x,off.y),lo,hi)).rgb*0.15;
  c+=texture(uCausticAtlas,clamp(atlasUv+vec2(off.x,-off.y),lo,hi)).rgb*0.15;
  c+=texture(uCausticAtlas,clamp(atlasUv-off,lo,hi)).rgb*0.15;
  return c;
}
// Ray integration already averages many samples. Keep its atlas lookup cheap;
// the visible floor uses the source-size filter above at full resolution.
vec3 volumeSlice(int i,int slice,vec3 p) {
  vec2 uv=p.xz/24.0+0.5;
  if(any(lessThan(uv,vec2(0.0))) || any(greaterThan(uv,vec2(1.0))))return vec3(0.0);
  uv=clamp(uv,vec2(1.0/uAtlasSize),vec2(1.0-1.0/uAtlasSize));
  return texture(uCausticAtlas,(vec2(float(i),float(slice))+uv)/vec2(4.0,3.0)).rgb;
}
vec3 waterLight(int i,vec3 p) {
  float d=clamp(-p.y/uDepth,0.0,1.0);
  if(d<0.25) return mix(lightAt(i,vec3(p.x,0.0,p.z))*0.98,volumeSlice(i,0,p),d/0.25);
  if(d<0.55) return mix(volumeSlice(i,0,p),volumeSlice(i,1,p),(d-0.25)/0.3);
  return mix(volumeSlice(i,1,p),volumeSlice(i,2,p),(d-0.55)/0.45);
}
`,po=xt+ti+`
in vec3 position;
uniform int uLightIndex;
uniform float uSliceDepth;
out vec2 vOriginal;
out vec3 vEnergy;
void main() {
  vec2 xz=position.xy*24.0;
  vec3 w=wave(xz), p=vec3(xz.x,w.x,xz.y);
  vec3 n=normalize(vec3(-w.y,1.0,-w.z));
  vec3 incident=normalize(p-uLightPos[uLightIndex]);
  vec3 ray=refract(incident,n,1.0/1.333);
  float travel=max((uSliceDepth+p.y)/max(-ray.y,0.05),0.0);
  vec2 landed=p.xz+ray.xz*travel;
  float incidence=max(dot(-incident,n),0.0);
  vEnergy=lightAt(uLightIndex,p)*incidence*(1.0-fresnel(incidence))*exp(-absorption()*travel);
  vOriginal=xz;
  gl_Position=vec4(landed/12.0,0.0,1.0);
}`,uo=`
precision highp float;
in vec2 vOriginal;
in vec3 vEnergy;
uniform float uAtlasSize;
out vec4 outColor;
void main() {
  vec2 a=dFdx(vOriginal), b=dFdy(vOriginal);
  float ratio=abs(a.x*b.y-a.y*b.x)*pow(uAtlasSize/24.0,2.0);
  outColor=vec4(vEnergy*min(ratio,12.0),0.0);
}`,fo=`
uniform int uShapeCount;
uniform vec4 uShapes[${Ee}]; // center, size
uniform vec4 uShapeRotation[${Ee}];
uniform int uShapeKind[${Ee}]; // sphere, pyramid, cube
int shapeHitIndex;
vec3 rotateQ(vec3 p,vec4 q) {return p+2.0*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
vec4 planeAt(int kind,int j) {
  if(kind==2) {
    if(j==0)return vec4(1,0,0,0.5);if(j==1)return vec4(-1,0,0,0.5);
    if(j==2)return vec4(0,1,0,0.5);if(j==3)return vec4(0,-1,0,0.5);
    if(j==4)return vec4(0,0,1,0.5);return vec4(0,0,-1,0.5);
  }
  if(j==0)return vec4(0,-1,0,0.25);
  if(j==1)return vec4(1,0.5,0,0.375);if(j==2)return vec4(-1,0.5,0,0.375);
  if(j==3)return vec4(0,0.5,1,0.375);return vec4(0,0.5,-1,0.375);
}
float primitive(vec3 ro,vec3 rd,int kind,out vec3 normal) {
  if(kind==0) {
    float b=dot(ro,rd),c=dot(ro,ro)-0.25,d=b*b-c;
    if(d<0.0)return -1.0;
    float t=-b-sqrt(d);if(t<0.001)t=-b+sqrt(d);
    normal=normalize(ro+rd*t);return t;
  }
  float nearT=-1e5,farT=1e5;vec3 nearN=vec3(0),farN=vec3(0);
  for(int j=0;j<6;j++) {
    if(kind==1 && j==5)break;
    vec4 plane=planeAt(kind,j);float denom=dot(plane.xyz,rd),dist=plane.w-dot(plane.xyz,ro);
    if(abs(denom)<0.000001) {if(dist<0.0)return -1.0;continue;}
    float t=dist/denom;
    if(denom<0.0 && t>nearT){nearT=t;nearN=plane.xyz;}
    if(denom>0.0 && t<farT){farT=t;farN=plane.xyz;}
    if(nearT>farT)return -1.0;
  }
  normal=normalize(nearT>0.001?nearN:farN);return nearT>0.001?nearT:farT;
}
float hitShapes(vec3 ro,vec3 rd,float limit,out vec3 normal) {
  float nearest=limit;bool found=false;shapeHitIndex=-1;
  for(int i=0;i<uShapeCount;i++) {
    vec4 body=uShapes[i];vec3 offset=ro-body.xyz;
    // Cheap bounding sphere rejection before transforming a ray into local space.
    float along=-dot(offset,rd),radius=body.w*0.87;
    if(along+radius<0.0 || along-radius>nearest || dot(offset,offset)-along*along>radius*radius)continue;
    vec4 q=uShapeRotation[i],invQ=vec4(-q.xyz,q.w);vec3 n;
    vec3 localOrigin=rotateQ(offset,invQ)/body.w,localDirection=rotateQ(rd,invQ);
    if(uShapeKind[i]==3)continue;
    float t=primitive(localOrigin,localDirection,uShapeKind[i],n)*body.w;
    if(t>0.002 && t<nearest){nearest=t;normal=rotateQ(n,q);found=true;shapeHitIndex=i;}
  }
  return found?nearest:-1.0;
}
`,mo=xt+ti+Ri+fo+`
in vec2 vUv;
uniform mat4 uInverseProjection,uCameraWorld,uViewProjection;
uniform vec3 uCamera;
uniform float uFloorVisible,uScattering;
uniform sampler2D uVolume;
out vec4 outColor;
vec3 rayDirection(vec2 uv) {
  vec4 v=uInverseProjection*vec4(uv*2.0-1.0,1.0,1.0);
  return normalize((uCameraWorld*vec4(v.xyz/v.w,0.0)).xyz);
}
uniform bool uModelsVisible;
uniform sampler2D uModelColor,uModelPosition,uMirrorColor,uMirrorPosition;
uniform mat4 uMirrorProjection;
uniform vec3 uModelMin,uModelMax;
bool layerBounds(vec3 ro,vec3 rd,vec3 boundsMin,vec3 boundsMax,float limit,out float begin,out float end) {
  vec3 safe=mix(vec3(.00001),rd,greaterThan(abs(rd),vec3(.00001)));
  vec3 a=(boundsMin-ro)/safe,b=(boundsMax-ro)/safe,lo=min(a,b),hi=max(a,b);
  begin=max(.005,max(lo.x,max(lo.y,lo.z)));end=min(limit,min(hi.x,min(hi.y,hi.z)));
  return end>begin;
}
float modelLayer(vec3 ro,vec3 rd,float limit,bool reflected,bool wet,out vec4 color) {
  if(!uModelsVisible)return -1.0;
  float begin,end;if(!layerBounds(ro,rd,uModelMin,uModelMax,limit,begin,end))return -1.0;
  mat4 projection=reflected?uMirrorProjection:uViewProjection;
  // Screen-space secondary rays retain full-resolution mesh silhouettes. A
  // mirrored layer supplies reflected surfaces that the primary camera cannot see.
  float previous=begin;
  for(int i=0;i<=48;i++) {
    float f=float(i)/48.0,t=mix(begin,end,f);
    vec3 p=ro+rd*t;vec4 clip=projection*vec4(p,1.0);
    if(clip.w<=0.0)continue;
    vec2 uv=clip.xy/clip.w*.5+.5;
    if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1)))){previous=t;continue;}
    vec4 surface=reflected?texture(uMirrorPosition,uv):texture(uModelPosition,uv);
    if(surface.w>.5) {
      float along=dot(surface.xyz-ro,rd);
      float error=length(surface.xyz-(ro+rd*along));
      if(along>0.004 && along<limit && along>=previous-.08 && along<=t+.08 && error<.07) {
        if((surface.y<wave(surface.xz).x)==wet){color=reflected?texture(uMirrorColor,uv):texture(uModelColor,uv);return along;}
      }
    }
    previous=t;
  }
  return -1.0;
}
vec3 floorColor(vec3 p) {
  if(uFloorVisible<0.5 || max(abs(p.x),abs(p.z))>10.0) return vec3(0.0);
  vec3 light=vec3(0.0);
  for(int i=0;i<4;i++) {
    if(dot(uLightColor[i],vec3(1.0))<0.001) continue;
    light+=sliceLight(i,2,p);
  }
  return light*0.12*uCausticStrength;
}
vec3 volume(vec3 origin,vec3 direction,float distance) {
  vec3 sum=vec3(0.0);
  float stepSize=min(distance,18.0)/12.0;
  for(int j=0;j<12;j++) {
    float t=(float(j)+0.5)*stepSize;
    vec3 p=origin+direction*t;
    if(p.y>0.05 || p.y < -uDepth) continue;
    for(int i=0;i<4;i++) {
      if(dot(uLightColor[i],vec3(1.0))<0.001) continue;
      vec3 ray=normalize(p-uLightPos[i]);
      float mu=dot(-direction,ray), g=0.35;
      float phase=(1.0-g*g)/(4.0*PI*pow(max(1.0+g*g-2.0*g*mu,0.1),1.5));
      sum+=waterLight(i,p)*exp(-absorption()*t)*phase*stepSize*uScattering*0.22;
    }
  }
  return sum;
}
vec3 shapeColor(vec3 p,vec3 n,vec3 view) {
  float waterY=wave(p.xz).x;
  vec3 col=vec3(0.0);bool wet=p.y<waterY;
  for(int i=0;i<4;i++) {
    if(dot(uLightColor[i],vec3(1.0))<0.001)continue;
    vec3 l=normalize(uLightPos[i]-p),h=normalize(l+view);
    vec3 illumination=wet?waterLight(i,p)*uCausticStrength:lightAt(i,p);
    float diffuse=max(dot(n,l),0.0);
    float sheen=pow(max(dot(n,h),0.0),48.0)*0.45;
    col+=illumination*(vec3(0.72,0.74,0.78)*(diffuse+0.055)/PI+sheen);
    // A restrained bounce from the illuminated water keeps satin faces readable
    // outside a spotlight cone; switching all lights off still gives black.
    if(!wet)col+=lightAt(i,vec3(p.x,waterY,p.z))*vec3(0.72,0.74,0.78)*0.045/(1.0+max(0.0,p.y-waterY));
  }
  return col;
}
vec3 throughWater(vec3 p,vec3 ray) {
  float dist=ray.y < -0.001 ? max((-uDepth-p.y)/ray.y,0.0) : 18.0;
  vec3 n;float t=hitShapes(p+ray*0.005,ray,dist,n);
  vec4 modelColor;float modelT=modelLayer(p,ray,t>0.0?t:dist,false,true,modelColor);
  if(modelT>0.0)return modelColor.rgb*exp(-absorption()*modelT);
  if(t>0.0)return shapeColor(p+ray*t,n,-ray)*exp(-absorption()*t);
  return ray.y < -0.001 ? floorColor(p+ray*dist)*exp(-absorption()*dist) : vec3(0.0);
}
vec3 solidAboveWater(vec3 p,vec3 ray,bool reflected) {
  vec3 n;float t=hitShapes(p+ray*0.005,ray,100.0,n);
  vec4 modelColor;float modelT=modelLayer(p,ray,t>0.0?t:100.0,reflected,false,modelColor);
  if(modelT>0.0)return modelColor.rgb;
  return t>0.0?shapeColor(p+ray*t,n,-ray):vec3(0.0);
}
vec3 specular(vec3 p,vec3 n,vec3 view) {
  vec3 sum=vec3(0.0);
  float nv=max(dot(n,view),0.001);
  for(int i=0;i<4;i++) {
    if(dot(uLightColor[i],vec3(1.0))<0.001) continue;
    vec3 delta=uLightPos[i]-p, l=normalize(delta), h=normalize(l+view);
    float nl=max(dot(n,l),0.0), nh=max(dot(n,h),0.0), vh=max(dot(view,h),0.0);
    float rough=clamp(0.035+uBeam[i].w/length(delta)*0.7,0.035,0.45);
    float a2=rough*rough, d=nh*nh*(a2-1.0)+1.0;
    float D=a2/(PI*d*d);
    float vis=0.5/max(nl*sqrt(nv*nv*(1.0-a2)+a2)+nv*sqrt(nl*nl*(1.0-a2)+a2),0.001);
    sum+=lightAt(i,p)*D*vis*fresnel(vh)*nl;
  }
  return sum;
}
uniform bool uFluidVisible;
uniform sampler2D uFluidNormal,uFluidPosition,uFluidMirrorNormal,uFluidMirrorPosition;
uniform mat4 uFluidMirrorProjection;
uniform vec3 uFluidMin,uFluidMax;
float fluidLayer(vec3 ro,vec3 rd,float limit,bool reflected,out vec3 position,out vec3 normal) {
  if(!uFluidVisible)return -1.0;
  float begin,end;if(!layerBounds(ro,rd,uFluidMin,uFluidMax,limit,begin,end))return -1.0;
  mat4 projection=reflected?uFluidMirrorProjection:uViewProjection;
  float previous=begin;
  for(int i=0;i<=24;i++) {
    float f=float(i)/24.0,t=mix(begin,end,f);
    vec4 clip=projection*vec4(ro+rd*t,1.0);if(clip.w<=0.0)continue;
    vec2 uv=clip.xy/clip.w*.5+.5;
    if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1)))){previous=t;continue;}
    vec4 surface=reflected?texture(uFluidMirrorPosition,uv):texture(uFluidPosition,uv);
    if(surface.w>.5) {
      float along=dot(surface.xyz-ro,rd),error=length(surface.xyz-(ro+rd*along));
      if(along>.015 && along<limit && along>=previous-.06 && along<=t+.06 && error<.055 && surface.y>wave(surface.xz).x-.025) {
        position=surface.xyz;normal=normalize((reflected?texture(uFluidMirrorNormal,uv):texture(uFluidNormal,uv)).xyz);return along;
      }
    }
    previous=t;
  }
  return -1.0;
}
vec3 fluidEnvironment(vec3 origin,vec3 ray,bool reflected) {
  if(origin.y<wave(origin.xz).x)return throughWater(origin,ray);
  float waterT=hitWater(origin,ray),limit=waterT>0.0?waterT:100.0;
  vec3 on;float ot=hitShapes(origin+ray*.005,ray,limit,on);
  vec4 mc;float mt=modelLayer(origin,ray,ot>0.0?ot:limit,reflected,false,mc);
  if(mt>0.0)return mc.rgb;
  if(ot>0.0)return shapeColor(origin+ray*ot,on,-ray);
  if(waterT>0.0) {
    vec3 waterP=origin+ray*waterT,wn=normalAt(waterP.xz);
    if(dot(wn,-ray)<0.0)wn=-wn;
    float wf=fresnel(dot(wn,-ray));
    return throughWater(waterP,refract(ray,wn,1.0/1.333))*(1.0-wf)+solidAboveWater(waterP,reflect(ray,wn),true)*wf+specular(waterP,wn,-ray);
  }
  return vec3(0.0);
}
vec3 fluidColor(vec3 p,vec3 n,vec3 rd) {
  if(dot(n,-rd)<0.0)n=-n;
  vec3 inside=refract(rd,n,1.0/1.333),exitPoint=p+inside*.16;
  // One optical bounce through the extracted surface. The bounded thickness
  // represents a local sheet; secondary rays use the original model layers.
  vec3 transmitted=fluidEnvironment(exitPoint,inside,false);
  float f=fresnel(dot(n,-rd));
  vec3 reflected=fluidEnvironment(p+reflect(rd,n)*.005,reflect(rd,n),true);
  vec3 col=mix(transmitted*exp(-absorption()*.16),reflected,f)+specular(p,n,-rd);
  for(int i=0;i<4;i++)if(dot(uLightColor[i],vec3(1.0))>.001)col+=lightAt(i,p)*vec3(.004,.008,.012)*(1.0-f);
  return col;
}
vec3 aboveWater(vec3 p,vec3 ray,bool reflected) {
  vec3 n;float limit=hitShapes(p+ray*.005,ray,100.0,n);
  vec4 modelColor;float mt=modelLayer(p,ray,limit>0.0?limit:100.0,reflected,false,modelColor);
  if(mt>0.0)limit=mt;
  vec3 fp,fn;float t=fluidLayer(p,ray,limit>0.0?limit:100.0,reflected,fp,fn);
  return t>0.0?fluidColor(fp,fn,ray):mt>0.0?modelColor.rgb:limit>0.0?shapeColor(p+ray*limit,n,-ray):vec3(0.0);
}
`,xo=mo+`
void main() {
  vec3 rd=rayDirection(vUv), ro=uCamera;
  bool underwater=ro.y<wave(ro.xz).x;
  float t=hitWater(ro,rd);
  vec3 col=vec3(0.0);
  if(!underwater) {
    if(t>0.0) {
      vec3 p=ro+rd*t, n=normalAt(p.xz);
      if(dot(n,-rd)<0.0) n=-n;
      vec3 ray=refract(rd,n,1.0/1.333);
      float f=fresnel(dot(n,-rd));
      col=throughWater(p,ray)*(1.0-f)+aboveWater(p,reflect(rd,n),true)*f+specular(p,n,-rd);
      col*=1.0-smoothstep(10.0,15.0,max(abs(p.x),abs(p.z)));
    }
  } else {
    float floorT=rd.y < -0.001 ? (-uDepth-ro.y)/rd.y : 100.0;
    if(t>0.0 && t<floorT) {
      vec3 p=ro+rd*t, n=-normalAt(p.xz);
      if(dot(n,-rd)<0.0) n=-n;
      vec3 exitRay=refract(rd,n,1.333);
      float f=internalFresnel(dot(n,-rd));
      col=throughWater(p,reflect(rd,n))*f;
      if(f<1.0)col+=aboveWater(p,exitRay,false)*(1.0-f);
      if(f<1.0) for(int i=0;i<4;i++) {
        vec3 delta=uLightPos[i]-p;
        float radius=max(uBeam[i].w,0.035)/length(delta);
        float alignment=dot(exitRay,normalize(delta));
        col+=lightAt(i,p)*(1.0-f)*smoothstep(cos(radius*1.8),cos(radius*0.5),alignment)*3.0;
      }
      col=col*exp(-absorption()*t);
    } else col=throughWater(ro,rd);
  }
  vec3 objectNormal;
  float objectT=hitShapes(ro,rd,t>0.0?t:100.0,objectNormal);
  vec3 fog=texture(uVolume,vUv).rgb;
  if(objectT>0.0) {
    col=shapeColor(ro+rd*objectT,objectNormal,-rd);
    if(underwater)col*=exp(-absorption()*objectT);else fog=vec3(0.0);
  }
  if(uModelsVisible) {
    vec4 model=texture(uModelPosition,vUv);
    float modelT=dot(model.xyz-ro,rd),limit=objectT>0.0?objectT:t>0.0?t:100.0;
    if(underwater && rd.y<-.001)limit=min(limit,(-uDepth-ro.y)/rd.y);
    if(model.w>.5 && modelT>0.0 && modelT<limit) {
      vec4 shade=texture(uModelColor,vUv);
      if(underwater)shade.rgb*=exp(-absorption()*modelT);else fog=vec3(0.0);
      col=shade.rgb+col*(1.0-shade.a);objectT=modelT;
    }
  }
  if(uFluidVisible && !underwater) {
    vec4 fluid=texture(uFluidPosition,vUv);
    float fluidT=dot(fluid.xyz-ro,rd),limit=objectT>0.0?objectT:t>0.0?t:100.0;
    if(fluid.w>.5 && fluidT>0.0 && fluidT<limit && fluid.y>wave(fluid.xz).x-.025) {
      col=fluidColor(fluid.xyz,normalize(texture(uFluidNormal,vUv).xyz),rd);fog=vec3(0.0);objectT=fluidT;
    }
  }
  col+=fog;
  float depthT=objectT>0.0?objectT:t>0.0?t:100.0;
  if(underwater && rd.y< -0.001)depthT=min(depthT,(-uDepth-ro.y)/rd.y);
  vec4 clip=uViewProjection*vec4(ro+rd*depthT,1.0);
  gl_FragDepth=clamp(clip.z/clip.w*0.5+0.5,0.0,1.0);
  outColor=vec4(max(col,vec3(0.0)),1.0);
}`,go=mo+`
void main() {
  vec3 ro=uCamera,rd=rayDirection(vUv),col=vec3(0.0);
  float t=hitWater(ro,rd);
  if(ro.y < wave(ro.xz).x) {
    float floorT=rd.y < -0.001 ? max((-uDepth-ro.y)/rd.y,0.0) : 100.0;
    float dist=t>0.0 ? min(t,floorT) : floorT;
    vec3 n;float objectT=hitShapes(ro,rd,dist,n);
    col=volume(ro,rd,objectT>0.0?objectT:dist);
  } else if(t>0.0) {
    vec3 p=ro+rd*t,n=normalAt(p.xz);
    if(dot(n,-rd)<0.0)n=-n;
    vec3 ray=refract(rd,n,1.0/1.333);
    float dist=ray.y < -0.001 ? max((-uDepth-p.y)/ray.y,0.0) : 18.0;
    vec3 objectNormal;float objectT=hitShapes(p+ray*0.005,ray,dist,objectNormal);
    col=volume(p,ray,objectT>0.0?objectT:dist)*(1.0-fresnel(dot(n,-rd)));
    col*=1.0-smoothstep(10.0,15.0,max(abs(p.x),abs(p.z)));
  }
  outColor=vec4(col,1.0);
}`,yo=xt+fo+`
uniform vec3 uRayOrigin,uRayDirection;
uniform bool uPickObjects;
uniform float uDepth;
out vec4 outColor;
void pickScene(){
  vec3 ro=uRayOrigin,rd=uRayDirection;
  float t=hitWater(ro,rd);
  vec3 p=ro+rd*t;
  outColor=vec4(p,t>0.0 && max(abs(p.x),abs(p.z))<10.0 ? 1.0 : 0.0);
  if(!uPickObjects)return;
  vec3 n;float limit=t>0.0?t:100.0;
  bool submerged=ro.y<wave(ro.xz).x;
  if(submerged && rd.y< -0.001)limit=min(limit,(-uDepth-ro.y)/rd.y);
  float objectT=hitShapes(ro,rd,limit,n);
  if(objectT>0.0) {outColor=vec4(ro+rd*objectT,float(shapeHitIndex+2));return;}
  // Pick the visible submerged surface along the same refracted ray as VIEW.
  // Reflections intentionally remain water interactions, not duplicate handles.
  if(t>0.0) {
    n=normalAt(p.xz);if(dot(n,-rd)<0.0)n=-n;
    vec3 ray=refract(rd,n,submerged?1.333:1.0/1.333);
    if(length(ray)<0.001)return;
    vec3 origin=p+ray*0.005;
    float floorT=!submerged && ray.y< -0.001?max((-uDepth-p.y)/ray.y,0.0):100.0;
    objectT=hitShapes(origin,ray,floorT,n);
    if(objectT>0.0)outColor=vec4(origin+ray*objectT,float(shapeHitIndex+2));
  }
}
void main(){
  if(gl_FragCoord.x<1.0){pickScene();return;}
  vec3 ro=uRayOrigin,rd=uRayDirection;float t=hitWater(ro,rd);
  vec3 p=ro+rd*t,n=normalAt(p.xz);if(dot(n,-rd)<0.0)n=-n;
  outColor=gl_FragCoord.x<2.0?vec4(n,ro.y<wave(ro.xz).x?1.0:0.0):vec4(p,t);
}`,Pi=xt+`
uniform sampler2D uQueries;
out vec4 outColor;
void main() {
  vec2 point=texelFetch(uQueries,ivec2(gl_FragCoord.xy),0).xy;
  outColor=vec4(wave(point),1.0);
}`;var oi=class extends z{constructor(e,t,i=!1,o=!1,s=1e4){let r=new ve;super(r,t),this.isMarchingCubes=!0;let a=this,c=new Float32Array(36),l=new Float32Array(36),p=new Float32Array(36);this.enableUvs=i,this.enableColors=o,this.init=function(d){this.resolution=d,this.isolation=80,this.size=d,this.size2=this.size*this.size,this.size3=this.size2*this.size,this.halfsize=this.size/2,this.delta=2/this.size,this.yd=this.size,this.zd=this.size2,this.field=new Float32Array(this.size3),this.normal_cache=new Float32Array(this.size3*3),this.palette=new Float32Array(this.size3*3),this.count=0;let f=s*3;this.positionArray=new Float32Array(f*3);let m=new yt(this.positionArray,3);m.setUsage(gt),r.setAttribute("position",m),this.normalArray=new Float32Array(f*3);let g=new yt(this.normalArray,3);if(g.setUsage(gt),r.setAttribute("normal",g),this.enableUvs){this.uvArray=new Float32Array(f*2);let x=new yt(this.uvArray,2);x.setUsage(gt),r.setAttribute("uv",x)}if(this.enableColors){this.colorArray=new Float32Array(f*3);let x=new yt(this.colorArray,3);x.setUsage(gt),r.setAttribute("color",x)}r.boundingSphere=new Fi(new _,1)};function u(d,f,m){return d+(f-d)*m}function v(d,f,m,g,x,R,w,P,k,D){let M=(m-w)/(P-w),I=a.normal_cache;c[f+0]=g+M*a.delta,c[f+1]=x,c[f+2]=R,l[f+0]=u(I[d+0],I[d+3],M),l[f+1]=u(I[d+1],I[d+4],M),l[f+2]=u(I[d+2],I[d+5],M),p[f+0]=u(a.palette[k*3+0],a.palette[D*3+0],M),p[f+1]=u(a.palette[k*3+1],a.palette[D*3+1],M),p[f+2]=u(a.palette[k*3+2],a.palette[D*3+2],M)}function S(d,f,m,g,x,R,w,P,k,D){let M=(m-w)/(P-w),I=a.normal_cache;c[f+0]=g,c[f+1]=x+M*a.delta,c[f+2]=R;let H=d+a.yd*3;l[f+0]=u(I[d+0],I[H+0],M),l[f+1]=u(I[d+1],I[H+1],M),l[f+2]=u(I[d+2],I[H+2],M),p[f+0]=u(a.palette[k*3+0],a.palette[D*3+0],M),p[f+1]=u(a.palette[k*3+1],a.palette[D*3+1],M),p[f+2]=u(a.palette[k*3+2],a.palette[D*3+2],M)}function E(d,f,m,g,x,R,w,P,k,D){let M=(m-w)/(P-w),I=a.normal_cache;c[f+0]=g,c[f+1]=x,c[f+2]=R+M*a.delta;let H=d+a.zd*3;l[f+0]=u(I[d+0],I[H+0],M),l[f+1]=u(I[d+1],I[H+1],M),l[f+2]=u(I[d+2],I[H+2],M),p[f+0]=u(a.palette[k*3+0],a.palette[D*3+0],M),p[f+1]=u(a.palette[k*3+1],a.palette[D*3+1],M),p[f+2]=u(a.palette[k*3+2],a.palette[D*3+2],M)}function b(d){let f=d*3;a.normal_cache[f]===0&&(a.normal_cache[f+0]=a.field[d-1]-a.field[d+1],a.normal_cache[f+1]=a.field[d-a.yd]-a.field[d+a.yd],a.normal_cache[f+2]=a.field[d-a.zd]-a.field[d+a.zd])}function A(d,f,m,g,x){let R=g+1,w=g+a.yd,P=g+a.zd,k=R+a.yd,D=R+a.zd,M=g+a.yd+a.zd,I=R+a.yd+a.zd,H=0,q=a.field[g],N=a.field[R],X=a.field[w],B=a.field[k],j=a.field[P],J=a.field[D],Z=a.field[M],ee=a.field[I];q<x&&(H|=1),N<x&&(H|=2),X<x&&(H|=8),B<x&&(H|=4),j<x&&(H|=16),J<x&&(H|=32),Z<x&&(H|=128),ee<x&&(H|=64);let V=vs[H];if(V===0)return 0;let ce=a.delta,ze=d+ce,ae=f+ce,ie=m+ce;V&1&&(b(g),b(R),v(g*3,0,x,d,f,m,q,N,g,R)),V&2&&(b(R),b(k),S(R*3,3,x,ze,f,m,N,B,R,k)),V&4&&(b(w),b(k),v(w*3,6,x,d,ae,m,X,B,w,k)),V&8&&(b(g),b(w),S(g*3,9,x,d,f,m,q,X,g,w)),V&16&&(b(P),b(D),v(P*3,12,x,d,f,ie,j,J,P,D)),V&32&&(b(D),b(I),S(D*3,15,x,ze,f,ie,J,ee,D,I)),V&64&&(b(M),b(I),v(M*3,18,x,d,ae,ie,Z,ee,M,I)),V&128&&(b(P),b(M),S(P*3,21,x,d,f,ie,j,Z,P,M)),V&256&&(b(g),b(P),E(g*3,24,x,d,f,m,q,j,g,P)),V&512&&(b(R),b(D),E(R*3,27,x,ze,f,m,N,J,R,D)),V&1024&&(b(k),b(I),E(k*3,30,x,ze,ae,m,B,ee,k,I)),V&2048&&(b(w),b(M),E(w*3,33,x,d,ae,m,X,Z,w,M)),H<<=4;let oe,Ie,Se,Ce=0,xe=0;for(;ii[H+xe]!=-1;)oe=H+xe,Ie=oe+1,Se=oe+2,L(c,l,p,3*ii[oe],3*ii[Ie],3*ii[Se]),xe+=3,Ce++;return Ce}function L(d,f,m,g,x,R){let w=a.count*3;if(a.positionArray[w+0]=d[g],a.positionArray[w+1]=d[g+1],a.positionArray[w+2]=d[g+2],a.positionArray[w+3]=d[x],a.positionArray[w+4]=d[x+1],a.positionArray[w+5]=d[x+2],a.positionArray[w+6]=d[R],a.positionArray[w+7]=d[R+1],a.positionArray[w+8]=d[R+2],a.material.flatShading===!0){let P=(f[g+0]+f[x+0]+f[R+0])/3,k=(f[g+1]+f[x+1]+f[R+1])/3,D=(f[g+2]+f[x+2]+f[R+2])/3;a.normalArray[w+0]=P,a.normalArray[w+1]=k,a.normalArray[w+2]=D,a.normalArray[w+3]=P,a.normalArray[w+4]=k,a.normalArray[w+5]=D,a.normalArray[w+6]=P,a.normalArray[w+7]=k,a.normalArray[w+8]=D}else a.normalArray[w+0]=f[g+0],a.normalArray[w+1]=f[g+1],a.normalArray[w+2]=f[g+2],a.normalArray[w+3]=f[x+0],a.normalArray[w+4]=f[x+1],a.normalArray[w+5]=f[x+2],a.normalArray[w+6]=f[R+0],a.normalArray[w+7]=f[R+1],a.normalArray[w+8]=f[R+2];if(a.enableUvs){let P=a.count*2;a.uvArray[P+0]=d[g+0],a.uvArray[P+1]=d[g+2],a.uvArray[P+2]=d[x+0],a.uvArray[P+3]=d[x+2],a.uvArray[P+4]=d[R+0],a.uvArray[P+5]=d[R+2]}a.enableColors&&(a.colorArray[w+0]=m[g+0],a.colorArray[w+1]=m[g+1],a.colorArray[w+2]=m[g+2],a.colorArray[w+3]=m[x+0],a.colorArray[w+4]=m[x+1],a.colorArray[w+5]=m[x+2],a.colorArray[w+6]=m[R+0],a.colorArray[w+7]=m[R+1],a.colorArray[w+8]=m[R+2]),a.count+=3}this.addBall=function(d,f,m,g,x,R){let w=Math.sign(g);g=Math.abs(g);let P=R!=null,k=new ue(d,f,m);if(P)try{k=R instanceof ue?R:Array.isArray(R)?new ue(Math.min(Math.abs(R[0]),1),Math.min(Math.abs(R[1]),1),Math.min(Math.abs(R[2]),1)):new ue(R)}catch{k=new ue(d,f,m)}let D=this.size*Math.sqrt(g/x),M=m*this.size,I=f*this.size,H=d*this.size,q=Math.floor(M-D);q<1&&(q=1);let N=Math.floor(M+D);N>this.size-1&&(N=this.size-1);let X=Math.floor(I-D);X<1&&(X=1);let B=Math.floor(I+D);B>this.size-1&&(B=this.size-1);let j=Math.floor(H-D);j<1&&(j=1);let J=Math.floor(H+D);J>this.size-1&&(J=this.size-1);let Z,ee,V,ce,ze,ae,ie,oe,Ie,Se,Ce;for(V=q;V<N;V++)for(ze=this.size2*V,oe=V/this.size-m,Ie=oe*oe,ee=X;ee<B;ee++)for(ce=ze+this.size*ee,ie=ee/this.size-f,Se=ie*ie,Z=j;Z<J;Z++)if(ae=Z/this.size-d,Ce=g/(1e-6+ae*ae+Se+Ie)-x,Ce>0){this.field[ce+Z]+=Ce*w;let xe=Math.sqrt((Z-H)*(Z-H)+(ee-I)*(ee-I)+(V-M)*(V-M))/D,Ye=1-xe*xe*xe*(xe*(xe*6-15)+10);this.palette[(ce+Z)*3+0]+=k.r*Ye,this.palette[(ce+Z)*3+1]+=k.g*Ye,this.palette[(ce+Z)*3+2]+=k.b*Ye}},this.addPlaneX=function(d,f){let m=this.size,g=this.yd,x=this.zd,R=this.field,w,P,k,D,M,I,H,q=m*Math.sqrt(d/f);for(q>m&&(q=m),w=0;w<q;w++)if(I=w/m,D=I*I,M=d/(1e-4+D)-f,M>0)for(P=0;P<m;P++)for(H=w+P*g,k=0;k<m;k++)R[x*k+H]+=M},this.addPlaneY=function(d,f){let m=this.size,g=this.yd,x=this.zd,R=this.field,w,P,k,D,M,I,H,q,N=m*Math.sqrt(d/f);for(N>m&&(N=m),P=0;P<N;P++)if(I=P/m,D=I*I,M=d/(1e-4+D)-f,M>0)for(H=P*g,w=0;w<m;w++)for(q=H+w,k=0;k<m;k++)R[x*k+q]+=M},this.addPlaneZ=function(d,f){let m=this.size,g=this.yd,x=this.zd,R=this.field,w,P,k,D,M,I,H,q,N=m*Math.sqrt(d/f);for(N>m&&(N=m),k=0;k<N;k++)if(I=k/m,D=I*I,M=d/(1e-4+D)-f,M>0)for(H=x*k,P=0;P<m;P++)for(q=H+P*g,w=0;w<m;w++)R[q+w]+=M},this.setCell=function(d,f,m,g){let x=this.size2*m+this.size*f+d;this.field[x]=g},this.getCell=function(d,f,m){let g=this.size2*m+this.size*f+d;return this.field[g]},this.blur=function(d=1){let f=this.field,m=f.slice(),g=this.size,x=this.size2;for(let R=0;R<g;R++)for(let w=0;w<g;w++)for(let P=0;P<g;P++){let k=x*P+g*w+R,D=m[k],M=1;for(let I=-1;I<=1;I+=2){let H=I+R;if(!(H<0||H>=g))for(let q=-1;q<=1;q+=2){let N=q+w;if(!(N<0||N>=g))for(let X=-1;X<=1;X+=2){let B=X+P;if(B<0||B>=g)continue;let j=x*B+g*N+H,J=m[j];M++,D+=d*(J-D)/M}}}f[k]=D}},this.reset=function(){for(let d=0;d<this.size3;d++)this.normal_cache[d*3]=0,this.field[d]=0,this.palette[d*3]=this.palette[d*3+1]=this.palette[d*3+2]=0},this.update=function(){this.count=0;let d=this.size-2;for(let f=1;f<d;f++){let m=this.size2*f,g=(f-this.halfsize)/this.halfsize;for(let x=1;x<d;x++){let R=m+this.size*x,w=(x-this.halfsize)/this.halfsize;for(let P=1;P<d;P++){let k=(P-this.halfsize)/this.halfsize,D=R+P;A(k,w,g,D,this.isolation)}}}this.geometry.setDrawRange(0,this.count),r.getAttribute("position").needsUpdate=!0,r.getAttribute("normal").needsUpdate=!0,this.enableUvs&&(r.getAttribute("uv").needsUpdate=!0),this.enableColors&&(r.getAttribute("color").needsUpdate=!0),this.count/3>s&&console.warn("THREE.MarchingCubes: Geometry buffers too small for rendering. Please create an instance with a higher poly count.")},this.init(e)}},vs=new Int32Array([0,265,515,778,1030,1295,1541,1804,2060,2309,2575,2822,3082,3331,3593,3840,400,153,915,666,1430,1183,1941,1692,2460,2197,2975,2710,3482,3219,3993,3728,560,825,51,314,1590,1855,1077,1340,2620,2869,2111,2358,3642,3891,3129,3376,928,681,419,170,1958,1711,1445,1196,2988,2725,2479,2214,4010,3747,3497,3232,1120,1385,1635,1898,102,367,613,876,3180,3429,3695,3942,2154,2403,2665,2912,1520,1273,2035,1786,502,255,1013,764,3580,3317,4095,3830,2554,2291,3065,2800,1616,1881,1107,1370,598,863,85,348,3676,3925,3167,3414,2650,2899,2137,2384,1984,1737,1475,1226,966,719,453,204,4044,3781,3535,3270,3018,2755,2505,2240,2240,2505,2755,3018,3270,3535,3781,4044,204,453,719,966,1226,1475,1737,1984,2384,2137,2899,2650,3414,3167,3925,3676,348,85,863,598,1370,1107,1881,1616,2800,3065,2291,2554,3830,4095,3317,3580,764,1013,255,502,1786,2035,1273,1520,2912,2665,2403,2154,3942,3695,3429,3180,876,613,367,102,1898,1635,1385,1120,3232,3497,3747,4010,2214,2479,2725,2988,1196,1445,1711,1958,170,419,681,928,3376,3129,3891,3642,2358,2111,2869,2620,1340,1077,1855,1590,314,51,825,560,3728,3993,3219,3482,2710,2975,2197,2460,1692,1941,1183,1430,666,915,153,400,3840,3593,3331,3082,2822,2575,2309,2060,1804,1541,1295,1030,778,515,265,0]),ii=new Int32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,8,3,9,8,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,2,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,1,2,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,2,10,0,2,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,8,3,2,10,8,10,9,8,-1,-1,-1,-1,-1,-1,-1,3,11,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,11,2,8,11,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,9,0,2,3,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,11,2,1,9,11,9,8,11,-1,-1,-1,-1,-1,-1,-1,3,10,1,11,10,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,10,1,0,8,10,8,11,10,-1,-1,-1,-1,-1,-1,-1,3,9,0,3,11,9,11,10,9,-1,-1,-1,-1,-1,-1,-1,9,8,10,10,8,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,7,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,3,0,7,3,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,9,8,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,1,9,4,7,1,7,3,1,-1,-1,-1,-1,-1,-1,-1,1,2,10,8,4,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,4,7,3,0,4,1,2,10,-1,-1,-1,-1,-1,-1,-1,9,2,10,9,0,2,8,4,7,-1,-1,-1,-1,-1,-1,-1,2,10,9,2,9,7,2,7,3,7,9,4,-1,-1,-1,-1,8,4,7,3,11,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,4,7,11,2,4,2,0,4,-1,-1,-1,-1,-1,-1,-1,9,0,1,8,4,7,2,3,11,-1,-1,-1,-1,-1,-1,-1,4,7,11,9,4,11,9,11,2,9,2,1,-1,-1,-1,-1,3,10,1,3,11,10,7,8,4,-1,-1,-1,-1,-1,-1,-1,1,11,10,1,4,11,1,0,4,7,11,4,-1,-1,-1,-1,4,7,8,9,0,11,9,11,10,11,0,3,-1,-1,-1,-1,4,7,11,4,11,9,9,11,10,-1,-1,-1,-1,-1,-1,-1,9,5,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,5,4,0,8,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,5,4,1,5,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,5,4,8,3,5,3,1,5,-1,-1,-1,-1,-1,-1,-1,1,2,10,9,5,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,0,8,1,2,10,4,9,5,-1,-1,-1,-1,-1,-1,-1,5,2,10,5,4,2,4,0,2,-1,-1,-1,-1,-1,-1,-1,2,10,5,3,2,5,3,5,4,3,4,8,-1,-1,-1,-1,9,5,4,2,3,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,11,2,0,8,11,4,9,5,-1,-1,-1,-1,-1,-1,-1,0,5,4,0,1,5,2,3,11,-1,-1,-1,-1,-1,-1,-1,2,1,5,2,5,8,2,8,11,4,8,5,-1,-1,-1,-1,10,3,11,10,1,3,9,5,4,-1,-1,-1,-1,-1,-1,-1,4,9,5,0,8,1,8,10,1,8,11,10,-1,-1,-1,-1,5,4,0,5,0,11,5,11,10,11,0,3,-1,-1,-1,-1,5,4,8,5,8,10,10,8,11,-1,-1,-1,-1,-1,-1,-1,9,7,8,5,7,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,3,0,9,5,3,5,7,3,-1,-1,-1,-1,-1,-1,-1,0,7,8,0,1,7,1,5,7,-1,-1,-1,-1,-1,-1,-1,1,5,3,3,5,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,7,8,9,5,7,10,1,2,-1,-1,-1,-1,-1,-1,-1,10,1,2,9,5,0,5,3,0,5,7,3,-1,-1,-1,-1,8,0,2,8,2,5,8,5,7,10,5,2,-1,-1,-1,-1,2,10,5,2,5,3,3,5,7,-1,-1,-1,-1,-1,-1,-1,7,9,5,7,8,9,3,11,2,-1,-1,-1,-1,-1,-1,-1,9,5,7,9,7,2,9,2,0,2,7,11,-1,-1,-1,-1,2,3,11,0,1,8,1,7,8,1,5,7,-1,-1,-1,-1,11,2,1,11,1,7,7,1,5,-1,-1,-1,-1,-1,-1,-1,9,5,8,8,5,7,10,1,3,10,3,11,-1,-1,-1,-1,5,7,0,5,0,9,7,11,0,1,0,10,11,10,0,-1,11,10,0,11,0,3,10,5,0,8,0,7,5,7,0,-1,11,10,5,7,11,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,6,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,5,10,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,0,1,5,10,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,8,3,1,9,8,5,10,6,-1,-1,-1,-1,-1,-1,-1,1,6,5,2,6,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,6,5,1,2,6,3,0,8,-1,-1,-1,-1,-1,-1,-1,9,6,5,9,0,6,0,2,6,-1,-1,-1,-1,-1,-1,-1,5,9,8,5,8,2,5,2,6,3,2,8,-1,-1,-1,-1,2,3,11,10,6,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,0,8,11,2,0,10,6,5,-1,-1,-1,-1,-1,-1,-1,0,1,9,2,3,11,5,10,6,-1,-1,-1,-1,-1,-1,-1,5,10,6,1,9,2,9,11,2,9,8,11,-1,-1,-1,-1,6,3,11,6,5,3,5,1,3,-1,-1,-1,-1,-1,-1,-1,0,8,11,0,11,5,0,5,1,5,11,6,-1,-1,-1,-1,3,11,6,0,3,6,0,6,5,0,5,9,-1,-1,-1,-1,6,5,9,6,9,11,11,9,8,-1,-1,-1,-1,-1,-1,-1,5,10,6,4,7,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,3,0,4,7,3,6,5,10,-1,-1,-1,-1,-1,-1,-1,1,9,0,5,10,6,8,4,7,-1,-1,-1,-1,-1,-1,-1,10,6,5,1,9,7,1,7,3,7,9,4,-1,-1,-1,-1,6,1,2,6,5,1,4,7,8,-1,-1,-1,-1,-1,-1,-1,1,2,5,5,2,6,3,0,4,3,4,7,-1,-1,-1,-1,8,4,7,9,0,5,0,6,5,0,2,6,-1,-1,-1,-1,7,3,9,7,9,4,3,2,9,5,9,6,2,6,9,-1,3,11,2,7,8,4,10,6,5,-1,-1,-1,-1,-1,-1,-1,5,10,6,4,7,2,4,2,0,2,7,11,-1,-1,-1,-1,0,1,9,4,7,8,2,3,11,5,10,6,-1,-1,-1,-1,9,2,1,9,11,2,9,4,11,7,11,4,5,10,6,-1,8,4,7,3,11,5,3,5,1,5,11,6,-1,-1,-1,-1,5,1,11,5,11,6,1,0,11,7,11,4,0,4,11,-1,0,5,9,0,6,5,0,3,6,11,6,3,8,4,7,-1,6,5,9,6,9,11,4,7,9,7,11,9,-1,-1,-1,-1,10,4,9,6,4,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,10,6,4,9,10,0,8,3,-1,-1,-1,-1,-1,-1,-1,10,0,1,10,6,0,6,4,0,-1,-1,-1,-1,-1,-1,-1,8,3,1,8,1,6,8,6,4,6,1,10,-1,-1,-1,-1,1,4,9,1,2,4,2,6,4,-1,-1,-1,-1,-1,-1,-1,3,0,8,1,2,9,2,4,9,2,6,4,-1,-1,-1,-1,0,2,4,4,2,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,3,2,8,2,4,4,2,6,-1,-1,-1,-1,-1,-1,-1,10,4,9,10,6,4,11,2,3,-1,-1,-1,-1,-1,-1,-1,0,8,2,2,8,11,4,9,10,4,10,6,-1,-1,-1,-1,3,11,2,0,1,6,0,6,4,6,1,10,-1,-1,-1,-1,6,4,1,6,1,10,4,8,1,2,1,11,8,11,1,-1,9,6,4,9,3,6,9,1,3,11,6,3,-1,-1,-1,-1,8,11,1,8,1,0,11,6,1,9,1,4,6,4,1,-1,3,11,6,3,6,0,0,6,4,-1,-1,-1,-1,-1,-1,-1,6,4,8,11,6,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,10,6,7,8,10,8,9,10,-1,-1,-1,-1,-1,-1,-1,0,7,3,0,10,7,0,9,10,6,7,10,-1,-1,-1,-1,10,6,7,1,10,7,1,7,8,1,8,0,-1,-1,-1,-1,10,6,7,10,7,1,1,7,3,-1,-1,-1,-1,-1,-1,-1,1,2,6,1,6,8,1,8,9,8,6,7,-1,-1,-1,-1,2,6,9,2,9,1,6,7,9,0,9,3,7,3,9,-1,7,8,0,7,0,6,6,0,2,-1,-1,-1,-1,-1,-1,-1,7,3,2,6,7,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,11,10,6,8,10,8,9,8,6,7,-1,-1,-1,-1,2,0,7,2,7,11,0,9,7,6,7,10,9,10,7,-1,1,8,0,1,7,8,1,10,7,6,7,10,2,3,11,-1,11,2,1,11,1,7,10,6,1,6,7,1,-1,-1,-1,-1,8,9,6,8,6,7,9,1,6,11,6,3,1,3,6,-1,0,9,1,11,6,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,8,0,7,0,6,3,11,0,11,6,0,-1,-1,-1,-1,7,11,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,0,8,11,7,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,1,9,11,7,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,1,9,8,3,1,11,7,6,-1,-1,-1,-1,-1,-1,-1,10,1,2,6,11,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,2,10,3,0,8,6,11,7,-1,-1,-1,-1,-1,-1,-1,2,9,0,2,10,9,6,11,7,-1,-1,-1,-1,-1,-1,-1,6,11,7,2,10,3,10,8,3,10,9,8,-1,-1,-1,-1,7,2,3,6,2,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,7,0,8,7,6,0,6,2,0,-1,-1,-1,-1,-1,-1,-1,2,7,6,2,3,7,0,1,9,-1,-1,-1,-1,-1,-1,-1,1,6,2,1,8,6,1,9,8,8,7,6,-1,-1,-1,-1,10,7,6,10,1,7,1,3,7,-1,-1,-1,-1,-1,-1,-1,10,7,6,1,7,10,1,8,7,1,0,8,-1,-1,-1,-1,0,3,7,0,7,10,0,10,9,6,10,7,-1,-1,-1,-1,7,6,10,7,10,8,8,10,9,-1,-1,-1,-1,-1,-1,-1,6,8,4,11,8,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,6,11,3,0,6,0,4,6,-1,-1,-1,-1,-1,-1,-1,8,6,11,8,4,6,9,0,1,-1,-1,-1,-1,-1,-1,-1,9,4,6,9,6,3,9,3,1,11,3,6,-1,-1,-1,-1,6,8,4,6,11,8,2,10,1,-1,-1,-1,-1,-1,-1,-1,1,2,10,3,0,11,0,6,11,0,4,6,-1,-1,-1,-1,4,11,8,4,6,11,0,2,9,2,10,9,-1,-1,-1,-1,10,9,3,10,3,2,9,4,3,11,3,6,4,6,3,-1,8,2,3,8,4,2,4,6,2,-1,-1,-1,-1,-1,-1,-1,0,4,2,4,6,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,9,0,2,3,4,2,4,6,4,3,8,-1,-1,-1,-1,1,9,4,1,4,2,2,4,6,-1,-1,-1,-1,-1,-1,-1,8,1,3,8,6,1,8,4,6,6,10,1,-1,-1,-1,-1,10,1,0,10,0,6,6,0,4,-1,-1,-1,-1,-1,-1,-1,4,6,3,4,3,8,6,10,3,0,3,9,10,9,3,-1,10,9,4,6,10,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,9,5,7,6,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,3,4,9,5,11,7,6,-1,-1,-1,-1,-1,-1,-1,5,0,1,5,4,0,7,6,11,-1,-1,-1,-1,-1,-1,-1,11,7,6,8,3,4,3,5,4,3,1,5,-1,-1,-1,-1,9,5,4,10,1,2,7,6,11,-1,-1,-1,-1,-1,-1,-1,6,11,7,1,2,10,0,8,3,4,9,5,-1,-1,-1,-1,7,6,11,5,4,10,4,2,10,4,0,2,-1,-1,-1,-1,3,4,8,3,5,4,3,2,5,10,5,2,11,7,6,-1,7,2,3,7,6,2,5,4,9,-1,-1,-1,-1,-1,-1,-1,9,5,4,0,8,6,0,6,2,6,8,7,-1,-1,-1,-1,3,6,2,3,7,6,1,5,0,5,4,0,-1,-1,-1,-1,6,2,8,6,8,7,2,1,8,4,8,5,1,5,8,-1,9,5,4,10,1,6,1,7,6,1,3,7,-1,-1,-1,-1,1,6,10,1,7,6,1,0,7,8,7,0,9,5,4,-1,4,0,10,4,10,5,0,3,10,6,10,7,3,7,10,-1,7,6,10,7,10,8,5,4,10,4,8,10,-1,-1,-1,-1,6,9,5,6,11,9,11,8,9,-1,-1,-1,-1,-1,-1,-1,3,6,11,0,6,3,0,5,6,0,9,5,-1,-1,-1,-1,0,11,8,0,5,11,0,1,5,5,6,11,-1,-1,-1,-1,6,11,3,6,3,5,5,3,1,-1,-1,-1,-1,-1,-1,-1,1,2,10,9,5,11,9,11,8,11,5,6,-1,-1,-1,-1,0,11,3,0,6,11,0,9,6,5,6,9,1,2,10,-1,11,8,5,11,5,6,8,0,5,10,5,2,0,2,5,-1,6,11,3,6,3,5,2,10,3,10,5,3,-1,-1,-1,-1,5,8,9,5,2,8,5,6,2,3,8,2,-1,-1,-1,-1,9,5,6,9,6,0,0,6,2,-1,-1,-1,-1,-1,-1,-1,1,5,8,1,8,0,5,6,8,3,8,2,6,2,8,-1,1,5,6,2,1,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,3,6,1,6,10,3,8,6,5,6,9,8,9,6,-1,10,1,0,10,0,6,9,5,0,5,6,0,-1,-1,-1,-1,0,3,8,5,6,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,10,5,6,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,5,10,7,5,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,11,5,10,11,7,5,8,3,0,-1,-1,-1,-1,-1,-1,-1,5,11,7,5,10,11,1,9,0,-1,-1,-1,-1,-1,-1,-1,10,7,5,10,11,7,9,8,1,8,3,1,-1,-1,-1,-1,11,1,2,11,7,1,7,5,1,-1,-1,-1,-1,-1,-1,-1,0,8,3,1,2,7,1,7,5,7,2,11,-1,-1,-1,-1,9,7,5,9,2,7,9,0,2,2,11,7,-1,-1,-1,-1,7,5,2,7,2,11,5,9,2,3,2,8,9,8,2,-1,2,5,10,2,3,5,3,7,5,-1,-1,-1,-1,-1,-1,-1,8,2,0,8,5,2,8,7,5,10,2,5,-1,-1,-1,-1,9,0,1,5,10,3,5,3,7,3,10,2,-1,-1,-1,-1,9,8,2,9,2,1,8,7,2,10,2,5,7,5,2,-1,1,3,5,3,7,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,8,7,0,7,1,1,7,5,-1,-1,-1,-1,-1,-1,-1,9,0,3,9,3,5,5,3,7,-1,-1,-1,-1,-1,-1,-1,9,8,7,5,9,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,5,8,4,5,10,8,10,11,8,-1,-1,-1,-1,-1,-1,-1,5,0,4,5,11,0,5,10,11,11,3,0,-1,-1,-1,-1,0,1,9,8,4,10,8,10,11,10,4,5,-1,-1,-1,-1,10,11,4,10,4,5,11,3,4,9,4,1,3,1,4,-1,2,5,1,2,8,5,2,11,8,4,5,8,-1,-1,-1,-1,0,4,11,0,11,3,4,5,11,2,11,1,5,1,11,-1,0,2,5,0,5,9,2,11,5,4,5,8,11,8,5,-1,9,4,5,2,11,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,5,10,3,5,2,3,4,5,3,8,4,-1,-1,-1,-1,5,10,2,5,2,4,4,2,0,-1,-1,-1,-1,-1,-1,-1,3,10,2,3,5,10,3,8,5,4,5,8,0,1,9,-1,5,10,2,5,2,4,1,9,2,9,4,2,-1,-1,-1,-1,8,4,5,8,5,3,3,5,1,-1,-1,-1,-1,-1,-1,-1,0,4,5,1,0,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,4,5,8,5,3,9,0,5,0,3,5,-1,-1,-1,-1,9,4,5,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,11,7,4,9,11,9,10,11,-1,-1,-1,-1,-1,-1,-1,0,8,3,4,9,7,9,11,7,9,10,11,-1,-1,-1,-1,1,10,11,1,11,4,1,4,0,7,4,11,-1,-1,-1,-1,3,1,4,3,4,8,1,10,4,7,4,11,10,11,4,-1,4,11,7,9,11,4,9,2,11,9,1,2,-1,-1,-1,-1,9,7,4,9,11,7,9,1,11,2,11,1,0,8,3,-1,11,7,4,11,4,2,2,4,0,-1,-1,-1,-1,-1,-1,-1,11,7,4,11,4,2,8,3,4,3,2,4,-1,-1,-1,-1,2,9,10,2,7,9,2,3,7,7,4,9,-1,-1,-1,-1,9,10,7,9,7,4,10,2,7,8,7,0,2,0,7,-1,3,7,10,3,10,2,7,4,10,1,10,0,4,0,10,-1,1,10,2,8,7,4,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,9,1,4,1,7,7,1,3,-1,-1,-1,-1,-1,-1,-1,4,9,1,4,1,7,0,8,1,8,7,1,-1,-1,-1,-1,4,0,3,7,4,3,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,8,7,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,10,8,10,11,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,0,9,3,9,11,11,9,10,-1,-1,-1,-1,-1,-1,-1,0,1,10,0,10,8,8,10,11,-1,-1,-1,-1,-1,-1,-1,3,1,10,11,3,10,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,2,11,1,11,9,9,11,8,-1,-1,-1,-1,-1,-1,-1,3,0,9,3,9,11,1,2,9,2,11,9,-1,-1,-1,-1,0,2,11,8,0,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,3,2,11,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,8,2,8,10,10,8,9,-1,-1,-1,-1,-1,-1,-1,9,10,2,0,9,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,2,3,8,2,8,10,0,1,8,1,10,8,-1,-1,-1,-1,1,10,2,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,3,8,9,1,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,9,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,3,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]);var si=1/90,tt=.095,it=tt*2.1,bs=n=>Math.max(480,1200-n.reduce((e,t)=>e+(t.cost??1),0)*45),We=it,ke=We*We,Oe=(n,e,t)=>Math.max(e,Math.min(t,n)),vo=n=>n<ke?(1-n/ke)**3:0,ri=0;for(let n=-2;n<=2;n++)for(let e=-2;e<=2;e++)for(let t=-2;t<=2;t++)ri+=vo((n*n+e*e+t*t)*tt**2);var ai=(n,e,t)=>(n+1024)*4194304+(e+1024)*2048+t+1024,me=new _;function ws(n){if(n.kind==="sphere")return{radius:n.size*.5,inside:(a,c)=>Math.hypot(a,c)<n.size*.5+.025};let e=n.geometry.vertices.map(a=>a.clone().multiplyScalar(n.size).applyQuaternion(n.rotation)).sort((a,c)=>a.x-c.x||a.z-c.z),t=(a,c,l)=>(c.x-a.x)*(l.z-a.z)-(c.z-a.z)*(l.x-a.x),i=a=>{let c=[];for(let l of a){for(;c.length>=2&&t(c.at(-2),c.at(-1),l)<=0;)c.pop();c.push(l)}return c},o=i(e),s=i([...e].reverse()),r=[...o.slice(0,-1),...s.slice(0,-1)];return{radius:Math.max(...e.map(a=>Math.hypot(a.x,a.z))),inside:(a,c)=>r.every((l,p)=>{let u=r[(p+1)%r.length];return(u.x-l.x)*(c-l.z)-(u.z-l.z)*(a-l.x)>=-.025*Math.hypot(u.x-l.x,u.z-l.z)})}}function Es(n,e){if(me.set(n.x,n.y,n.z).sub(e.position),me.lengthSq()>(e.radius+tt)**2)return!1;me.applyQuaternion(e.rotation.clone().conjugate());let t=tt*.28;if(e.kind==="sphere"){let i=e.size*.5+t,o=me.length();if(o>=i)return!1;o<1e-6?me.set(0,i,0):me.multiplyScalar(i/o)}else{let i=1/0,o=null;for(let s of e.geometry.normals){let r=-1/0;for(let c of e.geometry.vertices)r=Math.max(r,c.dot(s)*e.size);let a=r+t-me.dot(s);if(a<=0)return!1;if(a<i&&(i=a,o=s),e.geometry.normals.length===3){let c=r+t+me.dot(s);if(c<=0)return!1;c<i&&(i=c,o=s.clone().negate())}}if(!o)return!1;me.addScaledVector(o,i)}return me.applyQuaternion(e.rotation).add(e.position),n.x=me.x,n.y=me.y,n.z=me.z,!0}var ni=class{particles=[];generation=0;nextId=1;time=0;accumulator=0;revision=0;budget=1200;seen=new WeakSet;rippleGeneration=-1;returned=0;returnPool=[];lastReturn=0;lastQueryTime=-1/0;clear(){this.particles=[],this.returnPool=[],this.accumulator=0,this.lastQueryTime=-1/0,this.generation++,this.revision++}sync(e,t,i,o){this.rippleGeneration!==e.generation&&(this.clear(),this.rippleGeneration=e.generation),this.budget=bs(i);for(let s of e.active(t))this.seen.has(s)||(this.seen.add(s),o&&s.spray>0&&t-s.time<.15&&t>=s.time&&this.emit(s,s.bodyId===void 0?null:i.find(r=>r.id===s.bodyId)))}emit(e,t=null){let i=this.budget-this.particles.length;if(i<24)return 0;let o=t?ws(t):null,s=o?Math.min(3,o.radius+.22):Oe(e.radius,.15,.9),r=Oe(Math.sqrt(e.strength/.28),.35,1.7),a=Oe(e.spray??1,.1,1),c=Math.min(i,Math.round((140+s*260)*a)),l=[],p=tt;for(let u=0;u<3;u++)for(let v=-Math.ceil(s/p);v<=Math.ceil(s/p);v++)for(let S=-Math.ceil(s/p);S<=Math.ceil(s/p);S++){let E=v*p,b=S*p,A=Math.hypot(E,b);if(A>s||A<s*.35||o?.inside(E,b))continue;let L=Math.atan2(b,E),d=1+.18*Math.sin(L*5+e.x)+.12*Math.cos(L*3-e.z);l.push({id:this.nextId++,x:e.x+E,y:(e.y??0)+(u+.2)*p,z:e.z+b,vx:E/Math.max(A,.01)*r*.85,vy:(.3+4.2*(A/s)**2)*r*d*Math.sqrt(a),vz:b/Math.max(A,.01)*r*.85,age:0,water:e.y??0,sx:0,sz:0,waterX:e.x+E,waterZ:e.z+b,lambda:0,density:0,neighbors:[]})}return l.sort((u,v)=>Math.hypot(u.x-e.x,u.z-e.z)-Math.hypot(v.x-e.x,v.z-e.z)),this.particles.push(...l.slice(0,c)),this.revision++,Math.min(c,l.length)}step(e,t=[],i=3,o=()=>{}){if(!(e<=0))for(this.accumulator+=Math.min(e,.1);this.accumulator+1e-10>=si;)this.advance(si,t,i,o),this.accumulator-=si,this.time+=si}advance(e,t,i,o){let s=this.particles;if(!s.length)return;let r=new Map;for(let l of s){l.ox=l.x,l.oy=l.y,l.oz=l.z,l.vy-=9.81*e,l.x+=l.vx*e,l.y+=l.vy*e,l.z+=l.vz*e,l.age+=e;let p=ai(Math.floor(l.x/We),Math.floor(l.y/We),Math.floor(l.z/We));r.has(p)||r.set(p,[]),r.get(p).push(l)}for(let l of s){l.neighbors.length=0;let p=Math.floor(l.x/We),u=Math.floor(l.y/We),v=Math.floor(l.z/We);for(let S=-1;S<=1;S++)for(let E=-1;E<=1;E++)for(let b=-1;b<=1;b++){let A=r.get(ai(p+S,u+E,v+b));if(A)for(let L of A)L!==l&&(l.x-L.x)**2+(l.y-L.y)**2+(l.z-L.z)**2<ke&&l.neighbors.length<64&&l.neighbors.push(L)}}for(let l=0;l<3;l++){for(let p of s){let u=1,v=0,S=0,E=0,b=0;for(let A of p.neighbors){let L=p.x-A.x,d=p.y-A.y,f=p.z-A.z,m=L*L+d*d+f*f;if(m>=ke)continue;u+=vo(m);let g=-6/ke*(1-m/ke)**2/ri;v+=g*L,S+=g*d,E+=g*f,b+=g*g*m}p.density=u/ri,p.lambda=-Math.max(0,p.density-1)/(b+v*v+S*S+E*E+.001)}for(let p of s){let u=0,v=0,S=0;for(let b of p.neighbors){let A=p.x-b.x,L=p.y-b.y,d=p.z-b.z,f=A*A+L*L+d*d;if(f>=ke||f<1e-10)continue;let m=-6/ke*(1-f/ke)**2/ri,g=f>tt**2?35e-6*(1-f/ke):0,x=(p.lambda+b.lambda)*m-g/Math.sqrt(f);u+=x*A,v+=x*L,S+=x*d}let E=Math.min(1,tt*.25/Math.max(1e-9,Math.hypot(u,v,S)));p.dx=u*E,p.dy=v*E,p.dz=S*E}for(let p of s)p.x+=p.dx,p.y+=p.dy,p.z+=p.dz}let a=new Map,c=[];for(let l of s){for(let u of t)Es(l,u);l.x=Oe(l.x,-9.95,9.95),l.z=Oe(l.z,-9.95,9.95),l.y=Math.max(-i+.03,l.y),l.vx=Oe((l.x-l.ox)/e,-9,9)*.997,l.vy=Oe((l.y-l.oy)/e,-12,12)*.997,l.vz=Oe((l.z-l.oz)/e,-9,9)*.997;let p=l.water+Oe((l.x-l.waterX)*l.sx+(l.z-l.waterZ)*l.sz,-.25,.25);if(l.age>.12&&l.vy<0&&l.y<p+.025){let u=ai(Math.floor(l.x/.7),0,Math.floor(l.z/.7)),v=a.get(u)??{x:0,z:0,y:0,energy:0,count:0};v.x+=l.x,v.z+=l.z,v.y+=p,v.energy+=Math.min(8,-l.vy),v.count++,a.set(u,v),this.returned++}else l.age<3.5&&c.push(l)}if(this.returnPool.push(...a.values()),(this.time-this.lastReturn>=.14||!c.length)&&this.returnPool.length){let l=new Map;for(let p of this.returnPool){let u=ai(Math.floor(p.x/p.count/1.5),0,Math.floor(p.z/p.count/1.5)),v=l.get(u)??{x:0,y:0,z:0,energy:0,count:0};for(let S of["x","y","z","energy","count"])v[S]+=p[S];l.set(u,v)}for(let p of[...l.values()].sort((u,v)=>v.energy-u.energy).slice(0,4))o({x:p.x/p.count,z:p.z/p.count,y:p.y/p.count,radius:.3+Math.sqrt(p.count)*.025,strength:Math.min(.13,p.energy*8e-4)});this.lastReturn=this.time,this.returnPool=[]}this.particles=c,this.revision++}query(){return{generation:this.generation,time:this.time,ids:this.particles.map(e=>e.id),points:this.particles.flatMap(e=>[e.x,e.z])}}ingest(e,t){if(e.generation!==this.generation||this.time-e.time>.25||e.time<this.lastQueryTime)return!1;this.lastQueryTime=e.time;let i=new Map(this.particles.map(o=>[o.id,o]));for(let o=0;o<e.ids.length;o++){let s=i.get(e.ids[o]);!s||!Number.isFinite(t[o*4])||(s.water=t[o*4],s.sx=t[o*4+1],s.sz=t[o*4+2],s.waterX=e.points[o*2],s.waterZ=e.points[o*2+1])}return!0}};var bo=`
precision highp float;
in vec3 position,normal;
uniform mat4 modelMatrix,viewMatrix,projectionMatrix;
out vec3 vWorld,vNormal;
void main(){
  vec4 p=vec4(position,1.0);vec3 n=normal;
  #ifdef USE_INSTANCING
    p=instanceMatrix*p;n=mat3(instanceMatrix)*n;
  #endif
  vWorld=(modelMatrix*p).xyz;vNormal=normalize(mat3(modelMatrix)*n);
  gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);
}`,Ss=`
precision highp float;
in vec3 vWorld,vNormal;
layout(location=0) out vec4 surfaceNormal;
layout(location=1) out vec4 surfacePosition;
void main(){surfaceNormal=vec4(normalize(vNormal),0.16);surfacePosition=vec4(vWorld,1.0);}`,wo=()=>new $(1,1,{type:ne,count:2,depthBuffer:!0,minFilter:ye,magFilter:ye});function _s(n){let e=new Map,t=it*1.8,i=(s,r,a)=>`${s},${r},${a}`;for(let s of n){let r=i(Math.floor(s.x/t),Math.floor(s.y/t),Math.floor(s.z/t));e.has(r)||e.set(r,[]),e.get(r).push(s)}let o=[];for(;e.size;){let s=e.keys().next().value,r=[s],a=[];a.push(...e.get(s)),e.delete(s);for(let c=0;c<r.length;c++){let[l,p,u]=r[c].split(",").map(Number);for(let v=-1;v<=1;v++)for(let S=-1;S<=1;S++)for(let E=-1;E<=1;E++){let b=i(l+v,p+S,u+E),A=e.get(b);A&&(a.push(...A),e.delete(b),r.push(b))}}o.push(a)}return o.sort((s,r)=>r.length-s.length)}var li=class{constructor(e){this.scene=new nt,this.direct=wo(),this.reflected=wo(),this.mirror=new ct,this.projection=new Pe,this.revision=-1,this.generation=-1,this.lastUpdate=-1/0;let t=new Ve({glslVersion:qe,vertexShader:bo,fragmentShader:Ss,side:ot});this.surfaces=Array.from({length:4},()=>{let o=new oi(40,t,!1,!1,24e3);return o.isolation=.6,o.frustumCulled=!1,o.visible=!1,this.scene.add(o),o});let i=t.clone();i.vertexShader=`precision highp float;
in mat4 instanceMatrix;
`+bo,i.defines={USE_INSTANCING:""},this.droplets=new Xi(new Vi(1,1),i,1200),this.droplets.frustumCulled=!1,this.droplets.count=0,this.scene.add(this.droplets),Object.assign(e,{uFluidVisible:{value:!1},uFluidNormal:{value:this.direct.textures[0]},uFluidPosition:{value:this.direct.textures[1]},uFluidMin:{value:new _},uFluidMax:{value:new _},uFluidMirrorNormal:{value:this.reflected.textures[0]},uFluidMirrorPosition:{value:this.reflected.textures[1]},uFluidMirrorProjection:{value:this.projection}}),this.uniforms=e}resize(e,t){this.direct.setSize(e,t),this.reflected.setSize(e,t)}update(e){if(this.generation!==e.generation&&(this.generation=e.generation,this.lastUpdate=-1/0),this.uniforms.uFluidVisible.value=e.particles.length>0,this.revision===e.revision||e.particles.length&&e.time-this.lastUpdate<1/30)return;this.revision=e.revision,this.lastUpdate=e.time;let t=this.uniforms.uFluidMin.value.set(1/0,1/0,1/0),i=this.uniforms.uFluidMax.value.set(-1/0,-1/0,-1/0);for(let r of e.particles)t.min(new _(r.x,r.y,r.z)),i.max(new _(r.x,r.y,r.z));t.addScalar(-it),i.addScalar(it);for(let r of this.surfaces)r.visible=!1;this.droplets.count=0;let o=new Pe,s=0;for(let r of _s(e.particles)){if(s>=4||r.length<5){for(let d of r)o.makeScale(.065,.065,.065),o.setPosition(d.x,d.y,d.z),this.droplets.setMatrixAt(this.droplets.count++,o);continue}let a=this.surfaces[s++],c=e.budget<800?32:40;a.resolution!==c&&(a.geometry.dispose(),a.init(c)),a.isolation=.6,a.reset(),a.visible=!0;let l=new _(1/0,1/0,1/0),p=new _(-1/0,-1/0,-1/0);for(let d of r)l.min(new _(d.x,d.y,d.z)),p.max(new _(d.x,d.y,d.z));let u=p.clone().sub(l),v=Math.ceil((Math.max(u.x,u.y,u.z)+it*4)/.25)*.25;a.position.copy(l).add(p).multiplyScalar(.5),a.scale.setScalar(v/2);let S=c,E=v/S,b=a.position.clone().addScalar(-v/2),A=it,L=A*A;for(let d of r){let f=(d.x-b.x)/E,m=(d.y-b.y)/E,g=(d.z-b.z)/E,x=A/E;for(let R=Math.max(1,Math.floor(g-x));R<=Math.min(S-2,Math.ceil(g+x));R++)for(let w=Math.max(1,Math.floor(m-x));w<=Math.min(S-2,Math.ceil(m+x));w++)for(let P=Math.max(1,Math.floor(f-x));P<=Math.min(S-2,Math.ceil(f+x));P++){let k=((P-f)**2+(w-m)**2+(R-g)**2)*E*E;k<L&&(a.field[P+w*S+R*S*S]+=(1-k/L)**3)}}a.update(),a.geometry.setDrawRange(0,Math.min(a.count,a.geometry.attributes.position.count))}this.droplets.instanceMatrix.needsUpdate=!0}render(e,t){if(!this.uniforms.uFluidVisible.value)return;this.mirror.copy(t),this.mirror.position.y*=-1;let i=t.getWorldDirection(new _);i.y*=-1,this.mirror.up.copy(t.up),this.mirror.up.y*=-1,this.mirror.lookAt(this.mirror.position.clone().add(i)),this.mirror.updateMatrixWorld(!0),this.projection.multiplyMatrices(this.mirror.projectionMatrix,this.mirror.matrixWorldInverse);let o=e.getClearColor(new ue),s=e.getClearAlpha();e.setClearColor(0,0),e.setRenderTarget(this.direct),e.clear(),e.render(this.scene,t),e.setRenderTarget(this.reflected),e.clear(),e.render(this.scene,this.mirror),e.setClearColor(o,s),e.setRenderTarget(null)}};function Eo(n,e="studio"){if(e==="original"||!n.isMeshBasicMaterial)return n.clone();let t=new At({roughness:.72,metalness:0});qi.prototype.copy.call(t,n),t.color.copy(n.color);for(let i of["map","alphaMap","aoMap","aoMapIntensity","lightMap","lightMapIntensity","envMap","wireframe","wireframeLinewidth","flatShading"])n[i]!==void 0&&(t[i]=n[i]);return t}var So=()=>new $(1,1,{type:ne,count:2,depthBuffer:!0,minFilter:ye,magFilter:ye}),ci=class{constructor(e,t){this.renderer=e,this.uniforms=t,this.scene=new nt,this.instances=new Map,this.direct=So(),this.reflected=So(),this.mirror=new ct,this.projection=new Pe,this.raycaster=new dt,this.lights=Array.from({length:4},()=>{let i=new Bi;return i.decay=2,this.scene.add(i,i.target),i}),Object.assign(t,{uModelsVisible:{value:!1},uModelColor:{value:this.direct.textures[0]},uModelPosition:{value:this.direct.textures[1]},uMirrorColor:{value:this.reflected.textures[0]},uMirrorPosition:{value:this.reflected.textures[1]},uMirrorProjection:{value:this.projection},uModelMin:{value:new _},uModelMax:{value:new _}})}resize(e,t){this.direct.setSize(e,t),this.reflected.setSize(e,t)}material(e,t){let i=Eo(e,t);return i.toneMapped=!1,i.onBeforeCompile=o=>{Object.assign(o.uniforms,this.uniforms),o.vertexShader=`varying vec3 vModelWorld;
`+o.vertexShader,o.vertexShader=o.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
        vec4 modelPoint=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          modelPoint=instanceMatrix*modelPoint;
        #endif
        vModelWorld=(modelMatrix*modelPoint).xyz;`),o.fragmentShader=`varying vec3 vModelWorld;
layout(location=1) out vec4 modelWorldOutput;
`+(xt+ti+Ri).replace(/\bPI\b/g,"WATER_PI")+o.fragmentShader,o.fragmentShader=o.fragmentShader.replace("#include <opaque_fragment>",`
        ${i.isMeshBasicMaterial?"":`float surfaceY=wave(vModelWorld.xz).x;
        if(vModelWorld.y<surfaceY) {
          vec3 caustic=vec3(0.0);
          for(int i=0;i<4;i++)if(dot(uLightColor[i],vec3(1.0))>.001)caustic+=waterLight(i,vModelWorld);
          outgoingLight+=diffuseColor.rgb*caustic*uCausticStrength*0.12;
        } else {
          vec3 bounce=vec3(0.0);
          for(int i=0;i<4;i++)if(dot(uLightColor[i],vec3(1.0))>.001)bounce+=lightAt(i,vec3(vModelWorld.x,surfaceY,vModelWorld.z));
          outgoingLight+=diffuseColor.rgb*bounce*0.045/(1.0+max(0.0,vModelWorld.y-surfaceY));
        }
        `}
        #include <opaque_fragment>
        if(diffuseColor.a<0.01)discard;
        modelWorldOutput=vec4(vModelWorld,1.0);`)},i.customProgramCacheKey=()=>"studio-original-material-v2",i}sync(e,t,i){let o=this.uniforms.uModelMin.value.set(1/0,1/0,1/0),s=this.uniforms.uModelMax.value.set(-1/0,-1/0,-1/0),r=new Set(e.map(a=>a.id));for(let[a,c]of this.instances)if(!r.has(a)||c.lighting!==(t?.get(c.kind)?.lighting??"studio")){this.scene.remove(c.group);for(let l of c.materials)l.dispose();for(let l of c.skeletons)l.dispose();this.instances.delete(a)}for(let a of e){let c=t?.get(a.kind);if(!c)continue;o.min(a.position.clone().addScalar(-a.radius-.08)),s.max(a.position.clone().addScalar(a.radius+.08));let l=this.instances.get(a.id);if(!l){let p=new Xe,u=Qi(c.scene),v=new Map,S=new Set;p.add(u),u.traverse(E=>{if(!E.isMesh)return;E.userData.bodyId=a.id,E.isSkinnedMesh&&S.add(E.skeleton);let b=A=>(v.has(A)||v.set(A,this.material(A,c.lighting)),v.get(A));E.material=Array.isArray(E.material)?E.material.map(b):b(E.material)}),l={group:p,materials:[...v.values()],skeletons:S,kind:a.kind,lighting:c.lighting??"studio"},this.instances.set(a.id,l),this.scene.add(p)}l.group.position.copy(a.position),l.group.quaternion.copy(a.rotation),l.group.scale.setScalar(a.size)}this.lights.forEach((a,c)=>{let l=i[c];a.visible=!!l?.enabled,l&&(a.position.set(l.x,l.y,l.z),a.target.position.set(l.targetX,0,l.targetZ),a.color.set(l.color),a.intensity=l.intensity,a.angle=pe.degToRad(l.spread/2),a.penumbra=l.softness)}),this.scene.updateMatrixWorld(!0),this.uniforms.uModelsVisible.value=this.instances.size>0}render(e){if(!this.instances.size)return;let t=this.renderer;this.mirror.copy(e),this.mirror.position.y*=-1;let i=e.getWorldDirection(new _);i.y*=-1,this.mirror.up.copy(e.up),this.mirror.up.y*=-1,this.mirror.lookAt(this.mirror.position.clone().add(i)),this.mirror.updateMatrixWorld(!0),this.projection.multiplyMatrices(this.mirror.projectionMatrix,this.mirror.matrixWorldInverse);let o=t.getClearColor(new ue),s=t.getClearAlpha();t.setClearColor(0,0),t.setRenderTarget(this.direct),t.clear(),t.render(this.scene,e),t.setRenderTarget(this.reflected),t.clear(),t.render(this.scene,this.mirror),t.setClearColor(o,s),t.setRenderTarget(null)}pick(e,t=100){this.raycaster.ray.copy(e),this.raycaster.near=.002,this.raycaster.far=t;let i=this.raycaster.intersectObjects([...this.instances.values()].map(o=>o.group),!0)[0];return i?(i.point.bodyId=i.object.userData.bodyId,i.point):null}};var O=n=>({value:n}),di=class{time=0;dirty=!0;pickPending=!1;constructor(e,t,i,o,s,r,a){Object.assign(this,{renderer:e,camera:t,settings:i,lights:o,ripples:s,shapes:r,models:a}),this.ocean=new Ut(e,{..._i(),windSpeed:5,fetchKm:20,swellScale:.18,waveScale:1,timeScale:1}),this.post=new Wt(e),Object.assign(this.post.params,{autoExposure:!1,contrast:1.04,saturation:1.15,bloomThreshold:.8}),this.hdr=new $(1,1,{type:ne,depthBuffer:!0}),this.volumeTarget=new $(1,1,{type:ne,depthBuffer:!1}),this.atlas=new $(1,1,{type:ne,depthBuffer:!1,minFilter:_e}),this.pickTarget=new $(3,1,{type:Re,depthBuffer:!1}),this.surfaceTarget=new $(512,512,{type:ne,depthBuffer:!1,wrapS:at,wrapT:at,minFilter:_e,magFilter:_e}),this.uniforms={uDisp:O(null),uSlope:O(null),uDetail:O(null),uSwellDisp:O(null),uSwellSlope:O(null),uSurface:O(this.surfaceTarget.texture),uWaveStrength:O(1),uDetailStrength:O(1),uChoppiness:O(1),uRippleCount:O(0),uTraceSteps:O(8),uRipples:O(Array.from({length:16},()=>new de)),uRippleSize:O(Array(16).fill(.3)),uRippleExtra:O(Array.from({length:16},()=>new G)),uShapeCount:O(0),uShapes:O(Array.from({length:Ee},()=>new de)),uShapeRotation:O(Array.from({length:Ee},()=>new de(0,0,0,1))),uShapeKind:O(Array(Ee).fill(0)),uPickObjects:O(!1),uViewProjection:O(new Pe),uLightPos:O(Array.from({length:4},()=>new _)),uLightDir:O(Array.from({length:4},()=>new _(0,-1,0))),uLightColor:O(Array.from({length:4},()=>new ue(0,0,0))),uBeam:O(Array.from({length:4},()=>new de)),uDepth:O(3),uClarity:O(1),uScattering:O(.5),uFloorVisible:O(1),uCausticStrength:O(1),uCausticAtlas:O(this.atlas.texture),uAtlasSize:O(384),uCamera:O(t.position),uInverseProjection:O(t.projectionMatrixInverse),uCameraWorld:O(t.matrixWorld),uLightIndex:O(0),uSliceDepth:O(3),uRayOrigin:O(new _),uRayDirection:O(new _),uVolume:O(this.volumeTarget.texture)},this.meshModels=new ci(e,this.uniforms),this.surfacePass=new Te(be(ho,this.uniforms)),this.view=new Te(be(xo,this.uniforms,{depthTest:!0,depthWrite:!0,depthFunc:Li})),this.splash=new li(this.uniforms),this.fluid=new ni,this.fluidQueryInput=new fi(new Float32Array(1200*4),1200,1,Ge,Re),this.fluidQueryTarget=new $(1200,1,{type:Re,depthBuffer:!1}),this.fluidQueryPass=new Te(be(Pi,{...this.uniforms,uQueries:O(this.fluidQueryInput)})),this.fluidQueryPending=!1,this.lastFluidQuery=-1/0,this.queryInput=new fi(new Float32Array(1024*4),1024,1,Ge,Re),this.queryTarget=new $(1024,1,{type:Re,depthBuffer:!1}),this.queryPass=new Te(be(Pi,{...this.uniforms,uQueries:O(this.queryInput)})),this.queryPending=!1,this.pickQueue=Promise.resolve(),this.volume=new Te(be(go,this.uniforms)),this.picker=new Te(be(yo,this.uniforms)),this.causticMaterial=new Ve({glslVersion:qe,vertexShader:po,fragmentShader:uo,uniforms:this.uniforms,depthTest:!1,depthWrite:!1,side:ot,blending:zt,blendSrc:st,blendDst:st}),this.causticMesh=new z(new bt(1,1,160,160),this.causticMaterial),this.causticMesh.frustumCulled=!1,this.passCamera=new Yi,this.setCausticQuality(i.causticQuality)}setCausticQuality(e){this.atlas.setSize(e*4,e*3),this.uniforms.uAtlasSize.value=e,this.causticMesh.geometry.dispose();let t=e>=512?192:e>=384?160:112;this.causticMesh.geometry=new bt(1,1,t,t),this.dirty=!0}resize(e,t){this.hdr.setSize(e,t),this.meshModels.resize(e,t),this.splash.resize(e,t),this.volumeTarget.setSize(Math.max(1,Math.floor(e/2)),Math.max(1,Math.floor(t/2))),this.post.setSize(e,t)}sync(){let e=this.uniforms,t=this.settings;e.uWaveStrength.value=t.waveStrength,e.uDetailStrength.value=t.detail,e.uChoppiness.value=t.choppiness,e.uDepth.value=t.floorDepth,e.uClarity.value=t.clarity,e.uScattering.value=t.scattering,e.uFloorVisible.value=+t.floorVisible,e.uCausticStrength.value=t.caustics,this.ocean.params.windDirection!==t.direction&&(this.ocean.params.windDirection=t.direction,this.ocean.dirty=!0),this.ocean.params.choppiness=t.choppiness;for(let o=0;o<4;o++){let s=this.lights.lights[o];e.uLightColor.value[o].setRGB(0,0,0),s&&(s.y=Math.max(.6,s.y),e.uLightPos.value[o].set(s.x,s.y,s.z),e.uLightDir.value[o].set(s.targetX,0,s.targetZ).sub(e.uLightPos.value[o]).normalize(),e.uLightColor.value[o].set(s.color).multiplyScalar(s.enabled?s.intensity:0),e.uBeam.value[o].set(Math.cos(pe.degToRad(s.spread/2)),s.focus,s.softness,s.size))}let i=this.ripples.active(this.time);e.uRippleCount.value=i.length;for(let o=0;o<16;o++){let s=i[o];e.uRipples.value[o].set(s?.x??0,s?.z??0,s?this.time-s.time:0,s?.strength??0),e.uRippleSize.value[o]=s?.radius??.3,e.uRippleExtra.value[o].set(s?.y??0,s?.spray??0)}e.uShapeCount.value=this.shapes.bodies.length,this.shapes.bodies.forEach((o,s)=>{e.uShapes.value[s].set(o.position.x,o.position.y,o.position.z,o.size),e.uShapeRotation.value[s].copy(o.rotation);let r=Je.indexOf(o.kind);e.uShapeKind.value[s]=r<0?3:r}),this.meshModels.sync(this.shapes.bodies,this.models,this.lights.lights),this.post.params.exposure=t.exposure,this.post.params.bloomStrength=t.bloom,this.post.params.freezeDither=t.paused||t.speed===0}renderCaustics(){let e=this.renderer,t=this.uniforms.uAtlasSize.value,i=e.getViewport(new de);e.setRenderTarget(this.atlas),e.setScissorTest(!1),e.setClearColor(0,0),e.clear(),e.setScissorTest(!0);for(let o=0;o<this.lights.lights.length;o++){let s=this.lights.lights[o];if(!(!s.enabled||!s.intensity)){this.uniforms.uLightIndex.value=o;for(let r=0;r<3;r++)this.uniforms.uSliceDepth.value=this.settings.floorDepth*[.25,.55,1][r],e.setViewport(o*t,r*t,t,t),e.setScissor(o*t,r*t,t,t),e.render(this.causticMesh,this.passCamera)}}e.setScissorTest(!1),e.setRenderTarget(null),e.setViewport(i)}render(e){let t=this.settings.paused?0:Math.min(e,.05)*this.settings.speed;this.time+=t,this.shapes.step(t,this.settings.floorDepth,i=>{this.ripples.add(i.x,i.z,this.time,i.radius,i.strength,!1,{y:i.y,spray:1,bodyId:i.bodyId})}),this.fluid.sync(this.ripples,this.time,this.shapes.bodies,t>0),this.fluid.step(t,this.shapes.bodies,this.settings.floorDepth,i=>{this.ripples.add(i.x,i.z,this.time,i.radius,i.strength,!1,{y:i.y,spray:0,feedback:!0})}),this.splash.update(this.fluid),this.sync(),(t>0||this.dirty)&&(this.ocean.update(t),this.uniforms.uDisp.value=this.ocean.displacement[2],this.uniforms.uSlope.value=this.ocean.slope[2],this.uniforms.uDetail.value=this.ocean.slope[3],this.uniforms.uSwellDisp.value=this.ocean.displacement[1],this.uniforms.uSwellSlope.value=this.ocean.slope[1],this.surfacePass.render(this.renderer,this.surfaceTarget),this.renderer.setRenderTarget(null),this.renderCaustics(),this.dirty=!1),t>0&&(this.submitHeights(),this.submitFluidHeights()),this.camera.updateMatrixWorld(),this.uniforms.uViewProjection.value.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse),this.meshModels.render(this.camera),this.splash.render(this.renderer,this.camera),this.volume.render(this.renderer,this.volumeTarget),this.view.render(this.renderer,this.hdr),this.post.render(this.hdr.texture,t),this.renderer.setRenderTarget(null)}submitFluidHeights(){if(this.fluidQueryPending||!this.fluid.particles.length||this.time-this.lastFluidQuery<.05)return;let e=this.fluid.query(),t=e.ids.length;for(let o=0;o<t;o++)this.fluidQueryInput.image.data.set([e.points[o*2],e.points[o*2+1],0,0],o*4);this.fluidQueryInput.needsUpdate=!0,this.fluidQueryPass.render(this.renderer,this.fluidQueryTarget),this.renderer.setRenderTarget(null),this.fluidQueryPending=!0,this.lastFluidQuery=this.time;let i=new Float32Array(t*4);this.renderer.readRenderTargetPixelsAsync(this.fluidQueryTarget,0,0,t,1,i).then(()=>this.fluid.ingest(e,i)).catch(o=>console.warn("Fluid water sample unavailable",o)).finally(()=>{this.fluidQueryPending=!1})}submitHeights(){if(this.queryPending||!this.shapes.bodies.length)return;let e=this.shapes.query(),t=e.points.length/2;for(let o=0;o<t;o++)this.queryInput.image.data.set([e.points[o*2],e.points[o*2+1],0,0],o*4);this.queryInput.needsUpdate=!0,this.queryPass.render(this.renderer,this.queryTarget),this.renderer.setRenderTarget(null),this.queryPending=!0;let i=new Float32Array(t*4);this.renderer.readRenderTargetPixelsAsync(this.queryTarget,0,0,t,1,i).then(()=>this.shapes.ingest(e,i)).catch(o=>console.warn("Water sample unavailable",o)).finally(()=>{this.queryPending=!1})}pick(e,t=!1,i=!1){if(!t&&this.pickPending)return Promise.resolve(null);let o=this.pickQueue.then(()=>this.performPick(e,i));return this.pickQueue=o.catch(()=>null),o}async performPick(e,t){this.pickPending=!0;try{this.sync();let i=this.shapes.bodies.map(u=>u.id);this.uniforms.uPickObjects.value=t,this.uniforms.uRayOrigin.value.copy(e.origin),this.uniforms.uRayDirection.value.copy(e.direction),this.picker.render(this.renderer,this.pickTarget),this.renderer.setRenderTarget(null);let o=new Float32Array(12);await this.renderer.readRenderTargetPixelsAsync(this.pickTarget,0,0,3,1,o);let s=o[3]>.5?new _(o[0],o[1],o[2]):null;if(s&&o[3]>1.5&&(s.bodyId=i[Math.round(o[3])-2]),!t||!this.meshModels.instances.size)return s;let r=o[11],a=o[7]>.5,c=r>0?r:100;a&&e.direction.y<-.001&&(c=Math.min(c,(-this.settings.floorDepth-e.origin.y)/e.direction.y));let l=s?s.distanceTo(e.origin):1/0,p=this.meshModels.pick(e,Math.min(c,l));if(p)return p;if(s?.bodyId!==void 0&&l<c-.01)return s;if(r>0){let u=new _().fromArray(o,4),v=a?1.333:1/1.333,S=u.dot(e.direction),E=1-v*v*(1-S*S);if(E>=0){let b=e.direction.clone().multiplyScalar(v).addScaledVector(u,-v*S-Math.sqrt(E)).normalize(),A=new _().fromArray(o,8).addScaledVector(b,.005),L=!a&&b.y<-.001?Math.max(0,(-this.settings.floorDepth-A.y)/b.y):100;s?.bodyId!==void 0&&(L=Math.min(L,A.distanceTo(s)));let d=this.meshModels.pick(new Rt(A,b),L);if(d)return d}}return s}finally{this.pickPending=!1}}};async function _o(n,e){return await new Promise(t=>requestAnimationFrame(()=>setTimeout(t,0))),co(n,e)}var Ai={wave:'<svg viewBox="0 0 32 24" fill="none"><path d="M2 8c4-8 8 8 14 0s10 8 14 0M2 16c4-8 8 8 14 0s10 8 14 0" stroke="currentColor" stroke-width="1.5"/></svg>',eye:'<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor"/><circle cx="12" cy="12" r="3" stroke="currentColor"/></svg>'};function Mo(n,e){n.parentElement.querySelector("[data-small-list]")?.remove();let t=[...n.options].filter(o=>o.value);if(n.hidden=t.length>0&&t.length<=4,!n.hidden)return;let i=document.createElement("span");i.className="looks inline-choices",i.dataset.smallList="",i.setAttribute("role","group"),i.setAttribute("aria-label",e);for(let o of t){let s=document.createElement("button");s.type="button",s.textContent=o.textContent,s.dataset.choice=o.value,s.setAttribute("aria-pressed",String(n.value===o.value)),s.onclick=r=>{r.preventDefault(),n.value=o.value,n.dispatchEvent(new Event("change",{bubbles:!0}))},i.append(s)}n.after(i)}var hi=class{tab="lights";hidden=!1;constructor(e,t,i){Object.assign(this,{settings:e,lights:t,actions:i}),document.querySelector("#app").innerHTML=`
      <header class="topbar chrome"><a class="brand" href="/" aria-label="Dark Water home">${Ai.wave}<span>Dark Water</span></a>
      <div class="topright"><button id="hide-ui" class="icon-button" title="Hide interface \xB7 H" aria-label="Hide interface">${Ai.eye}</button></div></header>
      <section class="study chrome"><div class="looks" aria-label="Lighting presets"><button data-preset="violet" class="active"><i style="--swatch:#8863ff"></i>Violet</button><button data-preset="cross"><i style="--swatch:#50d6dc"></i>Cross-light</button><button data-preset="white"><i style="--swatch:#e6e7ed"></i>White</button></div></section>
      <aside class="inspector chrome" aria-label="Studio controls"><nav class="tabs" aria-label="Control sections"><button data-tab="lights" class="active">Lights <span id="light-count">02</span></button><button data-tab="objects">Objects</button><button data-tab="water">Water</button><button data-tab="scene">Scene</button></nav><div id="panel"></div></aside>
      <div class="view-switch chrome"><button data-camera="surface" class="active">Surface</button><button data-camera="overhead">Overhead</button><button data-camera="underwater">Underwater</button></div>
      <footer class="bottom chrome"><div class="tools" role="toolbar" aria-label="Interaction mode"><button data-mode="interact" class="active" title="Click water to splash \xB7 Drag shapes to move \xB7 Drag empty space to orbit \xB7 Shift-drag water for ripples \xB7 Right-drag to pan \xB7 Scroll to zoom \xB7 1 or 3"><span>\u25CE</span> Interact</button><button data-mode="lights" title="Move and aim lights \xB7 2"><span>\u2727</span> Lights</button><button data-mode="shapes" title="Drop floating shapes \xB7 4"><span>\u25C7</span> Shapes</button><div class="divider"></div><button id="pause" title="Pause water \xB7 Space" aria-label="Pause water">\u2161</button></div></footer>
      <div id="shape-indicator" hidden aria-hidden="true"><svg viewBox="0 0 100 100"><circle class="indicator-sphere" cx="50" cy="50" r="45"/><path class="indicator-pyramid" d="M50 5 95 95H5Z"/><rect class="indicator-cube" x="5" y="5" width="90" height="90" rx="2"/></svg><i></i><span></span></div>
      <div id="interaction-hint" class="interaction-hint chrome" hidden>Drag to orbit \xB7 Click water to splash<br>Drag shapes to lift or submerge \xB7 Shift-drag for ripples</div>
      <section id="shape-tray" class="shape-tray chrome" aria-label="Shape tools" hidden>
        <div class="shape-options" role="group" aria-label="Shape type">
          <button data-shape="sphere" aria-label="Sphere" aria-pressed="true" title="Sphere"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/></svg><span>Sphere</span></button>
          <button data-shape="pyramid" aria-label="Pyramid" aria-pressed="false" title="Pyramid"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 20H3Z"/></svg><span>Pyramid</span></button>
          <button data-shape="cube" aria-label="Cube" aria-pressed="false" title="Cube"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1"/></svg><span>Cube</span></button>
        </div>
        <div class="model-tools">
          <input id="model-file" type="file" accept=".glb,.obj,.stl" aria-label="Upload 3D model" hidden/>
          <button id="upload-model" class="add-button">\uFF0B Upload 3D model</button>
          <div id="model-selection" hidden><select id="model-select" aria-label="Uploaded model"><option value="">Choose uploaded model</option></select><button id="remove-model" aria-label="Remove selected model and its copies" title="Remove model and its copies">Remove</button></div>
          <div id="model-placement" hidden>
            <button id="add-model" class="add-button">Add a copy</button>
            <div class="section-label">Model lighting</div><div class="looks inline-choices" role="group" aria-label="Model lighting"><button data-model-lighting="studio">Studio lights</button><button data-model-lighting="original">As exported</button></div>
            <p id="model-lighting-note" class="model-note"></p>
            <div class="model-adjustments"><label>Size <input id="model-size" aria-label="Model size" type="number" min="0.35" max="3" step="0.05" value="1.5"/> m</label><label>Turn <input id="model-angle" aria-label="Model rotation" type="number" min="-180" max="180" step="5" value="0"/> \xB0</label></div>
            <p class="model-note">Adjusts the latest copy \xB7 Drag to move in Interact</p>
          </div>
          <p class="model-note">GLB, OBJ, STL \xB7 Up to 100 MB \xB7 Original detail<br>GLB preserves embedded materials and textures.<br>Scene capacity adapts to each model. Files stay on your device.</p>
          <p id="model-status" class="model-note" role="status" aria-live="polite"></p>
        </div>
        <div class="shape-growth"><div id="shape-growth-fill"></div></div>
        <div class="shape-help"><span id="shape-size">Click to drop \xB7 Hold to grow</span><span id="shape-count">0 / ${Ee}</span></div>
        <div class="shape-foot"><span>${je}\u2013${Fe.toFixed(1)} m \xB7 Hold to grow shapes</span><button id="clear-shapes">Clear shapes</button></div>
      </section>
      <button id="restore-ui" hidden aria-label="Show controls" title="Show controls \xB7 H">${Ai.eye}</button><div id="toast" role="status"></div>`,document.querySelectorAll("[data-preset]").forEach(s=>s.onclick=()=>i.preset(s.dataset.preset)),document.querySelectorAll("[data-tab]").forEach(s=>s.onclick=()=>{this.tab=s.dataset.tab,this.renderPanel()}),document.querySelectorAll("[data-mode]").forEach(s=>s.onclick=()=>i.mode(s.dataset.mode)),document.querySelectorAll("[data-camera]").forEach(s=>s.onclick=()=>i.camera(s.dataset.camera)),document.querySelectorAll("[data-shape]").forEach(s=>s.onclick=()=>i.shape(s.dataset.shape)),document.querySelector("#clear-shapes").onclick=()=>i.clearShapes();let o=document.querySelector("#model-file");document.querySelector("#upload-model").onclick=()=>o.click(),o.onchange=()=>{let s=o.files[0];o.value="",s&&i.uploadModel(s)},document.querySelector("#model-select").onchange=s=>{s.target.value&&i.shape(s.target.value)},document.querySelector("#remove-model").onclick=()=>i.removeModel(),document.querySelector("#add-model").onclick=()=>i.addModel(),document.querySelectorAll("[data-model-lighting]").forEach(s=>s.onclick=()=>i.modelLighting(s.dataset.modelLighting)),document.querySelector("#model-size").onchange=s=>i.modelTransform("size",+s.target.value),document.querySelector("#model-angle").onchange=s=>i.modelTransform("angle",+s.target.value),document.querySelector("#pause").onclick=()=>i.pause(),document.querySelector("#hide-ui").onclick=()=>this.toggle(),document.querySelector("#restore-ui").onclick=()=>this.toggle(),this.renderPanel()}toggle(){this.hidden=!this.hidden,document.body.classList.toggle("clean",this.hidden),document.querySelector("#restore-ui").hidden=!this.hidden,this.actions.visibility(!this.hidden)}toast(e){let t=document.querySelector("#toast");t.textContent=e,t.classList.add("show"),clearTimeout(this.toastTimer),this.toastTimer=setTimeout(()=>t.classList.remove("show"),2500)}slider(e,t,i,o,s,r="",a="settings"){let c=(a==="light"?this.lights.selected:this.settings)[e];return`<label class="slider-control"><span>${t}<span class="number-wrap"><input type="number" data-key="${e}" data-scope="${a}" min="${i}" max="${o}" step="${s}" value="${c}" aria-label="${t} value"/><small>${r}</small></span></span><input type="range" data-key="${e}" data-scope="${a}" min="${i}" max="${o}" step="${s}" value="${c}" aria-label="${t}"/></label>`}renderPanel(){document.querySelectorAll("[data-tab]").forEach(a=>a.classList.toggle("active",a.dataset.tab===this.tab));let e=(...a)=>this.slider(...a),t=(a,c,l,p,u,v="")=>e(a,c,l,p,u,v,"light"),i="";if(this.tab==="lights"){i='<div class="light-list">';for(let c of this.lights.lights)i+=`<div class="light-row ${c.id===this.lights.selectedId?"selected":""}"><button data-select="${c.id}" class="light-select"><i style="--swatch:${c.color}"></i><span>${c.name}</span></button><button data-toggle-light="${c.id}" class="light-toggle" aria-label="${c.enabled?"Disable":"Enable"} ${c.name}" title="Toggle light">${c.enabled?"\u25CF":"\u25CB"}</button></div>`;i+=`</div><button id="add-light" class="add-button" ${this.lights.lights.length>=4?"disabled":""}>\uFF0B Add light</button>`;let a=this.lights.selected;a&&(i+=`<div class="section-label space actions-only"><div><button id="duplicate-light" title="Duplicate light" ${this.lights.lights.length>=4?"disabled":""}>Duplicate</button><button id="delete-light" title="Delete light">Delete</button></div></div><label class="color-row">Color <span><input aria-label="Light color" type="color" id="light-color" value="${a.color}"/></span></label>`,i+=t("intensity","Intensity",0,600,1),i+='<div class="section-label space">Beam <div><button data-beam="spot">Spot</button><button data-beam="flood">Flood</button></div></div>',i+=t("spread","Spread",10,140,1,"\xB0")+t("focus","Focus",0,1,.01)+t("softness","Edge softness",0,1,.01)+t("size","Source size",.03,1.5,.01,"m"),i+='<div class="section-label space">Position <div><button data-handle="position" class="active">Move</button><button data-handle="aim">Aim</button></div></div>',i+=t("x","Position X",-10,10,.1,"m")+t("z","Position Z",-10,10,.1,"m")+t("y","Height",.6,12,.1,"m")+t("targetX","Aim X",-10,10,.1,"m")+t("targetZ","Aim Z",-10,10,.1,"m"))}else if(this.tab==="objects"){let a=this.actions.objectState(),c=a.selected;if(i='<label class="select-row">Selected object<select id="object-select" aria-label="Selected object"></select></label>',c){let l=(p,u,v,S,E,b)=>`<label>${u}<span><input data-object-key="${p}" aria-label="Object ${u.toLowerCase()}" type="number" min="${v}" max="${S}" step="${E}" value="${Number(c[p].toFixed(2))}"/><small>${b}</small></span></label>`;i+=`<label class="check-row">Suspend in place<input id="object-suspended" aria-label="Suspend in place" type="checkbox" ${c.suspended?"checked":""}/></label><p id="object-motion" class="panel-note"></p>`,i+='<div class="section-label space">Position</div><div class="object-fields">'+l("x","X",-10,10,.1,"m")+l("y","Height",-this.settings.floorDepth,8,.1,"m")+l("z","Z",-10,10,.1,"m")+"</div>",i+='<div class="section-label space">Size</div><div class="object-fields">'+l("size","Size",je,c.maxSize,.05,"m")+'</div><p class="panel-note">Uniform scale \xB7 Original proportions preserved</p>',i+='<div class="section-label space">Rotation</div><div class="object-fields">'+l("tilt","Tilt",-180,180,5,"\xB0")+l("turn","Turn",-180,180,5,"\xB0")+l("roll","Roll",-180,180,5,"\xB0")+"</div>",i+='<div class="object-actions"><button id="object-level" class="text-button">Reset rotation</button><button id="object-remove" class="text-button">Remove object</button></div><p class="panel-note">Editing holds this object in place. Turn off suspension to restore gravity and buoyancy. Drag it in Interact to move it with your view.</p>'}else i+='<p class="empty">Click an object in Interact, or choose one above. Add shapes and uploaded models with the Shapes tool.</p>';this.objectSignature=JSON.stringify([a.objects.map(l=>l.id),c?.id])}else this.tab==="water"?(i=e("floorDepth","Water depth",1,6,.1,"m"),i+=e("waveStrength","Wave strength",0,2,.01)+e("direction","Wind direction",-180,180,1,"\xB0")+e("detail","Ripple detail",0,3,.01)+e("choppiness","Choppiness",0,1.5,.01)+e("speed","Animation speed",0,2,.05,"\xD7"),i+='<div class="section-label space">Brush</div>',i+=e("brushSize","Brush radius",.1,1.2,.05,"m")+e("brushStrength","Strength",.02,.5,.01,"m"),i+='<button id="clear-ripples" class="text-button">Clear ripples</button>'):(i="",i+=e("exposure","Exposure",.1,3,.05)+e("bloom","Bloom",0,.6,.01)+e("clarity","Water clarity",.2,2,.05)+e("scattering","Scattering",0,2,.01)+e("caustics","Caustic strength",0,3,.05),i+='<div class="section-break"></div>',i+=`<label class="check-row">Submerged floor<input id="floor-visible" type="checkbox" ${this.settings.floorVisible?"checked":""}/></label><div class="section-label space">Quality</div>`,i+=e("resolution","Render scale",.5,1.5,.05,"\xD7"),i+=`<div class="section-label">Caustic detail</div><div class="looks inline-choices" role="group" aria-label="Caustic detail">${[[256,"Low"],[384,"Balanced"],[512,"High"]].map(([a,c])=>`<button data-quality="${a}" aria-pressed="${a===this.settings.causticQuality}">${c}</button>`).join("")}</div><button id="profile" class="add-button">Measure performance</button><p id="profile-result" class="panel-note" aria-live="polite"></p><div class="performance"><span id="fps"></span><span id="render-size"></span></div>`);if(document.querySelector("#panel").innerHTML=i,this.tab==="objects"){let a=this.actions.objectState(),c=document.querySelector("#object-select");c.add(new Option("Choose an object",""));for(let v of a.objects)c.add(new Option(v.name,String(v.id)));c.value=a.selected?String(a.selected.id):"",c.onchange=()=>this.actions.selectObject(c.value?+c.value:null),Mo(c,"Selected object"),document.querySelectorAll("[data-object-key]").forEach(v=>v.onchange=()=>{v.value!==""&&Number.isFinite(+v.value)&&this.actions.objectPose({[v.dataset.objectKey]:+v.value}),this.syncObjects()});let l=document.querySelector("#object-suspended");l&&(l.onchange=()=>this.actions.suspendObject(l.checked));let p=document.querySelector("#object-level");p&&(p.onclick=()=>this.actions.objectPose({tilt:0,turn:0,roll:0}));let u=document.querySelector("#object-remove");u&&(u.onclick=()=>this.actions.removeObject()),this.syncObjects()}document.querySelector("#light-count").textContent=`${this.lights.lights.length}/4`,document.querySelectorAll("input[data-key]").forEach(a=>a.oninput=()=>{if(a.value==="")return;let c=Math.max(+a.min,Math.min(+a.max,+a.value)),l=a.dataset.scope==="light"?this.lights.selected:this.settings;!Number.isFinite(c)||!l||(l[a.dataset.key]=c,document.querySelectorAll(`input[data-key="${a.dataset.key}"]`).forEach(p=>{p!==a&&(p.value=c)}),this.actions.change(a.dataset.key))}),document.querySelectorAll("[data-select]").forEach(a=>a.onclick=()=>this.actions.select(+a.dataset.select)),document.querySelectorAll("[data-toggle-light]").forEach(a=>a.onclick=()=>{let c=this.lights.lights.find(l=>l.id===+a.dataset.toggleLight);c.enabled=!c.enabled,this.actions.change(),this.renderPanel()});let o=(a,c)=>{let l=document.getElementById(a);l&&(l.onclick=c)};o("add-light",()=>this.actions.add()),o("duplicate-light",()=>this.actions.duplicate()),o("delete-light",()=>this.actions.remove()),o("profile",()=>this.actions.profile()),o("clear-ripples",()=>this.actions.clearRipples());let s=document.querySelector("#light-color");s&&(s.oninput=()=>{this.lights.selected.color=s.value,this.actions.change()}),document.querySelectorAll("[data-beam]").forEach(a=>a.onclick=()=>{Object.assign(this.lights.selected,a.dataset.beam==="spot"?{spread:32,focus:.7,softness:.3}:{spread:105,focus:.05,softness:.85}),this.actions.change(),this.renderPanel()}),document.querySelectorAll("[data-handle]").forEach(a=>a.onclick=()=>this.actions.handle(a.dataset.handle));let r=document.querySelector("#floor-visible");r&&(r.onchange=()=>{this.settings.floorVisible=r.checked,this.actions.change()}),document.querySelectorAll("[data-quality]").forEach(a=>a.onclick=()=>{this.settings.causticQuality=Number(a.dataset.quality),this.actions.change("causticQuality"),document.querySelectorAll("[data-quality]").forEach(c=>c.setAttribute("aria-pressed",String(c===a)))})}syncObjects(){if(this.tab!=="objects")return;let e=this.actions.objectState(),t=e.selected;if(JSON.stringify([e.objects.map(o=>o.id),t?.id])!==this.objectSignature){this.renderPanel();return}t&&(document.querySelector("#object-suspended").checked=!!t.suspended,document.querySelector("#object-motion").textContent=t.suspended?"Suspended \xB7 Fixed position and rotation":this.settings.paused||this.settings.speed===0?"Paused \xB7 Physics resumes with the water":"Free to float \xB7 Gravity and buoyancy active",document.querySelectorAll("[data-object-key]").forEach(o=>{document.activeElement!==o&&(o.value=Number(t[o.dataset.objectKey].toFixed(2)))}))}syncValues(){document.querySelectorAll("input[data-key]").forEach(e=>{let t=e.dataset.scope==="light"?this.lights.selected:this.settings;t&&document.activeElement!==e&&(e.value=t[e.dataset.key])})}modelList(e){this.models=e;let t=document.querySelector("#model-select");t.replaceChildren(new Option("Choose uploaded model",""));for(let i of e)t.add(new Option(i.name,i.id));Mo(t,"Uploaded model"),document.querySelector("#model-selection").hidden=e.length===0,this.update()}modelStatus(e,t=!1,i=!1){let o=document.querySelector("#model-status");o.textContent=e,o.classList.toggle("model-error",i);let s=document.querySelector("#upload-model");s.disabled=t,s.textContent=t?"Opening model\u2026":"\uFF0B Upload 3D model"}update(){let e=this.settings;document.querySelector("#shape-tray").hidden=e.mode!=="shapes",document.querySelector("#interaction-hint").hidden=e.mode!=="interact",document.querySelectorAll("[data-shape]").forEach(i=>i.setAttribute("aria-pressed",String(i.dataset.shape===e.shape))),document.querySelector("#model-select").value=e.shape.startsWith("model-")?e.shape:"",document.querySelectorAll("#model-selection [data-choice]").forEach(i=>i.setAttribute("aria-pressed",String(i.dataset.choice===e.shape)));let t=this.models?.find(i=>i.id===e.shape);document.querySelector("#remove-model").disabled=!t,document.querySelector("#model-placement").hidden=!t,t&&(document.querySelectorAll("[data-model-lighting]").forEach(i=>i.setAttribute("aria-pressed",String(i.dataset.modelLighting===(t.lighting??"studio")))),document.querySelector("#model-lighting-note").textContent=t.unlit?t.lighting==="original"?"Unlit surfaces keep their exported appearance.":"Unlit surfaces respond to studio lights. Original textures stay intact.":"Original surface finish, illuminated by studio lights.",document.querySelector("#model-size").value=t.size??1.5,document.querySelector("#model-angle").value=t.angle??0),document.querySelectorAll("[data-mode]").forEach(i=>i.classList.toggle("active",i.dataset.mode===e.mode)),document.querySelectorAll("[data-camera]").forEach(i=>i.classList.toggle("active",i.dataset.camera===e.camera)),document.querySelectorAll("[data-preset]").forEach(i=>i.classList.toggle("active",i.dataset.preset===e.preset)),document.querySelector("#pause").textContent=e.paused?"\u25B7":"\u2161",document.querySelector("#pause").setAttribute("aria-label",e.paused?"Resume water":"Pause water")}shapeIndicator(e,t=30){let i=document.querySelector("#shape-indicator");if(i.hidden=!e,!e)return;let{x:o,y:s,kind:r,size:a,pending:c}=e;i.dataset.kind=r.startsWith("model-")?"cube":r,i.classList.toggle("maximum",a>=Fe),i.classList.toggle("pending",c),Object.assign(i.style,{left:`${o}px`,top:`${s}px`,width:`${t}px`,height:`${t}px`}),i.querySelector("span").textContent=c?"Finding water\u2026":`${a.toFixed(2)} m${a>=Fe?" \xB7 Maximum":""}`}shapeStatus(e,t,i={remaining:Ee-e,used:e},o=null){let s=`${e}:${t?.size.toFixed(2)??""}:${i.remaining}:${o?.id}:${this.settings.paused}:${this.settings.speed}`;s!==this.lastShapeStatus&&(this.lastShapeStatus=s,document.querySelector("#shape-count").textContent=`${e} ${e===1?"object":"objects"} \xB7 ${i.remaining} more ${o?"copies":"shapes"}`,document.querySelector("#shape-count").title="Capacity depends on geometry, materials, and texture memory. Simple shapes alone replace the oldest at 16.",document.querySelector("#shape-size").textContent=o?"Original model detail":t?`${t.size.toFixed(2)} m${t.size>=Fe?" \xB7 Maximum":" \xB7 Release to drop"}`:"Click to drop \xB7 Hold to grow",document.querySelector("#shape-growth-fill").style.transform=`scaleX(${t?(t.size-je)/(Fe-je):0})`,document.querySelector("#clear-shapes").disabled=e===0,document.querySelector("#add-model").disabled=!o||i.remaining===0||this.settings.paused||this.settings.speed===0,document.querySelector("#model-size").disabled=this.settings.paused||this.settings.speed===0,document.querySelector("#model-angle").disabled=this.settings.paused||this.settings.speed===0)}stats(e,t,i,o){let s=document.querySelector("#fps");s&&(s.textContent=`${Math.round(e)} FPS / ${t.toFixed(1)} MS`,document.querySelector("#render-size").textContent=`${i} \xD7 ${o}`)}};function pi(n){document.body.classList.add("fatal");let e=document.createElement("div");e.className="error";let t=document.createElement("h1");t.textContent="The studio needs your GPU";let i=document.createElement("p");i.textContent=n;let o=document.createElement("button");o.textContent="Reload studio",o.onclick=()=>location.reload(),e.append(t,i,o),document.body.append(e)}try{Ms()}catch(n){console.error(n),pi(n.message)}function Ms(){let n=document.createElement("canvas");n.id="water-canvas",n.setAttribute("aria-label","Interactive water and light studio");let e=n.getContext("webgl2",{alpha:!1,antialias:!1,powerPreference:"high-performance"});if(!e||!e.getExtension("EXT_color_buffer_float")||!e.getExtension("OES_texture_float_linear"))throw new Error("This experiment requires WebGL 2 with floating-point rendering and filtering. Enable hardware acceleration and open it in a current desktop browser.");document.body.prepend(n);let t=new Gi({canvas:n,context:e,antialias:!1});t.autoClear=!1,t.debug.onShaderError=(h,y,T,C)=>{let U=[h.getProgramInfoLog(y),h.getShaderInfoLog(T),h.getShaderInfoLog(C)].join(`
`);console.error(U),pi("A water shader could not compile on this GPU. The browser console contains the details.")};let i=new ct(48,1,.05,150),o=new Dt(i,n);o.enableDamping=!0,o.dampingFactor=.08,o.minDistance=.5,o.maxDistance=30,o.maxPolarAngle=Math.PI*.94;let s=lo(),r=new Yt,a=new Bt;r.preset("violet");let c=new ei,l=new Jt,p=new Gt(t.capabilities.maxTextureSize),u=new di(t,i,s,r,a,c,p),v=!1,S=new nt,E=new Ot(i,n);E.setSize(.7),S.add(E.getHelper());let b=new Qe,A=new Qe;S.add(b,A);let L="position",d,f=!1,m=null,g=0,x=new dt,R=new G,w=new Pt(.11,14,10),P=new Xe;S.add(P);let k=new z(new Ue(.22,.018,8,40),new lt({color:"#d4bbff",depthTest:!1}));k.rotation.x=-Math.PI/2,S.add(k);let D=new Me(new ve,new Ni({color:"#ad90d2",transparent:!0,opacity:.35,dashSize:.13,gapSize:.13,depthTest:!1}));S.add(D);let M={fps:0,frameMs:0,width:0,height:0,frames:0,samples:[]},I=null,H=performance.now(),q=H,N=0;function X(h=!1){let y=r.selected;if(h){for(;P.children.length;){let C=P.children[0];P.remove(C),C.material.dispose()}for(let C of r.lights){let U=new z(w,new lt({color:C.color,depthTest:!1}));U.userData.lightId=C.id,P.add(U)}}for(let C of P.children){let U=r.lights.find(re=>re.id===C.userData.lightId);U&&(C.position.set(U.x,U.y,U.z),C.material.color.set(U.color),C.scale.setScalar(U.id===r.selectedId?1.4:1))}y&&(b.position.set(y.x,y.y,y.z),A.position.set(y.targetX,0,y.targetZ),k.position.copy(A.position),D.geometry.dispose(),D.geometry=new ve().setFromPoints([b.position,A.position]),D.computeLineDistances());let T=s.mode==="lights"&&!d?.hidden;P.visible=T,k.visible=T&&!!y,D.visible=T&&!!y,T&&y?(E.attach(L==="position"?b:A),E.showY=L==="position"):E.detach(),document.querySelectorAll("[data-handle]").forEach(C=>C.classList.toggle("active",C.dataset.handle===L))}function B(){let h=Math.max(1,Math.round(innerWidth*s.resolution)),y=Math.max(1,Math.round(innerHeight*s.resolution));t.setPixelRatio(1),t.setSize(h,y,!1),u.resize(h,y),i.aspect=innerWidth/innerHeight,i.updateProjectionMatrix(),innerWidth>900&&!d?.hidden?i.setViewOffset(innerWidth,innerHeight,140,0,innerWidth,innerHeight):i.clearViewOffset(),Object.assign(M,{width:h,height:y})}function j(){g++,m=null,c.endMove(!0),l.cancel(),u.preview=null,d?.shapeIndicator(null),d?.shapeStatus(c.bodies.length,null),n.style.cursor=J()?"crosshair":"grab"}let J=()=>s.mode==="shapes"&&!p.get(s.shape);function Z(){let h=s.mode==="interact"&&!d?.hidden;o.mouseButtons.LEFT=h?null:De.ROTATE,o.touches.ONE=h?null:Le.ROTATE,o.enableRotate=d?.hidden||!J(),o.enablePan=o.enableRotate}function ee(h){if(h==="speed"&&s.speed===0&&j(),u.dirty=!0,h==="resolution"&&B(),h==="causticQuality"&&u.setCausticQuality(s.causticQuality),h==="floorDepth"){i.position.y=Math.max(-s.floorDepth+.15,i.position.y),o.target.y=Math.max(-s.floorDepth+.2,o.target.y);for(let y of c.bodies)y.suspended&&c.constrain(y,s.floorDepth);c.generation++}X()}function V(h){j(),s.mode=["navigate","disturb"].includes(h)?"interact":h,Z(),n.style.cursor=J()?"crosshair":"grab",X(),d?.update()}function ce(){let h=i.position.clone(),y=o.target.clone(),T=o.enableDamping;o.enableDamping=!1,o.update(),i.position.copy(h),o.target.copy(y),o.update(),o.enableDamping=T}function ze(h){j(),ce(),s.camera=h,h==="overhead"?(i.position.set(0,17,.01),o.target.set(0,0,0)):h==="underwater"?(i.position.set(0,-s.floorDepth*.48,6),o.target.set(0,-s.floorDepth*.4,-1)):(i.position.set(8,7.4,11.5),o.target.set(0,-.25,0)),o.update(),d?.update()}let ae={change:ee,mode:V,camera:ze,objectState(){let h=C=>`${p.get(C.kind)?.name??C.kind[0].toUpperCase()+C.kind.slice(1)} \xB7 ${C.id}`,y=c.selected,T=y?y.poseAngles??new rt().setFromQuaternion(y.rotation,"XYZ"):null;return{objects:c.bodies.map(C=>({id:C.id,name:h(C)})),selected:y?{id:y.id,name:h(y),...y.position,size:y.size,maxSize:p.get(y.kind)?3:1.5,suspended:!!y.suspended,tilt:T.x*180/Math.PI,turn:T.y*180/Math.PI,roll:T.z*180/Math.PI}:null}},selectObject(h){c.select(h),d.tab="objects",d.renderPanel()},objectPose(h){j(),c.pose(c.selectedId,h,s.floorDepth)&&(u.dirty=!0,d.syncObjects())},suspendObject(h){j(),c.setSuspended(c.selectedId,h),u.dirty=!0,d.syncObjects()},removeObject(){let h=c.selectedId;j(),c.remove(h),u.dirty=!0,d.syncObjects()},select(h){r.selectedId=h,X(),d.renderPanel()},add(){r.add()&&(u.dirty=!0,V("lights"),X(!0),d.renderPanel())},duplicate(){r.duplicate()&&(u.dirty=!0,X(!0),d.renderPanel())},remove(){r.remove(),u.dirty=!0,X(!0),d.renderPanel()},preset(h){j(),s.preset=h,r.preset(h),a.clear(),u.dirty=!0,X(!0),d.renderPanel(),d.update()},pause(){j(),s.paused=!s.paused,d.update()},handle(h){L=h,V("lights"),X()},clearRipples(){j(),a.clear(),u.dirty=!0,d.toast("Ripples cleared")},shape(h){j(),s.shape=h,V("shapes")},async uploadModel(h){if(v||!h)return null;j();let y=g;v=!0,d.modelStatus("Opening model\u2026",!0);try{let T=await _o(h,re=>d.modelStatus(re,!0)),C;try{C=p.add(T)}catch(re){throw $t(T),re}d.modelList(p.models),y===g&&!d.hidden&&(ae.shape(C.id),ae.addModel()),u.dirty=!0;let U=c.bodies.some(re=>re.kind===C.id);return d.modelStatus(`${C.name} \xB7 ${C.stats.triangles.toLocaleString()} triangles, original detail. ${U?"Move it in Interact.":"Ready to add when there is room and the water is running."}`),C}catch(T){return d.modelStatus(T.message||"Unable to open this model. Try another GLB, OBJ, or STL.",!1,!0),null}finally{v=!1}},addModel(){let h=p.get(s.shape);if(!h)return;if(s.paused||s.speed===0){d.toast("Resume water to add a model");return}j();let y={x:o.target.x,y:0,z:o.target.z},T=c.add(h.id,y,h.size??1.5,h);if(!T){d.modelStatus("Scene is full for this model. Remove objects or clear the scene to make room.",!1,!0);return}T.rotation.setFromAxisAngle(new _(0,1,0),(h.angle??0)*Math.PI/180),u.dirty=!0,d.modelStatus("Model added at full detail. Use Interact to move it.")},modelLighting(h){let y=p.get(s.shape);!y||!["studio","original"].includes(h)||(y.lighting=h,u.dirty=!0,d.update())},modelTransform(h,y){let T=p.get(s.shape);if(!T||!Number.isFinite(y))return;if(s.paused||s.speed===0){d.toast("Resume water to adjust the model");return}j(),T[h]=h==="size"?pe.clamp(y,.35,3):pe.clamp(y,-180,180);let C=c.bodies.findLast(U=>U.kind===T.id);C&&(h==="size"?c.resizeModel(C.id,T.size):(C.poseAngles=null,C.rotation.setFromAxisAngle(new _(0,1,0),T.angle*Math.PI/180),C.angularVelocity.set(0,0,0),c.generation++),C.suspended&&c.constrain(C,s.floorDepth)),u.dirty=!0},removeModel(){let h=s.shape;p.get(h)&&(j(),c.removeModel(h),p.remove(h),s.shape="sphere",d.modelList(p.models),d.modelStatus("Model and its copies removed."),d.update(),u.dirty=!0)},clearShapes(){j(),c.clear(),u.dirty=!0,d.shapeStatus(0,null),d.toast("Shapes cleared")},profile(){if(s.paused||s.speed===0){d.toast("Resume water before profiling");return}I={start:performance.now(),frames:0,width:M.width,height:M.height,lights:r.lights.filter(h=>h.enabled).length},document.querySelector("#profile-result").textContent="Measuring\u2026"},visibility(){j(),Z(),B(),X()}};d=new hi(s,r,ae),ze("surface"),B(),X(!0),V("interact"),E.addEventListener("dragging-changed",h=>{f=h.value,o.enabled=!f}),E.addEventListener("objectChange",()=>{let h=r.selected;if(!h)return;let y=T=>Math.round(pe.clamp(T,-10,10)*100)/100;L==="position"?(h.x=y(b.position.x),h.z=y(b.position.z),h.y=pe.clamp(b.position.y,.6,12)):(h.targetX=y(A.position.x),h.targetZ=y(A.position.z)),u.dirty=!0,X(),d.syncValues()});function ie(h){i.updateMatrixWorld();let y=n.getBoundingClientRect();R.set((h.clientX-y.left)/y.width*2-1,-(h.clientY-y.top)/y.height*2+1),x.setFromCamera(R,i)}let oe=()=>!s.paused&&s.speed>0&&!d.hidden;function Ie(h,y){a.add(h.x,h.z,u.time,s.brushSize,s.brushStrength,y,{y:h.y})&&(y||c.impulse(h.x,h.z,s.brushStrength),u.dirty=!0)}function Se(h){if(!h.moved)return;let y=h.latest,T=h.last,C=2*Math.PI*o.rotateSpeed/n.clientHeight,U=o.dampingFactor;o.enableDamping&&(o.dampingFactor=0),o.rotateLeft((y.clientX-T.clientX)*C),o.dampingFactor=U,o.rotateUp((y.clientY-T.clientY)*C),h.last=y,n.style.cursor="grabbing"}async function Ce(h,y,T){let C=g;ie(h);try{let U=await u.pick(x.ray.clone(),!T);U&&C===g&&oe()&&s.mode==="interact"&&(!T||m===y)&&Ie(U,T)}catch(U){console.warn("Water location unavailable",U)}}async function xe(h){ce();let y={clientX:h.clientX,clientY:h.clientY},T={pointerId:h.pointerId,kind:"pending",released:!1,moved:!1,start:y,last:y,latest:y};if(m=T,n.setPointerCapture(h.pointerId),h.shiftKey&&oe()){T.kind="brush",Ce(h,T,!1);return}let C=g;ie(h);let U=x.ray.clone(),re=i.getWorldDirection(new _);try{let ge=await u.pick(U,!0,!0);if(C!==g||d.hidden||s.mode!=="interact")return;if(ge?.bodyId!==void 0){if(T.released?m:m!==T)return;if(ae.selectObject(ge.bodyId),!oe()){T.kind="orbit",T.moved&&Se(T);return}if(T.released&&!T.moved)return;let Ro=ge.clone().sub(U.origin).dot(re)/U.direction.dot(re),Po=U.at(Ro,new _);c.beginMove(ge.bodyId,Po,re)&&(T.kind="shape",n.style.cursor="grabbing",T.moved&&Tt(T.latest)&&(ie(T.latest),c.move(x.ray,s.floorDepth)),T.released&&(c.endMove(),n.style.cursor="grab"))}else T.kind="orbit",T.hit=ge,T.released?!T.moved&&ge&&oe()?Ie(ge,!1):T.moved&&!m&&Se(T):m===T&&Se(T)}catch(ge){m===T&&(T.kind="orbit"),console.warn("Interaction location unavailable",ge)}}let Ye=0;async function To(h){if(!oe()||u.pickPending)return;let y=++Ye,T=g;ie(h);try{let C=await u.pick(x.ray.clone(),!1,!0);if(y!==Ye||T!==g||m||s.mode!=="interact")return;n.style.cursor=C?.bodyId!==void 0?"grab":"crosshair"}catch{}}function ki(h){!h||s.mode!=="shapes"||!oe()||(c.add(h.kind,h.hit,h.size,p.get(h.kind))||d.toast("Scene is full. Remove a model or clear shapes to make room."),u.dirty=!0,d.shapeStatus(c.bodies.length,null))}async function Ii(h){if(!h.picking){h.picking=!0;try{for(;l.pending.has(h);){let y=h.revision??0,T=h.ray,C=null;try{C=await u.pick(T,!0)}catch(U){console.warn("Drop location unavailable",U)}if(ki(l.resolve(h,C,y)),y===(h.revision??0))break}}finally{h.picking=!1}}}function Tt(h){let y=n.getBoundingClientRect();return h.clientX>=y.left&&h.clientX<=y.right&&h.clientY>=y.top&&h.clientY<=y.bottom}function Ci(h){let y=l.current;!y||y.pointerId!==h.pointerId||Tt(h)&&(y.screen.x===h.clientX&&y.screen.y===h.clientY||(y.screen={x:h.clientX,y:h.clientY},ie(h),y.ray=x.ray.clone(),l.relocate(y),Ii(y)))}function zo(h){if(p.get(s.shape))return;if(!oe()){d.toast("Resume the water to drop shapes");return}if(l.pending.size>=32)return;let y=l.begin(s.shape,performance.now()/1e3,h.pointerId);y&&(n.setPointerCapture(h.pointerId),ie(h),y.screen={x:h.clientX,y:h.clientY},y.ray=x.ray.clone(),Ii(y))}let Be=new Set;n.addEventListener("pointerdown",h=>{if(h.pointerType==="touch"&&(Be.add(h.pointerId),Be.size>1)){j();return}if(h.button!==0){(m||l.current)&&j();return}if(!d.hidden){if(s.mode==="shapes")zo(h);else if(s.mode==="interact")m||xe(h);else if(s.mode==="lights"&&!E.axis&&!f){ie(h);let y=x.intersectObjects([...P.children,k],!1);y[0]?.object===k?(L="aim",X()):y.length&&ae.select(y[0].object.userData.lightId)}}}),n.addEventListener("wheel",()=>{(m||l.current)&&j()},{capture:!0,passive:!0}),n.addEventListener("pointermove",h=>{if(!(Be.size>1)){if(s.mode==="shapes"){Ci(h);return}if(!(s.mode!=="interact"||d.hidden)){if(!m){To(h);return}m.pointerId!==h.pointerId||h.buttons!==1||(m.latest={clientX:h.clientX,clientY:h.clientY},Math.hypot(h.clientX-m.start.clientX,h.clientY-m.start.clientY)>6&&(m.moved=!0),m.kind==="shape"&&Tt(h)?(ie(h),c.move(x.ray,s.floorDepth),u.dirty=!0):m.kind==="orbit"?Se(m):m.kind==="brush"&&Ce(h,m,!0))}}}),n.addEventListener("pointerleave",()=>{Ye++,m||(n.style.cursor=J()?"crosshair":"grab")}),n.addEventListener("pointerup",h=>{Be.delete(h.pointerId),m?.pointerId===h.pointerId&&(m.latest={clientX:h.clientX,clientY:h.clientY},Math.hypot(h.clientX-m.start.clientX,h.clientY-m.start.clientY)>6&&(m.moved=!0),m.kind==="shape"?(m.moved&&Tt(h)&&(ie(h),c.move(x.ray,s.floorDepth)),c.endMove()):m.kind==="orbit"&&(m.moved?Se(m):m.hit&&oe()&&Ie(m.hit,!1)),m.released=!0,m=null,n.style.cursor=J()?"crosshair":"grab"),Ci(h),ki(l.release(h.pointerId,performance.now()/1e3)),d.shapeIndicator(null),n.hasPointerCapture(h.pointerId)&&n.releasePointerCapture(h.pointerId)}),n.addEventListener("pointercancel",h=>{Be.delete(h.pointerId),(m?.pointerId===h.pointerId||l.current?.pointerId===h.pointerId)&&j()}),n.addEventListener("lostpointercapture",h=>{(m?.pointerId===h.pointerId||l.current?.pointerId===h.pointerId)&&j()}),addEventListener("blur",()=>{Be.clear(),j()}),addEventListener("resize",B),addEventListener("keydown",h=>{if(!(h.target.closest?.("input,select,textarea")||h.metaKey||h.ctrlKey||h.altKey)){if(h.key==="Escape"){j();return}h.code==="Space"&&(h.preventDefault(),ae.pause()),h.key.toLowerCase()==="h"&&d.toggle(),h.key==="1"&&V("navigate"),h.key==="2"&&V("lights"),h.key==="3"&&V("disturb"),h.key==="4"&&V("shapes")}}),n.addEventListener("webglcontextlost",h=>{h.preventDefault(),t.setAnimationLoop(null),pi("The graphics context was interrupted. Reload to rebuild the water simulation.")}),document.addEventListener("visibilitychange",()=>{H=performance.now(),document.hidden&&(Be.clear(),j())}),t.setAnimationLoop(h=>{let y=Math.min((h-H)/1e3,.1);H=h,m?.kind!=="shape"&&o.update(),i.position.y=Math.max(-s.floorDepth+.1,i.position.y),u.preview=l.preview(h/1e3),d.shapeStatus(c.bodies.length,u.preview,Zt(c.bodies,p.get(s.shape)),p.get(s.shape)),d.syncObjects();let T=l.current;if(T?.screen&&(!T.resolved||T.hit)){let C=Kt(h/1e3-T.start),U=T.hit?-T.hit.clone().applyMatrix4(i.matrixWorldInverse).z:15,re=pe.clamp(C*n.clientHeight*i.projectionMatrix.elements[5]/(2*Math.max(.1,U)),18,240);d.shapeIndicator({...T.screen,kind:T.kind,size:C,pending:!T.resolved},re)}else d.shapeIndicator(null);try{u.render(y)}catch(C){t.setAnimationLoop(null),console.error(C),pi("Rendering was interrupted. Reload to rebuild the studio.");return}if(s.mode==="lights"&&!d.hidden&&(t.clearDepth(),t.render(S,i)),M.frames++,N++,I){I.frames++;let C=h-I.start;if(C>=1e4){let U=C/I.frames,re=`${I.lights} lights \xB7 ${I.width} \xD7 ${I.height} \xB7 ${(1e3/U).toFixed(1)} fps \xB7 ${U.toFixed(2)} ms/frame (10 s)`;M.lastProfile=re;let ge=document.querySelector("#profile-result");ge&&(ge.textContent=re),I=null}}h-q>1e3&&(M.frameMs=(h-q)/N,M.fps=1e3/M.frameMs,M.samples.push({time:h,ms:M.frameMs,lights:r.lights.filter(C=>C.enabled).length,width:M.width,height:M.height}),M.samples.length>120&&M.samples.shift(),d.stats(M.fps,M.frameMs,M.width,M.height),q=h,N=0)}),window.darkWater={settings:s,lights:r,ripples:a,shapes:c,drops:l,models:p,studio:u,camera:i,controls:o,metrics:M,actions:ae,ui:d,renderer:t,snapshot:()=>({settings:{...s},lights:r.lights.map(h=>({...h})),time:u.time,ripples:a.events.length,shapes:c.bodies.map(h=>({id:h.id,kind:h.kind,size:h.size,position:h.position.toArray(),velocity:h.velocity.toArray(),entered:h.entered})),pendingDrops:l.pending.size,metrics:{...M,samples:M.samples.slice(-15)}})}}
