/**
 * audio player
 */
import * as THREE from "three";
import { createEmitter, pathToURL } from "../utils/utils.js";
import scene from "./scene.js";

const emitter = createEmitter();

const listener = new THREE.AudioListener();
scene.camera.add(listener);

const audio = new THREE.Audio(listener);
audio.setLoop(false);
audio.setVolume(global.settings.volume);

process.on("setting-changed", (prop, value) => {
  if (prop === "volume") audio.setVolume(value);
});

let audioPath;
audio.onEnded = () => {
  emitter.emit("ended", audioPath);
  audioPath = null;
};

const audioLoader = new THREE.AudioLoader();

function onProgress({ loaded, total }) {}

function onLoad(buffer) {
  audio.setBuffer(buffer);
  audio.play();
  emitter.emit("started", audioPath);
}

function onError(error) {
  console.error(`Error loading audio file, path: ${audioPath}`, error);
  audioPath = null;
}

export default {
  emitter,
  get isPlaying() {
    return !!audioPath;
  },
  play(path) {
    this.stop();
    audioPath = path;
    audioLoader.load(pathToURL(path), onLoad, onProgress, onError);
    return audio;
  },
  stop() {
    audio.stop();
    emitter.emit("stopped", audioPath);
    audioPath = null;
  },
  getTime() {
    return audio.buffer
      ? { duration: audio.buffer.duration, time: audio.context.currentTime - audio._startedAt }
      : { duration: 0, time: 0 };
  },
};
