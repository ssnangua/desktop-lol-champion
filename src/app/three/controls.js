/**
 * OrbitControls & TransformControls
 */
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { createEmitter } from "../utils/utils.js";
import scene from "../three/scene.js";

const emitter = createEmitter();

// OrbitControls
const orbitControls = new OrbitControls(scene.camera, scene.renderer.domElement);
orbitControls.enableRotate = true;
orbitControls.enablePan = false;
orbitControls.enableZoom = false;

// TransformControls
const transformControls = new TransformControls(scene.camera, scene.renderer.domElement);
transformControls.addEventListener("objectChange", () => {
  emitter.emit("transform");
});
transformControls.addEventListener("dragging-changed", (event) => {
  orbitControls.enabled = orbitEnable && !event.value;
});

const transformHelper = transformControls.getHelper();

let orbitEnable = false;
let transformEnable = false;
function setOrbitEnable(enable) {
  orbitEnable = enable;
  orbitControls.enabled = enable;
}
function setTransformEnable(enable) {
  transformEnable = enable;
  scene.scene[enable ? "add" : "remove"](transformHelper);
  transformControls.enabled = enable;
}
function setTransformMode(mode) {
  transformControls.mode = mode;
  transformControls.showX = mode !== "scale";
  transformControls.showY = true;
  transformControls.showZ = mode !== "scale";
}

// initial
setOrbitEnable(orbitEnable);
setTransformEnable(transformEnable);
setTransformMode("scale");

export default { emitter, orbitControls, transformControls, setOrbitEnable, setTransformEnable, setTransformMode };
