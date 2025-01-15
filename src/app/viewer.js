import scene from "./three/scene.js";
import model from "./three/model.js";
import audio from "./three/audio.js";
import progress from "./utils/progress.js";
import { showSaveFilePicker } from "./utils/filePicker.js";
import { wait } from "./utils/utils.js";

const path = require("node:path");
const fs = require("node:fs");
const menu = require("./menu.cjs");
const win = nw.Window.get();

/**********************************************/
/*                    init                    */
/**********************************************/

const x = screen.availWidth - win.width;
const y = screen.availHeight - win.height;
win.moveTo(x, y);

/**********************************************/
/*                    model                   */
/**********************************************/

let dataList;
let modelData, modelSize;
let enterGroup, idleGroup, isEnterAnimation;
let curAnimationGroup, curAnimationGroupIndex, curAnimation;

function loadModelByName(modelName) {
  dataList = global.dataList.filter((data) => data.groups.flat().length > 0);
  const modelData = (modelName && dataList.find((data) => data.name === modelName)) || dataList[0];
  loadModel(modelData);
  /* update global */ global.settings.model = modelData.name;
}

function loadModel(data) {
  stopAnimation();
  stopVoice();

  modelData = data;
  enterGroup = data.groups[0];
  idleGroup = data.groups[1];
  curAnimationGroup = curAnimationGroupIndex = curAnimation = null;
  modelSize = fs.statSync(data.resource).size;
  progress.show({ modal: false, text: "Loading..." });
  model.load(data.resource);
}

model.emitter.on("progress", ({ loaded }) => {
  const percent = ((loaded / modelSize) * 100).toFixed(2) + "%";
  progress.update({ value: loaded, max: modelSize, text: `Loading... (${percent})` });
});

model.emitter.on("loaded", () => {
  progress.hide();
  isEnterAnimation = true;
  playAnimationGroup(enterGroup);
  isEnterAnimation = false;
});

model.emitter.on("error", (error) => {
  console.error(error);
  progress.hide();
});

/**********************************************/
/*              animation & voice             */
/**********************************************/

function playAnimation(animation) {
  curAnimation = animation;

  model.setMeshes(animation.meshes);
  model.setStats(animation);
  model.playAnimation(animation);
}

function stopAnimation() {
  model.stopAnimation();
}

let voiceTimer = -1;
function playVoice(voicePath, delay = 0) {
  if (global.settings.isMute) return;
  if (isEnterAnimation || Math.random() <= global.settings.voice) {
    clearTimeout(voiceTimer);
    voiceTimer = setTimeout(() => {
      audio.play(voicePath);
    }, delay * 1000);
  }
}

function stopVoice() {
  audio.stop();
}

function playAnimationWithVoice(animation) {
  playAnimation(animation);

  if (!audio.isPlaying) {
    if (animation.voice) {
      playVoice(animation.voice, animation.voice_delay);
    } else if (modelData.voices.length > 0) {
      const voice = modelData.voices[Math.floor(Math.random() * modelData.voices.length)];
      playVoice(voice, 0);
    }
  }
}

function playAnimationGroup(group) {
  if (group.length === 0) playAnimationGroup(randomGroup());
  curAnimationGroup = group;
  curAnimationGroupIndex = 0;
  playAnimationWithVoice(group[curAnimationGroupIndex]);
}

function randomGroup() {
  if (Math.random() < 0.3) {
    const randomIdle = idleGroup[Math.floor(Math.random() * idleGroup.length)];
    return [randomIdle];
  }
  return modelData.groups[Math.floor(Math.random() * modelData.groups.length)];
}

model.emitter.on("ended", async () => {
  await wait(curAnimation.pause * 1000);
  curAnimation = null;

  if (curAnimationGroupIndex < curAnimationGroup.length - 1) {
    const animation = curAnimationGroup[++curAnimationGroupIndex];
    playAnimationWithVoice(animation);
  } else {
    playAnimationGroup(randomGroup());
  }
});

process.on("setting-changed", (prop, value) => {
  if (prop === "isMute" && value === true) stopVoice();
});

/**********************************************/
/*                 render loop                */
/**********************************************/

function render() {
  requestAnimationFrame(render);
  model.update();
  scene.update();
}
render();

/**********************************************/
/*                 contextmenu                */
/**********************************************/

window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  menu.popup(e.screenX, e.screenY);
});

process.on("model-changed", loadModelByName);

/**********************************************/
/*                  draggable                 */
/**********************************************/

let winPosition = { x: 0, y: 0 };
function onMouseDown(e) {
  winPosition = { x: e.pageX, y: e.pageY };
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}
function onMouseMove(e) {
  win.moveTo(e.screenX - winPosition.x, e.screenY - winPosition.y);
}
function onMouseUp(e) {
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
}
document.body.addEventListener("mousedown", onMouseDown);

/**********************************************/
/*                  shortcut                  */
/**********************************************/

function togglePaused() {
  const paused = model.togglePaused();
  process.emit("paused-changed", paused);
}
process.on("toggle-paused", togglePaused);

function capture() {
  let paused = model.isPaused;
  if (!paused) togglePaused();
  const imageData = scene.capture().slice("data:image/png;base64,".length);
  const buffer = Buffer.from(imageData, "base64");
  const time = new Date().toLocaleString().replace(/\/|:/g, "-").replace(" ", "_");
  const name = `${global.settings.model}_${time}.png`;
  showSaveFilePicker({ suggestedName: name, accept: "image/png", startIn: "pictures" })
    .then(([file]) => fs.writeFileSync(file.path, buffer))
    .catch(() => {})
    .then(() => {
      if (!paused) togglePaused();
    });
}
process.on("capture", capture);

window.addEventListener("keydown", (e) => {
  const KEY = e.key.toUpperCase();
  if (KEY === "P") togglePaused();
  else if (e.ctrlKey && KEY === "S") capture();
});

/**********************************************/
/*                    data                    */
/**********************************************/

function init() {
  loadModelByName(global.settings.model);

  // update menu
  process.emit(
    "model-list-changed",
    dataList.map((model) => model.name)
  );
}
process.on("close-editor", init);
init();
