import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
const root = "release/win-unpacked";
const needed = [
  "Dau Anh Video Editor.exe",
  "resources/app.asar",
  "resources/remotion/index.html",
  "resources/scripts/transcribe.py",
  "resources/remotion-binaries/remotion.exe",
  "resources/remotion-binaries/ffmpeg.exe",
  "resources/remotion-binaries/ffprobe.exe",
];
const missing = needed.filter((p) => !existsSync(join(root, p)));
if (missing.length)
  throw new Error("Missing packaged resources: " + missing.join(", "));
const installers = readdirSync("release").filter((f) => f.endsWith(".exe"));
if (!installers.length) throw new Error("NSIS installer missing");
console.log(
  JSON.stringify({
    installer: installers,
    resources: "verified",
    windowsLaunch:
      "Requires target-machine smoke test; not inferred from file presence",
  }),
);
