/**
 * scene (camera, renderer, light)
 */
import * as THREE from "three";

const size = 400;

// Scene
const scene = new THREE.Scene();

// PerspectiveCamera
// const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
camera.position.set(0, 0.5, 1.5);
camera.lookAt(scene.position);
// camera.lookAt(new THREE.Vector3(0, 1, 0));

// WebGLRenderer
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
// renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setSize(size, size);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// DirectionalLight
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 10, 0);
light.castShadow = true;
scene.add(light);
// const helper = new THREE.CameraHelper(light.shadow.camera);
// scene.add(helper);

window.addEventListener("resize", () => {
  // camera.aspect = window.innerWidth / window.innerHeight;
  // camera.updateProjectionMatrix();
  // renderer.setSize(window.innerWidth, window.innerHeight);
});

export default {
  scene,
  camera,
  renderer,
  light,
  capture() {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  },
  update() {
    renderer.render(scene, camera);
  },
};
