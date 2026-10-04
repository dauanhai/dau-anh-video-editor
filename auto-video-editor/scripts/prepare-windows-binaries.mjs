import { existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const version = "4.0.530",
  dest = resolve("resources/windows-compositor"),
  archive = resolve(
    ".remotion",
    `remotion-compositor-win32-x64-msvc-${version}.tgz`,
  );
mkdirSync(dest, { recursive: true });
mkdirSync(".remotion", { recursive: true });
if (!existsSync(archive)) {
  execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    [
      "pack",
      `@remotion/compositor-win32-x64-msvc@${version}`,
      "--pack-destination",
      ".remotion",
    ],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
}
execFileSync("tar", ["-xzf", archive, "--strip-components=1", "-C", dest]);
for (const name of [
  "remotion.exe",
  "ffmpeg.exe",
  "ffprobe.exe",
  "avcodec-61.dll",
])
  if (!existsSync(resolve(dest, name)))
    throw new Error("MISSING_WINDOWS_BINARY: " + name);
console.log("Windows Remotion compositor resources verified.");
