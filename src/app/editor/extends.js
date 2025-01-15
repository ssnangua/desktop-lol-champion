import { GUI, Controller } from "three/addons/libs/lil-gui.module.min.js";

GUI.prototype.addFolder = function (title, accordion) {
  if (this.accordion) this.folders.forEach((folder) => folder.close());
  const newFolder = new GUI({ parent: this, title });
  newFolder.accordion = accordion;
  return newFolder;
};
GUI.prototype.onAccordion = function (callback) {
  this._onAccordion = callback;
  return this;
};
const openAnimated = GUI.prototype.openAnimated;
GUI.prototype.openAnimated = function (open = true) {
  if (this.parent?.accordion) {
    if (open) {
      this.parent.folders.forEach((folder) => {
        if (folder !== this) folder.close();
      });
      if (this.parent._onAccordion) this.parent._onAccordion(this);
    } else {
      return this;
    }
  }
  openAnimated.call(this, open);
  return this;
};

class ControllerButton {
  constructor({ parent, name, onClick }) {
    this.domElement = document.createElement("div");
    this.domElement.classList.add("widget", "button");
    this.domElement.innerHTML = `<button><div class="name">${name}</div></button>`;
    const button = this.domElement.querySelector("button");
    button.addEventListener("click", onClick);

    this.parent = parent;
    if (!this.parent.buttons) {
      this.parent.buttons = [];
      this.parent.$buttons = document.createElement("div");
      this.parent.$buttons.classList.add("buttons");
      this.parent.domElement.appendChild(this.parent.$buttons);
    }
    this.parent.buttons.push(this);
    this.parent.$buttons.appendChild(this.domElement);
  }
  enable() {
    this.domElement.classList.remove("disabled");
    return this;
  }
  disable() {
    this.domElement.classList.add("disabled");
    return this;
  }
  destroy() {
    this.parent.buttons.splice(this.parent.buttons.indexOf(this), 1);
    this.domElement.remove();
    return this;
  }
}
Controller.prototype.addButton = function (name, onClick) {
  return new ControllerButton({ parent: this, name, onClick });
};
const BUTTON_TYPES = {
  primary: "--text-color: #409eff;",
  success: "--text-color: #67c23a;",
  warning: "--text-color: #e6a23c;",
  danger: "--text-color: #f56c6c;",
};
Controller.prototype.type = function (type) {
  this.domElement.style.cssText = BUTTON_TYPES[type];
  return this;
};
