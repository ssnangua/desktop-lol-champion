import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { createEmitter } from "../utils/utils.js";

const path = require("node:path");

const emitter = createEmitter();

const Data = new GUI({ title: "Data" });
Data.domElement.style.cssText = "right: 246px; display: none;";

/**********************************************/
/*                    Data                    */
/**********************************************/

const root = {
  "Name": "",
  "_Resource": "", // not show, just cache
  "Resource": "",
  "Save Data"() {
    emitter.emit("save-data", {
      enter: groups[0],
      idle: groups[1],
      groups: groups.slice(2).filter((group) => group.length > 0),
    });
  },
};
Data.add(root, "Name").listen().disable();
Data.add(root, "Resource").listen().disable();
Data.add(root, "Save Data");

/**********************************************/
/*                 Operations                 */
/**********************************************/

const operations = {
  "New Group"() {
    newGroup([]);
  },
  "Delete Group"() {
    if (confirm("Delete the current group?")) {
      deleteGroup();
    }
  },
  "Play Group"() {
    emitter.emit("play-animation-group", openedGroup);
  },
};
const OperationsFolder = Data.addFolder("Operations");
const NewGroupController = OperationsFolder.add(operations, "New Group");
const DeleteGroupController = OperationsFolder.add(operations, "Delete Group").type("danger").disable();
const PlayGroupController = OperationsFolder.add(operations, "Play Group").disable();
function updateOperationsCtrls() {
  const [o, e, i] = [openedGroupFolder, enterGroupFolder, idleGroupFolder];
  const canDelete = o && o !== e && o !== i;
  const canPlay = o && o !== i && openedGroup.length > 0;
  DeleteGroupController[canDelete ? "enable" : "disable"]();
  PlayGroupController[canPlay ? "enable" : "disable"]();
}

/**********************************************/
/*              Animation Groups              */
/**********************************************/

let groups, GroupsFolder;
let enterGroupFolder, idleGroupFolder;
let openedGroup, openedGroupFolder;
let sAnm, sAnmCtrl; // selected
let aAnmCtrl; // activated

function setModelData(modelData) {
  groups = [];
  enterGroupFolder = idleGroupFolder = null;
  openedGroup = openedGroupFolder = null;
  sAnm = sAnmCtrl = null;
  aAnmCtrl = null;
  // model name and path
  const { name, resource } = modelData;
  Object.assign(root, { Name: name, _Resource: resource, Resource: path.basename(resource) });
  // animation group folders
  if (GroupsFolder) GroupsFolder.destroy();
  GroupsFolder = Data.addFolder("Animation Groups", true);
  GroupsFolder.onAccordion((folder) => {
    const index = GroupsFolder.folders.indexOf(folder);
    openedGroup = groups[index];
    openedGroupFolder = folder;
    updateOperationsCtrls();
  });
  newGroup(modelData.enter);
  newGroup(modelData.idle);
  modelData.groups.forEach(newGroup);
  // enter and idle group folders
  enterGroupFolder = inbuildGroup(GroupsFolder.folders[0], {
    title: "Enter Group",
    type: "enter",
    tips: "The first animation group to play after loading the model",
  });
  idleGroupFolder = inbuildGroup(GroupsFolder.folders[1], {
    title: "Idle Animations",
    type: "idle",
    tips: "These animations are most often played",
  });
  updateOperationsCtrls();
}

function inbuildGroup(folder, { title, type, tips }) {
  folder.domElement.classList.add(type);
  folder.$title.innerHTML = `
    ${title}
    <span>
      (<span class="tips" title="${tips}">?</span>)
    </span>
  `;
  return folder;
}

function newGroup(group) {
  openedGroup = [];
  groups.push(openedGroup);
  openedGroupFolder = GroupsFolder.addFolder(`Group ${groups.length - 2} (${group.length})`);
  openedGroupFolder.domElement.classList.add("animation-group");
  group.forEach(addAnimation);
  updateOperationsCtrls();
}

function deleteGroup() {
  openedGroup.forEach((animation) => {
    if (animation === sAnm) {
      sAnm = sAnmCtrl = null;
    }
    emitter.emit("delete-animation", animation);
  });
  let index = groups.indexOf(openedGroup);
  groups.splice(index, 1);
  openedGroupFolder.destroy();
  if (groups.length > 0) {
    // set current group to previous one
    index = index > 0 ? index - 1 : 0;
    openedGroup = groups[index];
    openedGroupFolder = GroupsFolder.folders[index];
    openedGroupFolder.open();
    // update folder titles
    GroupsFolder.folders.forEach((folder) => updateGroupFolderTitle(folder));
  } else {
    openedGroup = openedGroupFolder = null;
  }
  updateOperationsCtrls();
}

function updateGroupFolderTitle(folder) {
  if (folder === enterGroupFolder || folder === idleGroupFolder) return;
  const index = GroupsFolder.folders.indexOf(folder);
  folder.title(`Group ${index - 1} (${folder.controllers.length})`);
}

function highlightGroup(playingAnimation) {
  for (let i = 0; i < groups.length; i++) {
    GroupsFolder.folders[i].domElement.classList.remove("highlight");
    if (!playingAnimation) continue;
    const group = groups[i];
    for (let j = 0; j < group.length; j++) {
      if (group[j].name === playingAnimation.name) {
        GroupsFolder.folders[i].domElement.classList.add("highlight");
        break;
      }
    }
  }
}

function addAnimation(animation) {
  if (!openedGroup) newGroup([]);
  openedGroup.push(animation);
  const controller = openedGroupFolder.add(
    {
      [animation.name]() {
        setSelectedAnimation(animation);
        emitter.emit("play-animation", animation);
      },
    },
    animation.name
  );

  controller.addButton("↑", () => {
    swapAnimations(animation, -1);
  });

  controller.addButton("↓", () => {
    swapAnimations(animation, 1);
  });

  controller.addButton("-", () => {
    if (animation === sAnm) {
      sAnm = sAnmCtrl = null;
    }
    const index = openedGroup.indexOf(animation);
    openedGroup.splice(index, 1);
    openedGroupFolder.controllers[index].destroy();
    updateMoveButtons();
    updateGroupFolderTitle(openedGroupFolder); // children count
    updateOperationsCtrls(); // playable
    emitter.emit("delete-animation", animation);
  });

  setAnmHasVoiceStyle(controller, !!animation.voice.resource);
  setAnmRepeatStyle(controller, animation.action.repeat);
  updateMoveButtons();
  updateGroupFolderTitle(openedGroupFolder);
  updateOperationsCtrls();
  return animation;
}

function updateMoveButtons() {
  openedGroupFolder.controllers.forEach((controller, index) => {
    const isFirst = index === 0;
    const isLast = index === openedGroup.length - 1;
    controller.buttons[0][isFirst ? "disable" : "enable"]();
    controller.buttons[1][isLast ? "disable" : "enable"]();
  });
}

function swapAnimations(animation, direction) {
  const [group, controllers] = [openedGroup, openedGroupFolder.controllers];
  const index = group.indexOf(animation);
  const [index1, index2] = direction > 0 ? [index, index + 1] : [index - 1, index];
  // update dom
  openedGroupFolder.$children.insertBefore(controllers[index2].domElement, controllers[index1].domElement);
  // update data
  [group[index1], group[index2]] = [group[index2], group[index1]];
  [controllers[index1], controllers[index2]] = [controllers[index2], controllers[index1]];
  updateMoveButtons();
}

function setSelectedAnimation(animation) {
  if (sAnmCtrl) sAnmCtrl.domElement.classList.remove("selected");
  if (!animation) {
    sAnm = sAnmCtrl = null;
  } else {
    const index = openedGroup.findIndex((item) => item === animation);
    sAnm = openedGroup[index];
    sAnmCtrl = openedGroupFolder.controllers[index];
    sAnmCtrl.domElement.classList.add("selected");
  }
}

function setAnmHasVoiceStyle(controller, hasVoice) {
  controller.domElement.classList.toggle("has-voice", hasVoice);
}
function setAnmVoiceMissingStyle(controller, isMissing) {
  controller.domElement.classList.toggle("voice-missing", isMissing);
}

function setAnmRepeatStyle(controller, repeat) {
  const nameEl = controller.domElement.querySelector(".name");
  if (repeat > 1) nameEl.setAttribute("data-repeat", repeat);
  else nameEl.removeAttribute("data-repeat");
}

function countAddedAnimations() {
  const addedMap = {}; // { "animationName": count, ... }
  groups.forEach((group, groupIndex) => {
    group.forEach(({ name }) => {
      addedMap[name] = (addedMap[name] || 0) + 1;
    });
  });
  return addedMap;
}

function countAddedVoices(voices) {
  const addedMap = {}; // { "voiceResource": [[groupIndex, animationIndex], ...], ... }
  const validAddedMap = {}; // { "voiceResource": count, ... }
  groups.forEach((group, groupIndex) => {
    group.forEach(({ voice }, animationIndex) => {
      if (voice.resource) {
        addedMap[voice.resource] ||= [];
        addedMap[voice.resource].push([groupIndex, animationIndex]);
      }
    });
  });
  Object.entries(addedMap).forEach(([voiceResource, list]) => {
    const isExists = voices.includes(voiceResource);
    list.forEach(([groupIndex, animationIndex]) => {
      const folder = GroupsFolder.folders[groupIndex];
      const controller = folder.controllers[animationIndex];
      controller.domElement.classList.toggle("voice-missing", !isExists);
    });
    if (isExists) validAddedMap[voiceResource] = list.length;
  });
  return validAddedMap;
}

function onAnimationStarted(animation) {
  if (!openedGroup) return;
  onAnimationStopped();
  const index = openedGroup.indexOf(animation);
  if (index !== -1) {
    aAnmCtrl = openedGroupFolder.controllers[index];
    aAnmCtrl.disable();
  } else {
    highlightGroup(animation);
  }
}

function onAnimationStopped() {
  if (aAnmCtrl) {
    aAnmCtrl.enable();
    aAnmCtrl = null;
  } else {
    highlightGroup(null);
  }
}

export default {
  emitter,
  show() {
    Data.domElement.style.display = "";
  },
  setModelData,
  getAnimationsMap() {
    const animationsMap = {};
    groups.forEach((group) => {
      group.forEach((animation) => {
        animationsMap[animation.name] = animation;
      });
    });
    return animationsMap;
  },
  addAnimation,
  setSelectedAnimation,
  countAddedAnimations,
  countAddedVoices,
  get selectedAnimation() {
    return sAnm;
  },
  updateAnimationVoiceStyle() {
    setAnmHasVoiceStyle(sAnmCtrl, !!sAnm.voice.resource);
    setAnmVoiceMissingStyle(sAnmCtrl, false);
  },
  updateAnimationRepeatStyle() {
    setAnmRepeatStyle(sAnmCtrl, sAnm.action.repeat);
  },
  onAnimationStarted,
  onAnimationStopped,
};
