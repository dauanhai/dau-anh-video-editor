import { ipcRequestSchema } from "../shared/ipc-contract";
import type { EditorBackend } from "./bootstrap";
export async function handleRequest(
  b: EditorBackend,
  payload: unknown,
  hooks: {
    openFolder: (path: string) => Promise<string>;
    autostart: (value: boolean) => void;
  },
) {
  const r = ipcRequestSchema.parse(payload);
  switch (r.method) {
    case "listJobs":
      return b.repo.list();
    case "getJob": {
      const j = b.repo.findById(r.args.id);
      if (!j) throw new Error("JOB_NOT_FOUND");
      return {
        ...j,
        previewUrl: j.checkpoint.previewPath
          ? await b.media.url(j.checkpoint.previewPath)
          : null,
        outputUrl: j.checkpoint.outputPath
          ? await b.media.url(j.checkpoint.outputPath)
          : null,
        events: b.repo.events(j.id),
      };
    }
    case "approveJob":
      return b.runner.approve(r.args.id, r.args.revision);
    case "reviseJob":
      return b.runner.revise(r.args.id, r.args.command, r.args.note);
    case "cancelJob":
      return b.runner.cancel(r.args.id);
    case "retryJob":
      return b.runner.retry(r.args.id);
    case "getSettings":
      return b.settings.value;
    case "saveSettings": {
      const s = await b.settings.save(r.args);
      hooks.autostart(s.autostart);
      await b.syncWatcher();
      return s;
    }
    case "openFolder":
      return hooks.openFolder(b.dirs[r.args.folder]);
  }
}
