const fs = require("node:fs");
const path = require("node:path");

let settings = {
  model: "",
  isMute: false,
  volume: 0.5,
  voice: 0.3,
};

const settingsFile = path.resolve("../settings.json");
try {
  settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
} catch (e) {}

global.settings = new Proxy(settings, {
  set(settings, prop, value) {
    settings[prop] = value;
    process.emit("setting-changed", prop, value);
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    return true;
  },
});
