import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { createEmitter } from "../utils/utils.js";
import { showOpenFilePicker } from "../utils/filePicker.js";

const path = require("node:path");
const fs = require("node:fs");

const emitter = createEmitter();

const Voices = new GUI({ title: "Voices" });
Voices.domElement.style.cssText = "right: initial; left: 246px; display: none;";

const root = {
  Import() {
    showOpenFilePicker({ accept: ".ogg, .mp3, .wav", multiple: true, startIn: global.dataDir })
      .then((files) => {
        setVoices(files);
        emitter.emit("resources-changed");
      })
      .catch(() => {});
  },
};
Voices.add(root, "Import");

let voices, VoicesFolder;
let voiceControllerMap, modelAddedMap, dataAddedMap;
let selectedVoice, selectedVoiceController;
let activatedVoiceController;

function setVoices(files) {
  if (VoicesFolder) VoicesFolder.destroy();
  selectedVoice = selectedVoiceController = activatedVoiceController = null;

  voices = files.map((file) => file.path);

  VoicesFolder = Voices.addFolder("Resources");
  VoicesFolder.$children.classList.add("voice-resources");

  voiceControllerMap = {};
  modelAddedMap = {};
  dataAddedMap = {};
  files.forEach((voice) => {
    const controller = VoicesFolder.add(
      {
        [voice.name]() {
          if (selectedVoiceController) setVoiceSelected(selectedVoiceController, false);
          selectedVoice = voice;
          selectedVoiceController = controller;
          setVoiceSelected(selectedVoiceController, true);
          emitter.emit("play-voice", voice.path);
        },
      },
      voice.name
    );
    controller.addButton("→", () => {
      emitter.emit("set-voice", voice.path);
    });
    voiceControllerMap[voice.path] = controller;
    modelAddedMap[voice.path] = 0;
    dataAddedMap[voice.path] = 0;
  });

  setAddButtonsEnable(false);
}

function setAddButtonsEnable(enable) {
  VoicesFolder.domElement.classList.toggle("buttons-disabled", !enable);
}

function setVoiceSelected(controller, selected) {
  controller.domElement.classList.toggle("selected", selected);
}

function setVoiceAddedCount(panel, resource, increase) {
  const map = panel === "Model" ? modelAddedMap : dataAddedMap;
  if (!resource || !(resource in map)) return;
  map[resource] += increase;
  const count = map[resource];
  const nameEl = voiceControllerMap[resource].domElement.querySelector(".name");
  const className = panel === "Model" ? "data-added-left" : "data-added-right";
  if (count > 0) nameEl.setAttribute(className, count);
  else nameEl.removeAttribute(className);
}

function getVoiceFiles(dir, voices = []) {
  fs.readdirSync(dir).forEach((item) => {
    const full = path.resolve(dir, item);
    if (fs.statSync(full).isDirectory()) {
      getVoiceFiles(full, voices);
    } else if (/\.(ogg|mp3|wav)$/i.test(item)) {
      voices.push({ name: path.basename(full), path: full });
    }
  });
  return voices;
}

function onVoiceStarted(resource) {
  onVoiceStopped();
  activatedVoiceController = voiceControllerMap[resource];
  if (activatedVoiceController) activatedVoiceController.disable();
}

function onVoiceStopped() {
  if (activatedVoiceController) {
    activatedVoiceController.enable();
    activatedVoiceController = null;
  }
}

export default {
  emitter,
  show() {
    Voices.domElement.style.display = "";
  },
  setModelData(modelData) {
    if (modelData.voices.length > 0) {
      const voices = modelData.voices.map((voice) => ({ name: path.basename(voice), path: voice }));
      setVoices(voices);
    } else {
      // auto import voices in the same folder as model
      setVoices(getVoiceFiles(path.dirname(modelData.resource)));
    }
  },
  getVoices() {
    return voices;
  },
  setAddButtonsEnable,
  get selectedVoice() {
    return selectedVoice;
  },
  setVoiceAddedCount,
  setVoicesAddedCount(panel, voiceCountMap) {
    Object.entries(voiceCountMap).forEach(([resource, count]) => {
      const map = panel === "Model" ? modelAddedMap : dataAddedMap;
      map[resource] = count;
      setVoiceAddedCount(panel, resource, 0);
    });
  },
  onVoiceStarted,
  onVoiceStopped,
};
