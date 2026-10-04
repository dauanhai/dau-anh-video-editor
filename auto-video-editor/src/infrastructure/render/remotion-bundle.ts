import { selectComposition, renderMedia } from "@remotion/renderer";
import type { EditPlan } from "../../domain/edit-plan";
import { MediaServer } from "./media-server";
import { checkPlan, checkAssets, checkOutput } from "../qc/quality-checker";
import { mkdir, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
export class RemotionRenderer {
  private serveUrl: Promise<string> | null = null;
  constructor(
    private entry: string,
    private media: MediaServer,
    private browserExecutable?: string,
    private prebuilt = false,
    private binariesDirectory?: string,
  ) {}
  async render(
    plan: EditPlan,
    output: string,
    preview = false,
    onProgress: (p: number) => void = () => {},
  ) {
    checkPlan(plan);
    await checkAssets(plan);
    const resolved = structuredClone(plan);
    for (const s of resolved.segments) s.file = await this.media.url(s.file);
    for (const b of resolved.broll) b.file = await this.media.url(b.file);
    if (resolved.music)
      resolved.music.file = await this.media.url(resolved.music.file);
    if (resolved.brand.logo)
      resolved.brand.logo = await this.media.url(resolved.brand.logo);
    if (resolved.brand.fontFile)
      resolved.brand.fontFile = await this.media.url(resolved.brand.fontFile);
    if (!this.serveUrl)
      this.serveUrl = this.prebuilt
        ? Promise.resolve(this.entry)
        : import("@remotion/bundler").then(({ bundle }) =>
            bundle({ entryPoint: this.entry }),
          );
    const serveUrl = await this.serveUrl;
    const options = {
      serveUrl,
      binariesDirectory: this.binariesDirectory,
      inputProps: { plan: resolved },
      browserExecutable: this.browserExecutable,
      chromiumOptions: { disableWebSecurity: false, gl: "swangle" as const },
    };
    const composition = await selectComposition({ ...options, id: "AutoEdit" });
    await mkdir(dirname(output), { recursive: true });
    const temp = output + ".partial.mp4";
    try {
      await renderMedia({
        ...options,
        composition,
        codec: "h264",
        audioCodec: "aac",
        outputLocation: temp,
        concurrency: 1,
        scale: preview ? 0.5 : 1,
        crf: preview ? 28 : 20,
        onProgress: ({ progress }) => onProgress(Math.round(progress * 100)),
        timeoutInMilliseconds: 120000,
      });
      await checkOutput(temp, plan, undefined, preview ? 0.5 : 1);
      await rename(temp, output);
    } catch (e) {
      await unlink(temp).catch(() => {});
      throw e;
    }
    return output;
  }
}
