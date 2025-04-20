import scene from "./three/scene.js";
import model from "./three/model.js";
import audio from "./three/audio.js";
import controls from "./three/controls.js";
import helper from "./three/helper.js";
import gui from "./editor/gui.js";
import progress from "./utils/progress.js";
import { clone, wait } from "./utils/utils.js";

const path = require("node:path");
const fs = require("node:fs");
const { writeDataFile } = require("./global/data.cjs");

/**********************************************/
/*                    model                   */
/**********************************************/

const dataMap = Object.fromEntries(global.dataList.map((data) => [data.resource, data]));

let curAnimationGroup, curAnimationGroupIndex, curAnimation;

let modelData, modelSize, anmDurationMap;
function loadModel(data) {
  curAnimationGroup = curAnimationGroupIndex = curAnimation = null;
  stopAnimation();
  stopVoice();

  modelData = data;
  modelSize = fs.statSync(data.resource).size;
  progress.show({ modal: true, text: "Loading..." });
  model.load(data.resource);
}

model.emitter.on("progress", ({ loaded }) => {
  const percent = ((loaded / modelSize) * 100).toFixed(2) + "%";
  progress.update({ value: loaded, max: modelSize, text: `Loading... (${percent})` });
});

model.emitter.on("loaded", (modelInfo) => {
  anmDurationMap = Object.fromEntries(modelInfo.animations.map(({ name, duration }) => [name, duration]));

  // Model
  gui.Model.setModel(modelInfo, modelData.animations);
  helper.gridY = model.shadowY;
  const animationCountMap = gui.Data.countAddedAnimations();
  gui.Model.setAnimationsAddedCount(animationCountMap);
  const modelCountMap = gui.Model.countAddedVoices(gui.Voices.getVoices());
  gui.Voices.setVoicesAddedCount("Model", modelCountMap);
  // Voices
  const dataCountMap = gui.Data.countAddedVoices(gui.Voices.getVoices());
  gui.Voices.setVoicesAddedCount("Data", dataCountMap);
  // Controls
  gui.Controls.setModel(modelInfo);
  // show panels
  gui.Voices.show();
  gui.Data.show();
  gui.Controls.show();
  progress.hide();
});

model.emitter.on("error", (error) => {
  console.error(error);
  progress.hide();
});

function playAnimation(animation) {
  curAnimation = animation;

  // update model
  model.setMeshes(animation.meshes);
  model.setStats(animation);
  helper.gridY = model.shadowY;

  // play model animation
  model.playAnimation(animation);
  progress.show({ fixed: true, text: "Loading..." });
}

function stopAnimation() {
  model.stopAnimation();
}

function stopVoice() {
  audio.stop();
}

function playAnimationWithVoice(animation) {
  playAnimation(animation);

  const { voice, voice_delay, voice_force, voice_repeat } = animation;

  if (curAnimationGroup) {
    // if playing animation group, don't interrupt playback of voice
    if ((curAnimationGroupIndex === 0 || !audio.isPlaying || voice_force) && voice) {
      audio.play(voice, voice_delay, voice_repeat);
    }
  } else {
    if (voice) audio.play(voice, voice_delay, voice_repeat);
    else if (animation.repeat !== Infinity) stopVoice();
  }
}

function playAnimationGroup(group) {
  curAnimationGroup = group;
  curAnimationGroupIndex = 0;
  playAnimationWithVoice(group[curAnimationGroupIndex]);
}

function getPlayingProgress() {
  if (model.isPlaying) {
    if (curAnimationGroup) return model.getTime(); // playing animation group
    if (!model.isLoopRepeat) return model.getTime(); // playing from Data panel
    if (audio.path === curAnimation.voice) return model.getTime(); // playing animation audio
    if (!audio.isPlaying) return model.getTime(); // no voice playing
  }
  if (audio.isPlaying) return audio.getTime();
  return { duration: 0, time: 0 };
}

model.emitter.on("started", (animation) => {
  gui.Model.onAnimationStarted(animation);
  gui.Data.onAnimationStarted(animation);
});

model.emitter.on("loop", () => {
  const { voice, voice_delay, voice_repeat } = curAnimation;
  if (voice && (!audio.path || audio.path === voice)) audio.play(voice, voice_delay, voice_repeat);
});

model.emitter.on("finished", async () => {
  await wait(curAnimation.pause * 1000);
  curAnimation = null;

  if (curAnimationGroup) {
    if (curAnimationGroupIndex < curAnimationGroup.length - 1) {
      const animation = curAnimationGroup[++curAnimationGroupIndex];
      playAnimationWithVoice(animation);
    } else {
      curAnimationGroup = null;
      stopVoice();
    }
  } else {
    stopVoice();
  }
  if (!curAnimationGroup || curAnimationGroupIndex >= curAnimationGroup.length) {
    gui.Model.onAnimationStopped();
    gui.Data.onAnimationStopped();
    if (!audio.isPlaying) progress.hide();
  }
});

model.emitter.on("stopped", () => {
  gui.Model.onAnimationStopped();
  gui.Data.onAnimationStopped();
});

/**********************************************/
/*                    audio                   */
/**********************************************/

audio.emitter.on("started", (voicePath) => {
  gui.Voices.onVoiceStarted(voicePath);
});

audio.emitter.on("ended", (voicePath) => {
  gui.Voices.onVoiceStopped();
  if (!model.isPlaying) progress.hide();
});

audio.emitter.on("stopped", (voicePath) => {
  gui.Voices.onVoiceStopped();
});

/**********************************************/
/*                  controls                  */
/**********************************************/

// transform controls attach to model container
controls.transformControls.attach(model.modelBox);

controls.emitter.on("transform", () => {
  const stats = model.getAnimationStats();
  model.setScale(stats.scale); // equal scaling
  helper.gridY = model.shadowY;
  gui.Controls.setStatsValue(stats);
});

const getCurAnimation = () => gui.Model.selectedAnimation || gui.Data.selectedAnimation;

/**********************************************/
/*                 Model panel                */
/**********************************************/

gui.Model.setModels(global.dataList.map((data) => data.name));
gui.Model.setModelName(global.settings.model);

function openModelByResource(resource) {
  const modelData = dataMap[resource];
  loadModel(modelData);
  gui.Voices.setModelData(modelData);
  gui.Data.setModelData(modelData);
}

function openModelByName(modelName) {
  const { resource } = Object.values(dataMap).find((data) => data.name === modelName);
  openModelByResource(resource);
}

setTimeout(() => {
  openModelByName(global.settings.model);
}, 0);

gui.Model.emitter.on("open-model", (modelData) => {
  const { name, resource } = modelData;
  if (!dataMap[resource]) {
    dataMap[resource] = modelData;
    /* update global */ global.dataList.push(modelData);
    const dataList = Object.values(dataMap);
    gui.Model.setModels(dataList.map((data) => data.name));
  }
  openModelByResource(resource);
  gui.Model.setModelName(name);
});

gui.Model.emitter.on("model-changed", (modelName) => {
  openModelByName(modelName);
});

gui.Model.emitter.on("play-animation", (animation) => {
  curAnimationGroup = null;
  stopAnimation();
  stopVoice();
  playAnimationWithVoice({ ...animation, repeat: Infinity, time: 0, duration: 0 });
  gui.Voices.setAddButtonsEnable(true);
  gui.Controls.applyAnimationData(animation, anmDurationMap[animation.name]);
  gui.Data.setSelectedAnimation(null);
});

gui.Model.emitter.on("add-animation", (animation) => {
  gui.Data.addAnimation(animation);
  gui.Model.setAnimationAddedCount(animation.name, 1);
  gui.Voices.setVoiceAddedCount("Data", animation.voice, 1);
});

/**********************************************/
/*                Voices panel                */
/**********************************************/

gui.Voices.emitter.on("play-voice", (voicePath) => {
  audio.play(voicePath, 0, false);
});

gui.Voices.emitter.on("set-voice", (voicePath) => {
  const animation = getCurAnimation();
  if (gui.Model.selectedAnimation) {
    gui.Voices.setVoiceAddedCount("Model", animation.voice, -1);
    gui.Voices.setVoiceAddedCount("Model", voicePath, 1);
    animation.voice = voicePath;
    gui.Model.updateAnimationVoiceStyle();
  }
  if (gui.Data.selectedAnimation) {
    gui.Voices.setVoiceAddedCount("Data", animation.voice, -1);
    gui.Voices.setVoiceAddedCount("Data", voicePath, 1);
    animation.voice = voicePath;
    gui.Data.updateAnimationVoiceStyle();
  }
  gui.Controls.setVoiceValue({ voice: voicePath, voice_delay: 0, voice_force: false, voice_repeat: false });
});

gui.Voices.emitter.on("resources-changed", () => {
  const modelCountMap = gui.Model.countAddedVoices(gui.Voices.getVoices());
  gui.Voices.setVoicesAddedCount("Model", modelCountMap);
  const dataCountMap = gui.Data.countAddedVoices(gui.Voices.getVoices());
  gui.Voices.setVoicesAddedCount("Data", dataCountMap);
});

/**********************************************/
/*                 Data panel                 */
/**********************************************/

gui.Data.emitter.on("play-animation-group", (group) => {
  playAnimationGroup(group);
});

gui.Data.emitter.on("play-animation", (animation) => {
  curAnimationGroup = null;
  stopVoice();
  playAnimationWithVoice(animation);
  gui.Voices.setAddButtonsEnable(true);
  gui.Controls.applyAnimationData(animation, anmDurationMap[animation.name]);
  gui.Model.setSelectedAnimation(null);
});

gui.Data.emitter.on("delete-animation", (animation) => {
  gui.Model.setAnimationAddedCount(animation.name, -1);
  gui.Voices.setVoiceAddedCount("Data", animation.voice, -1);
  if (!getCurAnimation()) {
    gui.Voices.setAddButtonsEnable(false);
    gui.Controls.applyAnimationData(null, 0);
  }
});

// function fix(group) {
//   group.forEach((anm) => {
//     if (typeof anm.mirror !== "boolean") anm.mirror = false;
//     if (typeof anm.voice_force !== "boolean") anm.voice_force = false;
//     if (typeof anm.voice_repeat !== "boolean") anm.voice_repeat = false;
//   });
// }

gui.Data.emitter.on("save-data", ({ enter, idle, groups }) => {
  const animations = gui.Model.getAnimations();
  const voices = gui.Voices.getVoices();

  /* fix */
  // fix(animations);
  // fix(enter);
  // fix(idle);
  // groups.forEach(fix);

  /* update global */
  const data = Object.assign(
    modelData,
    clone({
      animations,
      voices,
      enter,
      idle,
      groups,
    })
  );

  // write data file
  const dataFilePath = path.resolve(path.dirname(data.resource), `${data.name}.json`);
  writeDataFile(dataFilePath, data);
  alert("Data saved!");
});

/**********************************************/
/*               Controls panel               */
/**********************************************/

gui.Controls.init({
  Axes: helper.axesHelper.visible,
  Grid: helper.gridHelper.visible,
  OrbitEnable: controls.orbitControls.enabled,
  TransformEnable: controls.transformControls.enabled,
  TransformMode: controls.transformControls.mode,
});

gui.Controls.emitter.on("value-changed", (name, value) => {
  if (name === "Axes") helper.axesHelper.visible = value;
  else if (name === "Grid") helper.gridHelper.visible = value;
  else if (name === "OrbitEnable") controls.setOrbitEnable(value);
  else if (name === "TransformEnable") controls.setTransformEnable(value);
  else if (name === "TransformMode") controls.setTransformMode(value);
});

gui.Controls.emitter.on("reset-orbit", () => controls.orbitControls.reset());

gui.Controls.emitter.on("meshes-changed", (meshes) => {
  model.setMeshes(meshes);
  const animation = getCurAnimation();
  if (animation) animation.meshes = meshes;
});

gui.Controls.emitter.on("stats-changed", (stats) => {
  model.setStats(stats);
  helper.gridY = model.shadowY;
  const animation = getCurAnimation();
  if (animation) {
    const { mirror, scale, position, rotation } = stats;
    animation.mirror = mirror;
    animation.scale = scale;
    animation.position = position;
    animation.rotation = rotation;
  }
});

gui.Controls.emitter.on("other-changed", ({ repeat, time, duration, pause }) => {
  const animation = getCurAnimation();
  if (animation) {
    Object.assign(animation, { repeat, time, duration, pause });
    if (gui.Model.selectedAnimation) gui.Model.updateAnimationRepeatStyle();
    if (gui.Data.selectedAnimation) gui.Data.updateAnimationRepeatStyle();
  }
});

gui.Controls.emitter.on("voice-changed", ({ voice, voice_delay, voice_force, voice_repeat }) => {
  const animation = getCurAnimation();
  if (animation) {
    animation.voice = voice;
    animation.voice_delay = voice_delay;
    animation.voice_force = voice_force;
    animation.voice_repeat = voice_repeat;
  }
});

gui.Controls.emitter.on("clear-voice", () => {
  const animation = getCurAnimation();
  if (gui.Model.selectedAnimation) {
    gui.Voices.setVoiceAddedCount("Model", animation.voice, -1);
    animation.voice = "";
    animation.voice_delay = 0;
    gui.Model.updateAnimationVoiceStyle();
  }
  if (gui.Data.selectedAnimation) {
    gui.Voices.setVoiceAddedCount("Data", animation.voice, -1);
    animation.voice = "";
    animation.voice_delay = 0;
    gui.Data.updateAnimationVoiceStyle();
  }
});

/**********************************************/
/*                 render loop                */
/**********************************************/

function render() {
  requestAnimationFrame(render);
  model.update();
  scene.update();
  helper.update();

  if (model.isPlaying || audio.isPlaying) {
    const { time: value, duration: max } = getPlayingProgress();
    const text = `Duration: ${max.toFixed(3)}s`;
    if (max) progress.update({ fixed: true, max, value, text });
    else if (!model.isLoopRepeat) progress.hide();
  }
}
render();
