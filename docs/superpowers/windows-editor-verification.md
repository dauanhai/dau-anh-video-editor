# Windows editor: implementation and verification

The implementation is on `feat/windows-remotion-editor`, alongside the existing Flask application. It is a first version for target-machine acceptance, not a verified Windows production release.

## Evidence

- TypeScript checking, 32 tests in 17 files, and production build passed on Linux.
- One browser E2E exercised the real watcher, SQLite queue, preview, revision, approval and final MP4 export. FFmpeg decoded the output successfully. The browser transport replaces Electron IPC only in tests.
- Real Remotion tests rendered preview and full-resolution MP4 from a generated silent source. Whisper with real Vietnamese speech has not been exercised.
- Windows x64 ZIP packaging completed. The packaged renderer, Python script and Windows compositor executables are outside ASAR. File presence does not establish Windows launch or playback.
- NSIS packaging could not complete on Linux because Wine is absent. A manually triggered Windows workflow provides the remaining packaging route; it has not been run here.

## Independent review and fixes

Six important findings were addressed in one fix pass: reserve jobs while revising to prevent stale approval; snapshot and checksum media/brand assets; package Windows compositor binaries externally; rescan changed/busy input files and check Windows exclusive access; estimate capacity from source size and duration; isolate report/log failures so later jobs proceed. Regression tests cover revision races, asset mutation, resumed copying, capacity estimates and failed report writes.

## Engineering rulings

1. Use npm instead of pnpm: standard install commands and a committed npm lockfile.
2. Add Electron/Remotion alongside Flask and call local Whisper through Python: reuse the local transcription approach, at the cost of a Python runtime prerequisite.
3. Use source-bound rules and tagged B-roll rather than a semantic AI provider: reproducible edits, with less automatic content understanding.
4. Snapshot originals instead of moving them: preserve input files, at the cost of extra disk space.
5. Avoid overlapping spoken segments by default: protect intelligibility, with simpler transitions.
6. Use built-in node:sqlite instead of a native SQLite addon: avoid Electron ABI rebuilds, accepting the runtime's experimental API status.
7. Use an npm-supplied Chromium and test-only network-interface fallback in this Linux environment: runnable render tests, with platform differences still requiring Windows testing.
8. Keep Python, FFmpeg, Whisper model and Chromium as documented setup prerequisites: a smaller initial packaging scope, with fully bundled offline installation deferred.
9. Use a browser bridge for real-backend E2E: verify processing and UI, while native Electron IPC, shell integration and autostart remain unverified on Windows.

## Remaining acceptance work

Run the packaged app and NSIS installer on Windows; exercise Vietnamese speech, fonts, logo, music, a long source, ten-video batches, restart recovery, autostart and folder permissions. Check preview playback and all finished videos manually. Supply reference edits and representative raw footage before tuning presets.

Deferred features: semantic highlights, learning style from reference videos, OCR privacy detection, word-level captions, face-aware crop, and comprehensive visual/audio QC. A minor review finding remains: output QC creates a default ffprobe inspector rather than honoring a custom `DAU_ANH_FFPROBE` path; installations with ffprobe on PATH are unaffected.
