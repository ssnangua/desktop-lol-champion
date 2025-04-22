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
let model;
let meshesMap; // { [mesh.material.name]: mesh }
let animationsMap; // { [animation.name]: animation }
let nScale;
let mixer;
let playingAnimation, playingClip, playingAction;

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
  meshesMap = {};
  animationsMap = {};

  // meshes
  model.scene.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      child.castShadow = true;
      meshesMap[child.material.name] = child;
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

  setStats({});

  // add to model container
  while (modelBox.children.length > 0) modelBox.remove(modelBox.children[0]);
  modelBox.add(model.scene);

  // animations
  mixer = new THREE.AnimationMixer(model.scene);
  model.animations.forEach((animation) => {
    animationsMap[animation.name] = animation;
  });
  // mixer.addEventListener("loop", (e) => {
  //   emitter.emit("loop", playingAnimation);
  // });
  mixer.addEventListener("finished", (e) => {
    const animation = playingAnimation;
    if (_isInfinity) {
      playAnimation(animation, _isInfinity);
      emitter.emit("loop", animation);
    } else {
      playingAnimation = playingClip = playingAction = null;
      emitter.emit("finished", animation);
    }
  });

  emitter.emit("loaded", {
    meshes: Object.keys(meshesMap),
    animations: Object.keys(animationsMap),
  });
}

function onProgress({ loaded, total }) {
  emitter.emit("progress", { loaded, total });
}

function onError(error) {
  emitter.emit("error", error);
}

// set meshes visible
function setMeshes(names) {
  Object.keys(meshesMap).forEach((mesh) => {
    meshesMap[mesh].visible = !names || names.length === 0 || names.includes(mesh);
  });
}

// set model stats
function setStats({ is_mirror = false, scale = 1, position = [0, 0, 0], rotation = [0, 0, 0] }) {
  // equal scaling
  const s = scale * nScale;
  modelBox.scale.set(s * (is_mirror ? -1 : 1), s, s);
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
let _isInfinity = false;
function playAnimation(animation, isInfinity) {
  stopAnimation();

  let { delay = 0, start_time = 0, end_time = 0, time_scale = 1, repeat = 1 } = animation.action;
  _isInfinity = isInfinity;

  const clip = model.animations.find((clip) => clip.name === animation.name);
  if (end_time === 0 || end_time > clip.duration) end_time = clip.duration; // end time
  if (start_time > end_time) start_time = 0; // start time
  const subclip = THREE.AnimationUtils.subclip(clip, `${animation.name}_sub`, start_time, end_time, true); // duration

  const action = mixer.clipAction(subclip);
  action.reset();
  action.clampWhenFinished = true;
  action.startAt(mixer.time + delay); // delay
  action.setEffectiveTimeScale(time_scale || 1); // time scale
  action.setLoop(THREE.LoopRepeat, _isInfinity ? 1 : repeat); // repeat
  action.play();

  playingAnimation = animation;
  playingClip = subclip;
  playingAction = action;
  emitter.emit("started", playingAnimation);
}

// stop animation
function stopAnimation() {
  mixer?.stopAllAction();
  if (playingAnimation) {
    const animation = playingAnimation;
    playingAnimation = playingClip = playingAction = null;
    emitter.emit("stopped", animation);
  }
}

export default {
  emitter,
  load,
  getAnimationDuration(name) {
    return animationsMap[name].duration;
  },
  setMeshes,
  get modelBox() {
    return modelBox;
  },
  getAnimationStats() {
    const { is_mirror } = playingAnimation.stats;
    const scale = Math.round((modelBox.scale.y / nScale) * 100) / 100;
    const x = Math.round(modelBox.position.x / nScale);
    const y = Math.round(modelBox.position.y / nScale);
    const z = Math.round(modelBox.position.z / nScale);
    const r2a = 180 / Math.PI;
    let rx = Math.round(modelBox.rotation.x * r2a);
    let ry = Math.round(modelBox.rotation.y * r2a);
    let rz = Math.round(modelBox.rotation.z * r2a);
    return { is_mirror, scale, position: [x, y, z], rotation: [rx, ry, rz] };
  },
  setStats,
  setScale,
  get shadowY() {
    return shadow.position.y;
  },

  playAnimation,
  stopAnimation,
  get isPlaying() {
    return !!playingAnimation;
  },
  get isInfinity() {
    return _isInfinity;
  },
  get isPaused() {
    return playingAction.paused;
  },
  togglePaused() {
    playingAction.paused = !playingAction.paused;
    return playingAction.paused;
  },
  get duration() {
    return playingClip?.duration || 0;
  },
  get time() {
    return playingAction?.time || 0;
  },
  get timeInfo() {
    return { name: playingAnimation.name, duration: this.duration, time: this.time };
  },

  update() {
    if (mixer) {
      const delta = clock.getDelta();
      mixer.update(delta);
    }
  },
};
