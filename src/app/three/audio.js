/**
 * audio player
 */
import * as THREE from "three";
import { createEmitter, pathToURL } from "../utils/utils.js";
import scene from "./scene.js";

const path = require("node:path");

const emitter = createEmitter();

const listener = new THREE.AudioListener();
scene.camera.add(listener);

const audio = new THREE.Audio(listener);
audio.setLoop(false);
audio.setVolume(global.settings.volume);

process.on("setting-changed", (prop, value) => {
  if (prop === "volume") audio.setVolume(value);
});

let _voice, _name;

function play() {
  audio.stop();
  const { delay = 0, start_time = 0, end_time = 0 } = _voice;
  audio.offset = start_time;
  audio.duration = (end_time || audio.buffer.duration) - start_time;
  audio.play(delay);
}

audio.onEnded = () => {
  const { resource, is_repeat = false } = _voice;
  if (is_repeat) {
    play();
  } else {
    emitter.emit("ended", resource);
    _voice = _name = null;
  }
};

const audioLoader = new THREE.AudioLoader();

function onProgress({ loaded, total }) {}

function onLoad(buffer) {
  audio.setBuffer(buffer);
  setTimeout(() => {
    play();
    emitter.emit("started", _voice.resource);
  });
}

function onError(error) {
  console.error(`Error loading audio file, path: ${_voice.resource}`, error);
  _voice = _name = null;
}

function getAudioDuration(src) {
  return src
    ? new Promise((resolve) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => resolve(0);
        audio.src = src;
      })
    : Promise.resolve(0);
}

export default {
  emitter,
  getAudioDuration,
  get resource() {
    return _voice?.resource;
  },
  get isPlaying() {
    return !!_voice?.resource;
  },
  get duration() {
    return audio.buffer ? audio.buffer.duration : 0;
  },
  get time() {
    return audio.buffer ? audio.context.currentTime - audio._startedAt : 0;
  },
  get timeInfo() {
    return { name: _name, duration: this.duration, time: this.time };
  },
  play(voice) {
    this.stop();
    _voice = voice;
    _name = path.basename(voice.resource);
    audioLoader.load(pathToURL(voice.resource), onLoad, onProgress, onError);
    return audio;
  },
  pause() {
    if (audio.buffer) audio.pause();
  },
  resume() {
    if (audio.buffer) audio.play();
  },
  stop() {
    audio.stop();
    emitter.emit("stopped", _voice?.resource);
    _voice = _name = null;
  },
};
