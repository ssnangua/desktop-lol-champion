import fs from "fs";
import os from "os";
import nwbuild from "nw-builder";
import options from "./options.js";

const { name, version } = JSON.parse(fs.readFileSync("./src/package.json").toString());
const buildName = [name, version, os.platform(), os.arch()].join("-");

await nwbuild({
  ...options,
  mode: "build",
  flavor: "normal",
  outDir: `./out/${buildName}`,
  // zip: true,
  app: {
    icon: "./src/icon.ico",
  },
});

fs.cpSync("./models", `./out/${buildName}/models`, { recursive: true });
