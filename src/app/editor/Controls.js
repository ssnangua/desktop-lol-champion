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
  Scale: 1,
  X: 0,
  Y: 0,
  Z: 0,
  RotationX: 0,
  RotationY: 0,
  RotationZ: 0,
  Reset() {
    const stats = { scale: 1, position: [0, 0, 0], rotation: [0, 0, 0] };
    setStatsValue(stats);
    emitter.emit("stats-changed", stats);
  },
};
const StatsFolder = Controls.addFolder("Animation Stats");
for (let property in stats) {
  if (property === "Scale") StatsFolder.add(stats, property, 0.1, 10, 0.01).listen();
  else if (property.startsWith("Rotation")) StatsFolder.add(stats, property, -180, 180, 1).listen();
  else StatsFolder.add(stats, property).listen();
}

function getStatsValue() {
  const { Scale, X, Y, Z, RotationX, RotationY, RotationZ } = stats;
  return { scale: Scale, position: [X, Y, Z], rotation: [RotationX, RotationY, RotationZ] };
}

function setStatsValue({ scale, position, rotation }) {
  stats.Scale = scale;
  [stats.X, stats.Y, stats.Z] = position;
  [stats.RotationX, stats.RotationY, stats.RotationZ] = rotation;
}

/**********************************************/
/*          Other Animation Settings          */
/**********************************************/

const other = {
  "Repeat": 1,
  "Time (s)": 0,
  "Duration (s)": 0,
  "Pause (s)": 0,
};
const otherFolder = Controls.addFolder("Other Animation Settings");
const RepeatController = otherFolder.add(other, "Repeat", 1, 10, 1).listen().disable();
const TimeController = otherFolder.add(other, "Time (s)", 0, 1, 0.001).listen().disable();
const DurationController = otherFolder.add(other, "Duration (s)", 0, 1, 0.001).listen().disable();
const PauseController = otherFolder.add(other, "Pause (s)", 0, 10, 0.001).listen().disable();

function setOtherValue({ repeat, time, duration, pause }, anmDuration) {
  if (anmDuration > 0) {
    RepeatController.enable();
    TimeController.max(anmDuration).enable();
    DurationController.max(anmDuration).enable();
    PauseController.enable();
  } else {
    RepeatController.disable();
    TimeController.max(1).disable();
    DurationController.max(1).disable();
    PauseController.disable();
  }
  Object.assign(other, {
    "Repeat": repeat,
    "Time (s)": time,
    "Duration (s)": duration ? duration : anmDuration,
    "Pause (s)": pause,
  });
}

function getOtherValue() {
  return {
    repeat: other.Repeat,
    time: other["Time (s)"],
    duration: other["Duration (s)"],
    pause: other["Pause (s)"],
  };
}

/**********************************************/
/*               Animation Voice              */
/**********************************************/

const voice = {
  "Path": "", // not show, just cache
  "Voice": "",
  "Delay (s)": 0,
  "Clear"() {
    emitter.emit("clear-voice", voice.Path);
    setVoiceValue({ voice: "", voice_delay: 0 });
  },
};
const VoiceFolder = Controls.addFolder("Animation Voice");
const VoiceController = VoiceFolder.add(voice, "Voice").listen().disable();
const DelayController = VoiceFolder.add(voice, "Delay (s)").listen().disable();
const ClearVoiceController = VoiceFolder.add(voice, "Clear").disable();

function setVoiceValue({ voice: voicePath, voice_delay }) {
  Object.assign(voice, {
    "Path": voicePath,
    "Voice": path.basename(voicePath),
    "Delay (s)": voice_delay,
  });

  DelayController[voicePath ? "enable" : "disable"]();
  ClearVoiceController[voicePath ? "enable" : "disable"]();
}

function getVoiceValue() {
  return { voice: voice.Path, voice_delay: voice["Delay (s)"] };
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
  else if (object === other) emitter.emit("other-changed", getOtherValue());
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
  // Stats
  setStatsValue({ scale: 1, position: [0, 0, 0], rotation: [0, 0, 0] });
  // Voice
  setVoiceValue({ voice: "", voice_delay: 0 });
  // Other Settings
  setOtherValue({ repeat: 1, time: 0, duration: 0, pause: 0 }, 0);
}

function applyAnimationData(animation, anmDuration) {
  if (animation) {
    const { meshes, scale, position, rotation, repeat, time, duration, pause, voice, voice_delay } = animation;
    setMeshesValue(meshes);
    setStatsValue({ scale, position, rotation });
    setVoiceValue({ voice, voice_delay });
    setOtherValue({ repeat, time, duration, pause }, anmDuration);
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

  setOtherValue,
  getOtherValue,

  applyAnimationData,
};
