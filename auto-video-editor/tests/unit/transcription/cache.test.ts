import { it, expect } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CachedTranscriptionEngine } from "../../../src/infrastructure/transcription/cached-transcription-engine";
it("cache retains real transcript and provider version invalidates it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cache-"));
  let calls = 0;
  const provider = {
    version: "v1",
    async transcribe() {
      calls++;
      return [
        {
          text: "Xin chào",
          startMs: 0,
          endMs: 1000,
          timestampMs: 500,
          confidence: null,
        },
      ];
    },
  };
  const e = new CachedTranscriptionEngine(dir, provider);
  const j = { file: "x", checksum: "a".repeat(64) };
  const m = { hasAudio: true };
  expect((await e.transcribe(j, m)).captions[0].text).toBe("Xin chào");
  await e.transcribe(j, m);
  expect(calls).toBe(1);
  await new CachedTranscriptionEngine(dir, {
    ...provider,
    version: "v2",
  }).transcribe(j, m);
  expect(calls).toBe(2);
  expect((await e.transcribe(j, { hasAudio: false })).warnings).toContain(
    "NO_AUDIO_TRACK",
  );
  expect(calls).toBe(2);
});
