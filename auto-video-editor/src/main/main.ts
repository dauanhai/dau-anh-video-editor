import { app, BrowserWindow } from "electron";
import { join, resolve } from "node:path";
import { bootstrap, type EditorBackend } from "./bootstrap";
import { registerIpc } from "./ipc";
import { notifyDone } from "../infrastructure/notifications/windows-notifier";
let backend: EditorBackend | undefined,
  quitting = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app
    .whenReady()
    .then(async () => {
      const project = app.isPackaged ? "" : resolve(__dirname, "../..");
      const root =
        process.env.DAU_ANH_EDITOR_ROOT ||
        join(app.getPath("documents"), "DauAnhVideoEditor");
      backend = await bootstrap(
        root,
        project,
        app.isPackaged,
        process.resourcesPath,
      );
      const window = new BrowserWindow({
        width: 1360,
        height: 900,
        minWidth: 1000,
        minHeight: 720,
        backgroundColor: "#0b1020",
        webPreferences: {
          preload: join(__dirname, "../preload/index.js"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      registerIpc(backend, window);
      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event, url) => {
        if (url !== window.webContents.getURL()) event.preventDefault();
      });
      backend.runner.on("change", (j) => {
        if (j.status === "completed" && backend?.settings.value.notifications)
          notifyDone("Đậu Ánh Video Editor", "Một video đã xuất xong.");
      });
      if (process.env.ELECTRON_RENDERER_URL)
        await window.loadURL(process.env.ELECTRON_RENDERER_URL);
      else await window.loadFile(join(__dirname, "../renderer/index.html"));
      window.on("close", (e) => {
        if (!quitting) {
          e.preventDefault();
          window.hide();
        }
      });
      app.on("second-instance", () => {
        window.show();
        window.focus();
      });
    })
    .catch((e) => {
      console.error("Editor startup failed:", e.message);
      app.quit();
    });
  app.on("before-quit", (e) => {
    if (backend && !quitting) {
      e.preventDefault();
      quitting = true;
      void backend.close().finally(() => app.quit());
    }
  });
}
