import nwbuild from "nw-builder";
import options from "./options.js";

nwbuild({
  ...options,
  mode: "run",
  flavor: "sdk",
  argv: [],
});
