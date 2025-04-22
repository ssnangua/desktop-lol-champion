import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { createEmitter, clone } from "../utils/utils.js";
import { showOpenFilePicker } from "../utils/filePicker.js";

const path = require("node:path");
const fs = require("node:fs");
const { getEmptyData, getEmptyAnimation, readDataFile } = require("./global/data.cjs");

const emitter = createEmitter();

const Model = new GUI({ title: "Model" });
Model.domElement.style.cssText = "right: initial; left: 0;";

const root = {
  Open() {
    showOpenFilePicker({ accept: ".glb", multiple: false, startIn: global.dataDir })
      .then(([file]) => openModel(file))
      .catch(() => {});
  },
  Model: "",
};
Model.add(root, "Open");
let ModelController = Model.add(root, "Model", []);

function openModel(file) {
  const { dir, name } = path.parse(file.path);
  const data = getEmptyData(file.path);
  // auto load data file if exists
  const dataFile = path.resolve(dir, `${name}.json`);
  if (fs.existsSync(dataFile)) {
    Object.assign(data, readDataFile(dataFile));
  }
  // load model
  emitter.emit("open-model", data);
}

function setModels(models) {
  ModelController = ModelController.options(models).listen();
}

Model.onChange(({ value }) => {
  emitter.emit("model-changed", value);
});

// Animations
let animations, AnimationFolder;
let AnmCtrlMap, anmAddedMap;
let sAnm, sAnmCtrl; // selected
let aAnmCtrl; // activated

function setModel({ animations: modelAnimations, meshes }, dataAnimations) {
  if (AnimationFolder) AnimationFolder.destroy();
  AnimationFolder = Model.addFolder("Animations");

  const dataAnimationsMap = Object.fromEntries(dataAnimations.map((animation) => [animation.name, animation]));
  animations = modelAnimations.map((name) => {
    if (name in dataAnimationsMap) return dataAnimationsMap[name];
    return getEmptyAnimation();
  });
  AnmCtrlMap = {};
  anmAddedMap = {};
  aAnmCtrl = null;

  animations.forEach((animation) => {
    const { name } = animation;
    const controller = AnimationFolder.add(
      {
        [name]() {
          setSelectedAnimation(animation);
          emitter.emit("play-animation", animation);
        },
      },
      name
    );
    controller.addButton("+", () => emitter.emit("add-animation", clone(animation)));
    AnmCtrlMap[name] = controller;
    anmAddedMap[name] = 0;
    setAnmHasVoiceStyle(controller, !!animation.voice.resource);
    setAnmRepeatStyle(controller, animation.action.repeat);
  });
}

function setSelectedAnimation(animation) {
  if (sAnmCtrl) sAnmCtrl.domElement.classList.remove("selected");
  if (!animation) {
    sAnm = sAnmCtrl = null;
  } else {
    sAnm = animations.find(({ name }) => name === animation.name);
    sAnmCtrl = AnmCtrlMap[animation.name];
    sAnmCtrl.domElement.classList.add("selected");
  }
}

function setAnmHasVoiceStyle(controller, hasVoice) {
  controller.domElement.classList.toggle("has-voice", hasVoice);
}
function setAnmVoiceMissingStyle(controller, isMissing) {
  controller.domElement.classList.toggle("voice-missing", isMissing);
}

function setAnmRepeatStyle(controller, repeat) {
  const nameEl = controller.domElement.querySelector(".name");
  if (repeat > 1) nameEl.setAttribute("data-repeat", repeat);
  else nameEl.removeAttribute("data-repeat");
}

function setAnimationAddedCount(name, increase) {
  anmAddedMap[name] += increase;
  const nameEl = AnmCtrlMap[name].domElement.querySelector(".name");
  const added = anmAddedMap[name];
  if (added > 0) nameEl.setAttribute("data-added-right", added);
  else nameEl.removeAttribute("data-added-right");
}

function countAddedVoices(voices) {
  const addedMap = {}; // { "voiceResource": ["animationName"], ... }
  const validAddedMap = {}; // { "voiceResource": count, ... }
  animations.forEach(({ name, voice }) => {
    if (voice.resource) {
      addedMap[voice.resource] ||= [];
      addedMap[voice.resource].push(name);
    }
  });
  Object.entries(addedMap).forEach(([voiceResource, list]) => {
    const isExists = voices.includes(voiceResource);
    list.forEach((name) => {
      const controller = AnmCtrlMap[name];
      controller.domElement.classList.toggle("voice-missing", !isExists);
    });
    if (isExists) validAddedMap[voiceResource] = list.length;
  });
  return validAddedMap;
}

function onAnimationStarted(animation) {
  onAnimationStopped();
  aAnmCtrl = AnmCtrlMap[animation.name];
  aAnmCtrl.disable();
}

function onAnimationStopped() {
  if (aAnmCtrl) {
    aAnmCtrl.enable();
    aAnmCtrl = null;
  }
}

export default {
  emitter,
  setModels,
  setModelName(modelName) {
    root.Model = modelName;
  },
  setModel,
  setSelectedAnimation,
  get selectedAnimation() {
    return sAnm;
  },
  updateAnimationVoiceStyle() {
    setAnmHasVoiceStyle(sAnmCtrl, !!sAnm.voice.resource);
    setAnmVoiceMissingStyle(sAnmCtrl, false);
  },
  updateAnimationRepeatStyle() {
    setAnmRepeatStyle(sAnmCtrl, sAnm.action.repeat);
  },
  countAddedVoices,
  setAnimationAddedCount,
  setAnimationsAddedCount(animationCountMap) {
    Object.entries(animationCountMap).forEach(([name, count]) => {
      anmAddedMap[name] = count;
      setAnimationAddedCount(name, 0);
    });
  },
  getAnimations() {
    return animations;
  },
  onAnimationStarted,
  onAnimationStopped,
};
