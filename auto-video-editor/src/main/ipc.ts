import { ipcMain, shell, app, type BrowserWindow } from "electron";
import { handleRequest } from "./request-handler";
import type { EditorBackend } from "./bootstrap";
export function registerIpc(b: EditorBackend, window: BrowserWindow) {
  ipcMain.handle("editor:request", async (event, payload) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error("UNAUTHORIZED_FRAME");
    return handleRequest(b, payload, {
      openFolder: (path) => shell.openPath(path),
      autostart: (value) => app.setLoginItemSettings({ openAtLogin: value }),
    });
  });
  b.runner.on("change", () => {
    if (!window.isDestroyed()) window.webContents.send("editor:changed");
  });
}
