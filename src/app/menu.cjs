const itemMap = {}; // { "itemName": MenuItem }
function createMenu(items, option = { type: "contextmenu" }) {
  const menu = new nw.Menu(option);
  items.forEach((item) => {
    const { name, ...option } = item;
    if (option.submenu) option.submenu = createMenu(option.submenu);
    const menuItem = new nw.MenuItem(option);
    if (name) itemMap[name] = menuItem;
    menu.append(menuItem);
  });
  return menu;
}

function getPercentItems(name, values) {
  return values.map((value) => {
    const label = `${value * 100}%`;
    return {
      label,
      type: "checkbox",
      checked: value === global.settings[name],
      enabled: value !== global.settings[name],
      click() {
        /* update global */ global.settings[name] = value;
        itemMap[name].submenu.items.forEach((item) => {
          item.checked = item.label === label;
          item.enabled = !item.checked;
        });
      },
    };
  });
}

const devTools = [
  {
    label: "DevTools",
    click() {
      nw.Window.get().showDevTools();
    },
  },
  {
    label: "Backgroud DevTools",
    click() {
      chrome.developerPrivate.openDevTools({
        renderViewId: -1,
        renderProcessId: -1,
        extensionId: chrome.runtime.id,
      });
    },
  },
  { type: "separator" },
];

const menu = createMenu([
  {
    name: "viewer",
    label: "Hide",
    click() {
      const isHide = this.label === "Hide";
      this.label = isHide ? "Show" : "Hide";
      itemMap.paused.enabled = !isHide;
      itemMap.capture.enabled = !isHide;
      process.emit(isHide ? "hide-viewer" : "show-viewer");
    },
  },
  {
    name: "model",
    label: "Model",
    submenu: [],
  },
  { type: "separator" },
  {
    name: "mute",
    label: "Mute",
    type: "checkbox",
    checked: global.settings.isMute,
    click() {
      itemMap.volume.enabled = !this.checked;
      itemMap.voice.enabled = !this.checked;
      /* update global */ global.settings.isMute = this.checked;
    },
  },
  {
    name: "volume",
    label: "Volume",
    enabled: !global.settings.isMute,
    submenu: getPercentItems("volume", [0.25, 0.5, 0.75, 1]),
  },
  {
    name: "voice",
    label: "Voice",
    enabled: !global.settings.isMute,
    submenu: getPercentItems("voice", [0.1, 0.3, 0.5, 1]),
  },
  { type: "separator" },
  {
    name: "paused",
    label: "Paused",
    type: "checkbox",
    checked: false,
    key: "p",
    click() {
      process.emit("toggle-paused");
    },
  },
  {
    name: "capture",
    label: "Capture",
    key: "s",
    modifiers: "ctrl",
    click() {
      process.emit("capture");
    },
  },
  { type: "separator" },
  {
    name: "editor",
    label: "Editor",
    click() {
      process.emit("open-editor");
    },
  },
  { type: "separator" },
  ...(process.versions["nw-flavor"] === "sdk" ? devTools : []),
  {
    label: "About",
    click() {
      const about = [
        `${nw.App.manifest.title} - v${nw.App.manifest.version}`,
        "",
        "Made with ❤️ by @ssnangua",
        "",
        `${nw.App.manifest.homepage}`,
      ];
      alert(about.join("\n"));
    },
  },
  {
    label: "Exit",
    click() {
      nw.App.quit();
    },
  },
]);

function setEnabled(enabledMap) {
  Object.entries(enabledMap).forEach(([name, enabled]) => {
    itemMap[name].enabled = enabled;
  });
}

process.on("show-viewer", () => {
  itemMap.viewer.label = "Hide";
  itemMap.paused.enabled = true;
  itemMap.capture.enabled = true;
});

process.on("paused-changed", (paused) => {
  itemMap.paused.checked = paused;
});

process.on("open-editor", () => {
  itemMap.viewer.label = "Show";
  setEnabled({
    viewer: false,
    model: false,
    mute: false,
    volume: true,
    voice: false,
    paused: false,
    capture: false,
    editor: false,
  });
});

process.on("close-editor", () => {
  itemMap.viewer.label = "Hide";
  setEnabled({
    viewer: true,
    model: true,
    mute: true,
    volume: !global.settings.isMute,
    voice: !global.settings.isMute,
    paused: true,
    capture: true,
    editor: true,
  });
});

process.on("model-list-changed", (modelList) => {
  const menu = itemMap.model.submenu;
  while (menu.items.length > 0) menu.removeAt(0);
  modelList.forEach((model) => {
    const menuItem = new nw.MenuItem({
      label: model,
      type: "checkbox",
      checked: model === global.settings.model,
      enabled: model !== global.settings.model,
      click() {
        itemMap.model.submenu.items.forEach((item) => {
          item.checked = item.label === model;
          item.enabled = !item.checked;
        });
        process.emit("model-changed", model);
      },
    });
    menu.append(menuItem);
  });
});

module.exports = menu;
