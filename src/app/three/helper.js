/**
 * AxesHelper & GridHelper & Stats
 */
import * as THREE from "three";
// import Stats from "three/addons/libs/stats.module.js";
import scene from "../three/scene.js";

// AxesHelper
const axesHelper = new THREE.AxesHelper(100);
axesHelper.visible = false;
scene.scene.add(axesHelper);

// GridHelper
const gridHelper = new THREE.GridHelper(10, 100, 0xcccccc, 0xeeeeee);
gridHelper.visible = true;
scene.scene.add(gridHelper);

// Stats
// const stats = new Stats();
// document.body.appendChild(stats.dom);
// stats.dom.classList.add("nw-drag-enable");

export default {
  axesHelper,
  gridHelper,
  set gridY(y) {
    gridHelper.position.y = y;
  },
  update() {
    // update stats
    // stats.update();
  },
};
