import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { createEmitter } from "../utils/utils.js";

const emitter = createEmitter();

const Data = new GUI({ title: "Data" });
Data.domElement.style.cssText = "right: 246px; display: none;";

/**********************************************/
/*                    Data                    */
/**********************************************/

const root = {
  "name": "",
  "resource": "",
  "Save Data"() {
    emitter.emit("save-data", {
      enter: groups[0],
      idle: groups[1],
      groups: groups.slice(2).filter((group) => group.length > 0),
    });
  },
};
Data.add(root, "name").listen().disable();
Data.add(root, "resource").listen().disable();
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
function updateOperationsControllers() {
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
let selectedAnimation, selectedAnimationController;
let activatedAnimationController;

function setModelData(modelData) {
  groups = [];
  enterGroupFolder = idleGroupFolder = null;
  openedGroup = openedGroupFolder = null;
  selectedAnimation = selectedAnimationController = null;
  activatedAnimationController = null;
  // model name and path
  Object.assign(root, { name: modelData.name, resource: modelData.resource });
  // animation group folders
  if (GroupsFolder) GroupsFolder.destroy();
  GroupsFolder = Data.addFolder("Animation Groups", true);
  GroupsFolder.onAccordion((folder) => {
    const index = GroupsFolder.folders.indexOf(folder);
    openedGroup = groups[index];
    openedGroupFolder = folder;
    updateOperationsControllers();
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
  updateOperationsControllers();
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
  updateOperationsControllers();
}

function deleteGroup() {
  openedGroup.forEach((animation) => {
    if (animation === selectedAnimation) {
      selectedAnimation = selectedAnimationController = null;
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
  updateOperationsControllers();
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
    if (animation === selectedAnimation) {
      selectedAnimation = selectedAnimationController = null;
    }
    const index = openedGroup.indexOf(animation);
    openedGroup.splice(index, 1);
    openedGroupFolder.controllers[index].destroy();
    updateMoveButtons();
    updateGroupFolderTitle(openedGroupFolder); // children count
    updateOperationsControllers(); // playable
    emitter.emit("delete-animation", animation);
  });

  setAnimationVoiceStyle(controller, !!animation.voice);
  setAnimationRepeatStyle(controller, animation.repeat);
  updateMoveButtons();
  updateGroupFolderTitle(openedGroupFolder);
  updateOperationsControllers();
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
  if (selectedAnimationController) selectedAnimationController.domElement.classList.remove("selected");
  if (!animation) {
    selectedAnimation = selectedAnimationController = null;
  } else {
    const index = openedGroup.findIndex((item) => item === animation);
    selectedAnimation = openedGroup[index];
    selectedAnimationController = openedGroupFolder.controllers[index];
    selectedAnimationController.domElement.classList.add("selected");
  }
}

function setAnimationVoiceStyle(controller, hasVoice) {
  controller.domElement.classList.toggle("has-voice", hasVoice);
}

function setAnimationRepeatStyle(controller, repeat) {
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
  const addedMap = {}; // { "voicePath": [[groupIndex, animationIndex], ...], ... }
  const validAddedMap = {}; // { "voicePath": count, ... }
  groups.forEach((group, groupIndex) => {
    group.forEach(({ voice }, animationIndex) => {
      if (voice) {
        addedMap[voice] ||= [];
        addedMap[voice].push([groupIndex, animationIndex]);
      }
    });
  });
  Object.entries(addedMap).forEach(([voicePath, list]) => {
    const isExists = voices.includes(voicePath);
    list.forEach(([groupIndex, animationIndex]) => {
      const folder = GroupsFolder.folders[groupIndex];
      const controller = folder.controllers[animationIndex];
      controller.domElement.classList.toggle("voice-missing", !isExists);
    });
    if (isExists) validAddedMap[voicePath] = list.length;
  });
  return validAddedMap;
}

function onAnimationStarted(animation) {
  if (!openedGroup) return;
  onAnimationStopped();
  const index = openedGroup.indexOf(animation);
  if (index !== -1) {
    activatedAnimationController = openedGroupFolder.controllers[index];
    activatedAnimationController.disable();
  } else {
    highlightGroup(animation);
  }
}

function onAnimationStopped() {
  if (activatedAnimationController) {
    activatedAnimationController.enable();
    activatedAnimationController = null;
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
  getAnimationMap() {
    const animationMap = {};
    groups.forEach((group) => {
      group.forEach((animation) => {
        animationMap[animation.name] = animation;
      });
    });
    return animationMap;
  },
  addAnimation,
  setSelectedAnimation,
  countAddedAnimations,
  countAddedVoices,
  get selectedAnimation() {
    return selectedAnimation;
  },
  updateAnimationVoiceStyle() {
    setAnimationVoiceStyle(selectedAnimationController, !!selectedAnimation.voice);
  },
  updateAnimationRepeatStyle() {
    setAnimationRepeatStyle(selectedAnimationController, selectedAnimation.repeat);
  },
  onAnimationStarted,
  onAnimationStopped,
};
