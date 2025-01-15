require("./app/global/settings.cjs");
require("./app/global/data.cjs");
require("./app/tray.cjs");

const WINS = {
  viewer: {
    url: "app/viewer.html",
    options: {
      id: "viewer",
      icon: "app/icon.png",
      frame: false,
      transparent: true,
      resizable: false,
      width: 400,
      height: 300,
      always_on_top: true,
      show_in_taskbar: false,
    },
  },
  editor: {
    url: "app/editor.html",
    options: {
      id: "editor",
      icon: "app/icon.png",
      width: 1280,
      height: 720,
    },
  },
};

const wins = {};
function openWindow(name, { onOpen, onClose } = {}) {
  const { url, options } = WINS[name];
  const win = wins[name];
  if (win) {
    win.show();
    win.restore();
    win.focus();
  } else {
    nw.Window.open(url, options, (win) => {
      wins[name] = win;
      if (onOpen) onOpen(win);
      win.on("close", () => {
        win.close(true);
        if (onClose) onClose(win);
        delete wins[name];
      });
    });
  }
}

function openViewer() {
  openWindow("viewer");
}
function showViewer() {
  wins.viewer.show();
}
function hideViewer() {
  wins.viewer.hide();
}

function openEditor() {
  hideViewer();
  openWindow("editor", {
    onClose: () => {
      process.emit("close-editor");
      showViewer();
    },
  });
}

process.on("show-viewer", showViewer);
process.on("hide-viewer", hideViewer);
process.on("open-editor", openEditor);

openViewer();
