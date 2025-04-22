import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { createEmitter } from "../utils/utils.js";

const path = require("node:path");

const emitter = createEmitter();

const Controls = new GUI({ title: "Controls" });
Controls.domElement.style.cssText = "right: 0; display: none;";

/**********************************************/
/*                  Controls                  */
/**********************************************/

// Helper
const helper = {
  Axes: true,
  Grid: true,
};
const HelperFolder = Controls.addFolder("Helper").close();
HelperFolder.add(helper, "Axes").listen();
HelperFolder.add(helper, "Grid").listen();

// Orbit Controls
const orbit = {
  Enable: true,
  Reset: () => emitter.emit("reset-orbit"),
};
const OrbitFolder = Controls.addFolder("Orbit Controls").close();
OrbitFolder.add(orbit, "Enable").listen();
OrbitFolder.add(orbit, "Reset");

// Transform Controls
const transform = {
  Enable: true,
  Scale: () => activateTransformMode("scale"),
  Translate: () => activateTransformMode("translate"),
  Rotate: () => activateTransformMode("rotate"),
};
const TransformFolder = Controls.addFolder("Transform Controls").close();
TransformFolder.add(transform, "Enable").listen();
const tmcMap = {
  scale: TransformFolder.add(transform, "Scale"),
  translate: TransformFolder.add(transform, "Translate"),
  rotate: TransformFolder.add(transform, "Rotate"),
};
function activateTransformMode(mode) {
  emitter.emit("value-changed", "TransformMode", mode);
  Object.values(tmcMap).forEach((tmc) => tmc.enable());
  tmcMap[mode].disable();
}

/**********************************************/
/*                   Meshes                   */
/**********************************************/

const MeshesFolder = Controls.addFolder("Animation Meshes");

let meshes;
function setModel({ meshes: modelMeshes }) {
  reset();

  // ["a", "b"] -> { a: true, b: true }
  meshes = Object.fromEntries(modelMeshes.map((name) => [name, true]));
  modelMeshes.forEach((name) => {
    MeshesFolder.add(meshes, name).listen();
  });
}

function setMeshesValue(visibleMeshes) {
  Object.keys(meshes).forEach((name) => {
    meshes[name] = !visibleMeshes || visibleMeshes.length === 0 || visibleMeshes.includes(name);
  });
}

function getMeshesValue() {
  return Object.keys(meshes).filter((name) => meshes[name]);
}

/**********************************************/
/*               Animation Stats              */
/**********************************************/

const stats = {
  Mirror: false,
  Scale: 1,
  X: 0,
  Y: 0,
  Z: 0,
  RotationX: 0,
  RotationY: 0,
  RotationZ: 0,
  Reset() {
    setStatsValue({});
    emitter.emit("stats-changed", getStatsValue());
  },
};
const StatsFolder = Controls.addFolder("Animation Stats");
for (let property in stats) {
  if (property === "Scale") StatsFolder.add(stats, property, 0.1, 10, 0.01).listen();
  else if (property.startsWith("Rotation")) StatsFolder.add(stats, property, -180, 180, 1).listen();
  else StatsFolder.add(stats, property).listen();
}

function getStatsValue() {
  const { Mirror, Scale, X, Y, Z, RotationX, RotationY, RotationZ } = stats;
  return {
    is_mirror: Mirror,
    scale: Scale,
    position: [X, Y, Z],
    rotation: [RotationX, RotationY, RotationZ],
  };
}

function setStatsValue({ is_mirror = false, scale = 1, position = [0, 0, 0], rotation = [0, 0, 0] }) {
  stats.Mirror = is_mirror;
  stats.Scale = scale;
  [stats.X, stats.Y, stats.Z] = position;
  [stats.RotationX, stats.RotationY, stats.RotationZ] = rotation;
}

/**********************************************/
/*              Animation Action              */
/**********************************************/

const action = {
  "Repeat": 1,
  "Start Time (s)": 0,
  "End Time (s)": 0,
  "Time Scale": 1,
  "Delay (s)": 0,
  "Reset"() {
    setActionValue({}, animationDuration);
    emitter.emit("action-changed", getActionValue());
  },
};
const ActionFolder = Controls.addFolder("Animation Action");
const ActionDelayCtrl = ActionFolder.add(action, "Delay (s)", 0, 10, 0.001).listen().disable();
const ActionStartCtrl = ActionFolder.add(action, "Start Time (s)", 0, 1, 0.001).listen().disable();
const ActionEndCtrl = ActionFolder.add(action, "End Time (s)", 0, 1, 0.001).listen().disable();
const ActionScaleCtrl = ActionFolder.add(action, "Time Scale", 0, 10, 0.001).listen().disable();
const ActionRepeatCtrl = ActionFolder.add(action, "Repeat", 1, 10, 1).listen().disable();
const ActionResetCtrl = ActionFolder.add(action, "Reset").disable();

const ActionCtrls = [ActionDelayCtrl, ActionStartCtrl, ActionEndCtrl, ActionScaleCtrl, ActionRepeatCtrl, ActionResetCtrl];

let animationDuration;
function setActionValue({ repeat = 1, delay = 0, start_time = 0, end_time = 0, time_scale = 1 }, duration = 0) {
  animationDuration = duration;

  const enabled = duration > 0 ? "enable" : "disable";
  ActionCtrls.forEach((ctrl) => ctrl[enabled]());
  ActionStartCtrl.max(duration || 1);
  ActionEndCtrl.max(duration || 1);

  Object.assign(action, {
    "Delay (s)": delay,
    "Start Time (s)": start_time,
    "End Time (s)": end_time ? end_time : duration,
    "Time Scale": time_scale,
    "Repeat": repeat,
  });
}

function getActionValue() {
  return {
    delay: action["Delay (s)"],
    start_time: action["Start Time (s)"],
    end_time: action["End Time (s)"],
    time_scale: action["Time Scale"],
    repeat: action["Repeat"],
  };
}

/**********************************************/
/*               Animation Voice              */
/**********************************************/

const voice = {
  "_Resource": "", // not show, just cache
  "Resource": "",
  "Delay (s)": 0,
  "Start Time (s)": 0,
  "End Time (s)": 0,
  "Force": false,
  "Repeat": true,
  "Clear"() {
    emitter.emit("clear-voice", voice.Path);
    setVoiceValue({}, 0);
  },
};
const VoiceFolder = Controls.addFolder("Animation Voice");
const VoiceResourceCtrl = VoiceFolder.add(voice, "Resource").listen().disable();
const VoiceDelayCtrl = VoiceFolder.add(voice, "Delay (s)", 0, 10, 0.001).listen().disable();
const VoiceStartCtrl = VoiceFolder.add(voice, "Start Time (s)", 0, 1, 0.001).listen().disable();
const VoiceEndCtrl = VoiceFolder.add(voice, "End Time (s)", 0, 1, 0.001).listen().disable();
const VoiceForceCtrl = VoiceFolder.add(voice, "Force").listen().disable();
const VoiceRepeatCtrl = VoiceFolder.add(voice, "Repeat").listen().disable();
const VoiceClearCtrl = VoiceFolder.add(voice, "Clear").disable();

const VoiceCtrls = [VoiceDelayCtrl, VoiceStartCtrl, VoiceEndCtrl, VoiceForceCtrl, VoiceRepeatCtrl, VoiceClearCtrl];

function setVoiceValue({ resource = "", delay = 0, start_time = 0, end_time = 0, is_force = false, is_repeat = false }, duration = 0) {
  const enabled = resource ? "enable" : "disable";
  VoiceCtrls.forEach((ctrl) => ctrl[enabled]());
  VoiceStartCtrl.max(duration || 1);
  VoiceEndCtrl.max(duration || 1);

  Object.assign(voice, {
    "_Resource": resource,
    "Resource": path.basename(resource),
    "Delay (s)": delay,
    "Start Time (s)": start_time,
    "End Time (s)": end_time ? end_time : duration,
    "Force": is_force,
    "Repeat": is_repeat,
  });
}

function getVoiceValue() {
  return {
    resource: voice["_Resource"],
    delay: voice["Delay (s)"],
    start_time: voice["Start Time (s)"],
    end_time: voice["End Time (s)"],
    is_force: voice["Force"],
    is_repeat: voice["Repeat"],
  };
}

/**********************************************/
/*                value changed               */
/**********************************************/

Controls.onChange(({ object, property, value }) => {
  if (object === helper) emitter.emit("value-changed", property, value);
  else if (object === orbit) emitter.emit("value-changed", "OrbitEnable", value);
  else if (object === transform) emitter.emit("value-changed", "TransformEnable", value);
  else if (object === meshes) emitter.emit("meshes-changed", getMeshesValue());
  else if (object === stats) emitter.emit("stats-changed", getStatsValue());
  else if (object === action) emitter.emit("action-changed", getActionValue());
  else if (object === voice) emitter.emit("voice-changed", getVoiceValue());
});

/**********************************************/
/*                  shortcut                  */
/**********************************************/

// function toggleValue(object, key, property) {
//   object[key] = !object[key];
//   emitter.emit("value-changed", property, object[key]);
// }

// window.addEventListener("keydown", (e) => {
//   if (e.repeat || !meshes) return;
//   const KEY = e.key.toUpperCase();
//   if (KEY === "A") toggleValue(helper, "Axes", "Axes");
//   else if (KEY === "G") toggleValue(helper, "Grid", "Grid");
//   else if (KEY === "O") toggleValue(orbit, "Enable", "OrbitEnable");
//   else if (e.altKey && KEY === "S") transform.Scale();
//   else if (e.altKey && KEY === "T") transform.Translate();
//   else if (e.altKey && KEY === "R") transform.Rotate();
//   else if (KEY === "T") toggleValue(transform, "Enable", "TransformEnable");
//   else if (e.ctrlKey && KEY === "R") stats.Reset();
// });

/**********************************************/
/*                   exports                  */
/**********************************************/

function reset() {
  meshes = null;
  while (MeshesFolder.controllers.length > 0) MeshesFolder.controllers[0].destroy();
  resetValues();
}

function resetValues() {
  setStatsValue({});
  setVoiceValue({}, 0);
  setActionValue({}, 0);
}

function applyAnimationData(animation, animationDuration, voiceDuration) {
  if (animation) {
    setMeshesValue(animation.meshes);
    setStatsValue(animation.stats);
    setActionValue(animation.action, animationDuration);
    setVoiceValue(animation.voice, voiceDuration);
  } else {
    resetValues();
  }
}

export default {
  emitter,
  show() {
    Controls.domElement.style.display = "";
  },
  init(data) {
    helper.Axes = data.Axes;
    helper.Grid = data.Grid;
    orbit.Enable = data.OrbitEnable;
    transform.Enable = data.TransformEnable;
    activateTransformMode(data.TransformMode);
  },
  setModel,

  setMeshesValue,
  getMeshesValue,

  setStatsValue,
  getStatsValue,

  setVoiceValue,
  getVoiceValue,

  setActionValue,
  getActionValue,

  applyAnimationData,
};
