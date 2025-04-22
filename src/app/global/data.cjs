const path = require("node:path");
const fs = require("node:fs");

const dataDir = path.resolve("../models");

const clone = (obj) => JSON.parse(JSON.stringify(obj));

function getEmptyData(resource) {
  return {
    name: path.parse(resource).name,
    resource: path.resolve(resource),
    animations: [],
    voices: [],
    enter: [],
    idle: [],
    groups: [],
  };
}

function getEmptyAnimation() {
  return {
    name,
    meshes,
    stats: {
      is_mirror: false,
      scale: 1,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
    },
    action: {
      delay: 0,
      start_time: 0,
      end_time: 0,
      time_scale: 1,
      repeat: 1,
    },
    voice: {
      resource: "",
      delay: 0,
      start_time: 0,
      end_time: 0,
      is_force: false,
      is_repeat: false,
    },
  };
}

function relativeToAbsolute(obj, key) {
  if (obj[key]) obj[key] = path.resolve(obj[key]);
  return obj;
}

function readDataFile(dataFilePath) {
  try {
    let data = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
    if (data.resource && fs.existsSync(data.resource)) {
      const anmVoice = (animation) => {
        animation.voice = relativeToAbsolute(animation.voice, "resource");
        return animation;
      };
      data = {
        name: data.name,
        resource: path.resolve(data.resource),
        animations: data.animations.map(anmVoice),
        voices: data.voices.map((voice) => path.resolve(voice)),
        enter: data.enter.map(anmVoice),
        idle: data.idle.map(anmVoice),
        groups: data.groups.map((group) => group.map(anmVoice)),
      };
      return data;
    }
  } catch (error) {
    console.error(error);
    alert(error);
  }
}

function absoluteToRelative(obj, key) {
  if (obj[key]) obj[key] = path.relative("./", obj[key]);
  return obj;
}

function writeDataFile(dataFilePath, data) {
  try {
    const anmVoice = (animation) => {
      animation.voice = absoluteToRelative(animation.voice, "resource");
      return animation;
    };
    data = {
      name: data.name,
      resource: path.relative("./", data.resource),
      animations: clone(data.animations).map(anmVoice),
      voices: data.voices.map((voice) => path.relative("./", voice)),
      enter: clone(data.enter).map(anmVoice),
      idle: clone(data.idle).map(anmVoice),
      groups: clone(data.groups).map((group) => group.map(anmVoice)),
    };
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(error);
    alert(error);
  }
}

function getDataList(dir, dataMap = {}, modelMap = {}) {
  fs.readdirSync(dir).forEach((item) => {
    const fullPath = path.resolve(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      getDataList(fullPath, dataMap, modelMap);
    } else if (/\.json$/i.test(item)) {
      const data = readDataFile(fullPath);
      if (fs.existsSync(data.resource)) {
        dataMap[data.resource] = data;
      }
    } else if (/\.glb$/i.test(item)) {
      modelMap[fullPath] = getEmptyData(fullPath);
    }
  });
  return Object.values(Object.assign(modelMap, dataMap));
}

global.dataDir = dataDir;
global.dataList = getDataList(dataDir);

module.exports = {
  getEmptyData,
  getEmptyAnimation,
  readDataFile,
  writeDataFile,
};
