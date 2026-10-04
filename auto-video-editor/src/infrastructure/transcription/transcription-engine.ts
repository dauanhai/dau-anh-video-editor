import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TranscriptionProvider } from "./provider";
const run = promisify(execFile);
export class LocalWhisperProvider implements TranscriptionProvider {
  readonly version = "whisper-small-vi-v1";
  constructor(
    private script: string,
    private python = process.env.DAU_ANH_PYTHON || "python",
  ) {}
  async transcribe(input: { file: string }) {
    const { stdout } = await run(this.python, [this.script, input.file], {
      timeout: 30 * 60 * 1000,
      maxBuffer: 20 * 1024 ** 2,
      windowsHide: true,
    });
    return JSON.parse(stdout);
  }
}
