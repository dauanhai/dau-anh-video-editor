import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { captionSchema } from "../../domain/edit-plan";
import { atomicJson } from "../filesystem/atomic-file";
import type { TranscriptionProvider } from "./provider";
export class CachedTranscriptionEngine {
  constructor(
    private dir: string,
    private provider: TranscriptionProvider,
  ) {}
  async transcribe(
    job: { file: string; checksum: string },
    media: { hasAudio: boolean },
  ) {
    if (!media.hasAudio) return { captions: [], warnings: ["NO_AUDIO_TRACK"] };
    const key = createHash("sha256")
        .update(job.checksum + ":" + this.provider.version)
        .digest("hex"),
      path = join(this.dir, key + ".json");
    try {
      const data = JSON.parse(await readFile(path, "utf8"));
      return { captions: z.array(captionSchema).parse(data), warnings: [] };
    } catch {}
    const captions = z
      .array(captionSchema)
      .parse(await this.provider.transcribe(job));
    await atomicJson(path, captions);
    return { captions, warnings: [] };
  }
}
