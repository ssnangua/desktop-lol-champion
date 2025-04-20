/**
 * GLTF model loader & animation player
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createEmitter, pathToURL } from "../utils/utils.js";
import scene from "./scene.js";

const emitter = createEmitter();

// model container
const modelBox = new THREE.Object3D();
scene.scene.add(modelBox);

// shadow
const plane = new THREE.PlaneGeometry(100, 100);
plane.rotateX(-Math.PI / 2);
const material = new THREE.ShadowMaterial();
material.opacity = 0.2;
const shadow = new THREE.Mesh(plane, material);
shadow.receiveShadow = true;
// shadow.position.y = -0.5;
scene.scene.add(shadow);

// Clock
const clock = new THREE.Clock();

// GLTFLoader
const loader = new GLTFLoader();

// model
let model, meshes, animations;
let material_mesh;
let nScale;
let mixer;
let playingAnimation, playingAction;

// load model

function load(resource) {
  if (model) {
    mixer.stopAllAction();
    model.scene.removeFromParent();
  }
  loader.load(pathToURL(resource), onLoad, onProgress, onError);
}

function onLoad(gltf) {
  model = gltf;

  // meshes
  meshes = [];
  material_mesh = {};
  model.scene.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      child.castShadow = true;
      material_mesh[child.material.name] = child.name;
      meshes.push(child.material.name);
    }
  });

  // model initial state
  const box = new THREE.Box3().setFromObject(model.scene);
  const size = box.getSize(new THREE.Vector3());
  nScale = 1 / size.y; // normalize scale
  const center = box.getCenter(new THREE.Vector3());
  // model.scene.position.x += model.scene.position.x - center.x;
  model.scene.position.y += model.scene.position.y - center.y;
  // model.scene.position.z += model.scene.position.z - center.z;

  setStats({ mirror: false, scale: 1, position: [0, 0, 0], rotation: [0, 0, 0] });

  // add to model container
  while (modelBox.children.length > 0) modelBox.remove(modelBox.children[0]);
  modelBox.add(model.scene);

  // animations
  mixer = new THREE.AnimationMixer(model.scene);
  animations = model.animations.map((animation) => {
    mixer.clipAction(animation);
    return { name: animation.name, duration: animation.duration };
  });
  mixer.addEventListener("loop", (e) => {
    emitter.emit("loop", playingAnimation);
  });
  mixer.addEventListener("finished", (e) => {
    const animation = playingAnimation;
    playingAnimation = playingAction = null;
    emitter.emit("finished", animation);
  });

  emitter.emit("loaded", { meshes, animations });
}

function onProgress({ loaded, total }) {
  emitter.emit("progress", { loaded, total });
}

function onError(error) {
  emitter.emit("error", error);
}

// set meshes visible
function setMeshes(names) {
  meshes.forEach((mesh) => {
    const meshObject = scene.scene.getObjectByName(material_mesh[mesh]);
    meshObject.visible = !names || names.length === 0 || names.includes(mesh);
  });
}

// set model stats
function setStats({ mirror, scale, position, rotation }) {
  // equal scaling
  const s = scale * nScale;
  modelBox.scale.set(s * (mirror ? -1 : 1), s, s);
  // position
  const [x, y, z] = position;
  modelBox.position.set(x * nScale, y * nScale, z * nScale);
  // rotation
  const [rx, ry, rz] = rotation;
  const a2r = Math.PI / 180;
  modelBox.rotation.set(rx * a2r, ry * a2r, rz * a2r);
  // shadow position
  // shadow.position.set(0, 0.5 * scale, 0); // fixed position
  shadow.position.set(0, y * nScale - 0.5 * scale, 0); // follow the model
}

function setScale(scale) {
  // equal scaling
  const s = scale * nScale;
  modelBox.scale.set(s, s, s);
  // shadow position
  shadow.position.set(0, -0.5 * scale, 0);
}

// play animation
function playAnimation(animation) {
  stopAnimation();
  let { name, time, duration, repeat } = animation;
  const clip = model.animations.find((animation) => animation.name === name);
  mixer.stopAllAction();
  const action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(THREE.LoopRepeat, repeat || Infinity);
  if (duration === 0 || duration > clip.duration) duration = clip.duration;
  if (time > duration) time = 0;
  action.clampWhenFinished = true;
  action.time = time;
  action.setDuration(clip.duration - action.time);
  action.play();
  playingAnimation = animation;
  playingAction = action;
  emitter.emit("started", playingAnimation);
}

// stop animation
function stopAnimation() {
  if (!playingAnimation) return;
  const animation = playingAnimation;
  playingAnimation = playingAction = null;
  mixer.stopAllAction();
  emitter.emit("stopped", animation);
}

export default {
  emitter,
  get isPlaying() {
    return !!playingAnimation;
  },
  get modelBox() {
    return modelBox;
  },
  getAnimationStats() {
    const scale = Math.round((modelBox.scale.y / nScale) * 100) / 100;
    const x = Math.round(modelBox.position.x / nScale);
    const y = Math.round(modelBox.position.y / nScale);
    const z = Math.round(modelBox.position.z / nScale);
    const r2a = 180 / Math.PI;
    let rx = Math.round(modelBox.rotation.x * r2a);
    let ry = Math.round(modelBox.rotation.y * r2a);
    let rz = Math.round(modelBox.rotation.z * r2a);
    return { scale, position: [x, y, z], rotation: [rx, ry, rz] };
  },
  setStats,
  setScale,
  get shadowY() {
    return shadow.position.y;
  },
  load,
  setMeshes,
  playAnimation,
  stopAnimation,
  get isLoopRepeat() {
    return playingAnimation.repeat === Infinity;
  },
  get isPaused() {
    return playingAction.paused;
  },
  togglePaused() {
    playingAction.paused = !playingAction.paused;
    return playingAction.paused;
  },
  getTime() {
    return { duration: playingAction._clip.duration, time: playingAction.time };
  },
  update() {
    if (mixer) {
      const delta = clock.getDelta();
      mixer.update(delta);
    }
  },
};
