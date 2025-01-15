const path = require("node:path");
const url = require("node:url");
const { EventEmitter } = require("node:events");

export const createEmitter = () => new EventEmitter();

export const clone = (obj) => JSON.parse(JSON.stringify(obj));

export const pathToURL = (p) => url.pathToFileURL(path.resolve(p)).toString();

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
