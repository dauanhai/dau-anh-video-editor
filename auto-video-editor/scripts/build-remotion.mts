import { execFileSync } from "node:child_process";
execFileSync(process.execPath, ["scripts/prepare-windows-binaries.mjs"], {
  stdio: "inherit",
});
import { bundle } from "@remotion/bundler";
import { resolve } from "node:path";
await bundle({
  entryPoint: resolve("src/remotion/index.ts"),
  outDir: resolve("dist/remotion"),
});
