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
    groups: [[], []], // [enterGroup, idleGroup]
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
      data = {
        name: data.name,
        resource: path.resolve(data.resource),
        animations: data.animations.map((animation) => relativeToAbsolute(animation, "voice")),
        voices: data.voices.map((voice) => path.resolve(voice)),
        groups: data.groups.map((group) => group.map((animation) => relativeToAbsolute(animation, "voice"))),
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
    data = {
      name: data.name,
      resource: path.relative("./", data.resource),
      animations: clone(data.animations).map((animation) => absoluteToRelative(animation, "voice")),
      voices: data.voices.map((voice) => path.relative("./", voice)),
      groups: clone(data.groups).map((group) => group.map((animation) => absoluteToRelative(animation, "voice"))),
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
  readDataFile,
  writeDataFile,
};
