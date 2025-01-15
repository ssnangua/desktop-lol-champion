import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { createEmitter, clone } from "../utils/utils.js";
import { showOpenFilePicker } from "../utils/filePicker.js";

const path = require("node:path");
const fs = require("node:fs");
const { getEmptyData, readDataFile } = require("./global/data.cjs");

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
    console.log(readDataFile(dataFile))
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
let AnimationControllerMap, animationAddedMap;
let selectedAnimation, selectedAnimationController;
let activatedAnimationController;

function setModel({ animations: modelAnimations, meshes }, dataAnimations) {
  if (AnimationFolder) AnimationFolder.destroy();
  AnimationFolder = Model.addFolder("Animations");

  const dataAnimationsMap = Object.fromEntries(dataAnimations.map((animation) => [animation.name, animation]));
  animations = modelAnimations.map(({ name }) => {
    if (name in dataAnimationsMap) return dataAnimationsMap[name];
    return {
      name,
      meshes,
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      repeat: 1,
      time: 0,
      duration: 0,
      pause: 0,
      voice: "",
      voice_delay: 0,
    };
  });
  AnimationControllerMap = {};
  animationAddedMap = {};
  activatedAnimationController = null;

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
    AnimationControllerMap[name] = controller;
    animationAddedMap[name] = 0;
    setAnimationVoiceStyle(controller, !!animation.voice);
    setAnimationRepeatStyle(controller, animation.repeat);
  });
}

function setSelectedAnimation(animation) {
  if (selectedAnimationController) selectedAnimationController.domElement.classList.remove("selected");
  if (!animation) {
    selectedAnimation = selectedAnimationController = null;
  } else {
    selectedAnimation = animations.find(({ name }) => name === animation.name);
    selectedAnimationController = AnimationControllerMap[animation.name];
    selectedAnimationController.domElement.classList.add("selected");
  }
}

function setAnimationVoiceStyle(controller, hasVoice) {
  controller.domElement.classList.toggle("has-voice", hasVoice);
}

function setAnimationRepeatStyle(controller, repeat) {
  const nameEl = controller.domElement.querySelector(".name");
  if (repeat > 1) nameEl.setAttribute("data-repeat", repeat);
  else nameEl.removeAttribute("data-repeat");
}

function setAnimationAddedCount(name, increase) {
  animationAddedMap[name] += increase;
  const nameEl = AnimationControllerMap[name].domElement.querySelector(".name");
  const added = animationAddedMap[name];
  if (added > 0) nameEl.setAttribute("data-added-right", added);
  else nameEl.removeAttribute("data-added-right");
}

function countAddedVoices(voices) {
  const addedMap = {}; // { "voicePath": ["animationName"], ... }
  const validAddedMap = {}; // { "voicePath": count, ... }
  animations.forEach(({ name, voice }) => {
    if (voice) {
      addedMap[voice] ||= [];
      addedMap[voice].push(name);
    }
  });
  Object.entries(addedMap).forEach(([voicePath, list]) => {
    const isExists = voices.includes(voicePath);
    list.forEach((name) => {
      const controller = AnimationControllerMap[name];
      controller.domElement.classList.toggle("voice-missing", !isExists);
    });
    if (isExists) validAddedMap[voicePath] = list.length;
  });
  return validAddedMap;
}

function onAnimationStarted(animation) {
  onAnimationStopped();
  activatedAnimationController = AnimationControllerMap[animation.name];
  activatedAnimationController.disable();
}

function onAnimationStopped() {
  if (activatedAnimationController) {
    activatedAnimationController.enable();
    activatedAnimationController = null;
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
    return selectedAnimation;
  },
  updateAnimationVoiceStyle() {
    setAnimationVoiceStyle(selectedAnimationController, !!selectedAnimation.voice);
  },
  updateAnimationRepeatStyle() {
    setAnimationRepeatStyle(selectedAnimationController, selectedAnimation.repeat);
  },
  countAddedVoices,
  setAnimationAddedCount,
  setAnimationsAddedCount(animationCountMap) {
    Object.entries(animationCountMap).forEach(([name, count]) => {
      animationAddedMap[name] = count;
      setAnimationAddedCount(name, 0);
    });
  },
  getAnimations() {
    return animations;
  },
  onAnimationStarted,
  onAnimationStopped,
};
