const menu = require("./menu.cjs");

const tray = new nw.Tray({
  title: nw.App.manifest.title,
  tooltip: nw.App.manifest.title,
  icon: "./app/icon.png",
  alticon: "./app/icon.png",
  menu,
});
tray.on("click", () => {
  menu.itemsMap["viewer"].click();
});
