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

let modelData, modelSize;
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

function playAnimation(animation, isInfinity) {
  curAnimation = animation;

  // update model
  model.setMeshes(animation.meshes);
  model.setStats(animation.stats);
  helper.gridY = model.shadowY;

  // play model animation
  model.playAnimation(animation, isInfinity);
  progress.show({ fixed: true, text: "Loading..." });
}

function stopAnimation() {
  model.stopAnimation();
}

function stopVoice() {
  audio.stop();
}

function playAnimationWithVoice(animation, isInfinity) {
  // play animation
  playAnimation(animation, isInfinity);

  // play voice
  const { resource, is_force } = animation.voice;
  if (curAnimationGroup) {
    // if playing animation group, don't interrupt playback of voice
    if (resource && (curAnimationGroupIndex === 0 || !audio.isPlaying || is_force)) {
      audio.play(animation.voice);
    }
  } else {
    if (resource) audio.play(animation.voice);
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
    if (
      // curAnimationGroup || // playing animation group
      // !model.isInfinity || // playing from Data panel
      audio.resource === curAnimation?.voice.resource || // playing animation audio
      !audio.isPlaying // no voice playing
    ) {
      return model.timeInfo;
    }
  }
  if (audio.isPlaying) return audio.timeInfo;
  return { duration: 0, time: 0 };
}

model.emitter.on("started", (animation) => {
  gui.Model.onAnimationStarted(animation);
  gui.Data.onAnimationStarted(animation);
});

model.emitter.on("loop", () => {
  const { resource, is_repeat } = curAnimation.voice;
  if (resource && (!audio.isPlaying || (audio.resource === resource && !is_repeat))) {
    audio.play(curAnimation.voice);
  }
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

audio.emitter.on("started", (resource) => {
  gui.Voices.onVoiceStarted(resource);
});

audio.emitter.on("ended", (resource) => {
  gui.Voices.onVoiceStopped();
  if (!model.isPlaying) progress.hide();
});

audio.emitter.on("stopped", (resource) => {
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
  model.setStats(stats);
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

gui.Model.emitter.on("play-animation", async (animation) => {
  // reset
  curAnimationGroup = null;
  stopAnimation();
  stopVoice();
  const _animation = clone(animation);
  playAnimationWithVoice(animation, true);
  const animationDuration = model.getAnimationDuration(animation.name);
  const voiceDuration = await audio.getAudioDuration(animation.voice.resource);
  gui.Voices.setAddButtonsEnable(true);
  gui.Data.setSelectedAnimation(null);
  gui.Controls.applyAnimationData(animation, animationDuration, voiceDuration);
});

gui.Model.emitter.on("add-animation", (animation) => {
  gui.Data.addAnimation(animation);
  gui.Model.setAnimationAddedCount(animation.name, 1);
  gui.Voices.setVoiceAddedCount("Data", animation.voice, 1);
});

/**********************************************/
/*                Voices panel                */
/**********************************************/

gui.Voices.emitter.on("play-voice", (resource) => {
  audio.play({ resource });
  progress.show({ fixed: true, text: "Loading..." });
});

gui.Voices.emitter.on("set-voice", async (resource) => {
  const animation = getCurAnimation();
  if (gui.Model.selectedAnimation) {
    gui.Voices.setVoiceAddedCount("Model", animation.voice.resource, -1);
    gui.Voices.setVoiceAddedCount("Model", resource, 1);
    animation.voice.resource = resource;
    gui.Model.updateAnimationVoiceStyle();
  }
  if (gui.Data.selectedAnimation) {
    gui.Voices.setVoiceAddedCount("Data", animation.voice.resource, -1);
    gui.Voices.setVoiceAddedCount("Data", resource, 1);
    animation.voice.resource = resource;
    gui.Data.updateAnimationVoiceStyle();
  }
  const voiceDuration = await audio.getAudioDuration(resource);
  gui.Controls.setVoiceValue({ resource }, voiceDuration);
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

gui.Data.emitter.on("play-animation", async (animation) => {
  curAnimationGroup = null;
  stopVoice();
  playAnimationWithVoice(animation);
  gui.Voices.setAddButtonsEnable(true);
  gui.Model.setSelectedAnimation(null);
  const animationDuration = model.getAnimationDuration(animation.name);
  const voiceDuration = await audio.getAudioDuration(animation.voice.resource);
  gui.Controls.applyAnimationData(animation, animationDuration, voiceDuration);
});

gui.Data.emitter.on("delete-animation", (animation) => {
  gui.Model.setAnimationAddedCount(animation.name, -1);
  gui.Voices.setVoiceAddedCount("Data", animation.voice.resource, -1);
  if (!getCurAnimation()) {
    gui.Voices.setAddButtonsEnable(false);
    gui.Controls.applyAnimationData(null, 0, 0);
  }
});

function fix(group) {
  group.forEach((animation) => {
    //
    animation.voice.start_time ??= 0;
    animation.voice.end_time ??= 0;
  });
}

gui.Data.emitter.on("save-data", ({ enter, idle, groups }) => {
  const animations = gui.Model.getAnimations();
  const voices = gui.Voices.getVoices();

  /* fix */
  fix(animations);
  fix(enter);
  fix(idle);
  groups.forEach(fix);

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
  if (animation) animation.stats = stats;
});

gui.Controls.emitter.on("action-changed", (action) => {
  const animation = getCurAnimation();
  if (animation) {
    animation.action = action;
    if (gui.Model.selectedAnimation) gui.Model.updateAnimationRepeatStyle();
    if (gui.Data.selectedAnimation) gui.Data.updateAnimationRepeatStyle();
  }
});

gui.Controls.emitter.on("voice-changed", (newData) => {
  const animation = getCurAnimation();
  if (animation) animation.voice = newData;
});

function resetAnmVoice(anm) {
  Object.assign(anm.voice, {
    resource: "",
    delay: 0,
    is_force: false,
    is_repeat: false,
  });
}
gui.Controls.emitter.on("clear-voice", () => {
  const animation = getCurAnimation();
  if (gui.Model.selectedAnimation) {
    gui.Voices.setVoiceAddedCount("Model", animation.voice.resource, -1);
    resetAnmVoice(animation);
    gui.Model.updateAnimationVoiceStyle();
  }
  if (gui.Data.selectedAnimation) {
    gui.Voices.setVoiceAddedCount("Data", animation.voice.resource, -1);
    resetAnmVoice(animation);
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
    const { name, time: value, duration: max } = getPlayingProgress();
    const html = `
      <span class="label">Name: </span>
      <span class="value">${name}</span>
      <span class="label">Duration: </span>
      <span class="value">${max.toFixed(3)}s</span>
    `;
    if (max) progress.update({ fixed: true, max, value, html });
    else if (!model.isInfinity) progress.hide();
  }
}
render();
