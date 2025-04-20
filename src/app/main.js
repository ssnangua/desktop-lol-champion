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
      let closing = false;
      win.on("close", () => {
        if (closing) return;
        closing = true;
        if (onClose) onClose(win);
        win.close(true);
        delete wins[name];
      });
    });
  }
}

function openViewer() {
  openWindow("viewer");
}
function closeViewer() {
  wins.viewer.close();
}
function showViewer() {
  wins.viewer.show();
}
function hideViewer() {
  wins.viewer.hide();
}

function openEditor() {
  openWindow("editor", {
    onClose: () => {
      openViewer();
      process.emit("close-editor");
    },
  });
}

process.on("show-viewer", showViewer);
process.on("hide-viewer", hideViewer);
process.on("open-editor", () => {
  openEditor();
  closeViewer();
});
process.on("show-devtools", () => {
  wins[wins.viewer ? "viewer" : "editor"].showDevTools();
});

openViewer();
