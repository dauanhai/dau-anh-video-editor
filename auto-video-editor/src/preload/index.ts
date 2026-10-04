import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("editorApi", {
  invoke: (method: string, args: unknown = {}) =>
    ipcRenderer.invoke("editor:request", { method, args }),
  onChange: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("editor:changed", listener);
    return () => ipcRenderer.removeListener("editor:changed", listener);
  },
});
