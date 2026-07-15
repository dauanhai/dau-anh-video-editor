---
name: dau-anh-video-editor
description: Local Flask app that auto-edits Vietnamese short-form video — brand overlays, speech-synced captions, auto music, freeze-trim, crossfades, aspect-ratio standardization, and an experimental highlight-reel selector. Read this before touching app/pipeline.py — several fixes here came from real bugs that silently corrupted output; don't re-introduce them.
---

# Dau Anh Video Editor

A from-scratch render pipeline (ffmpeg + Pillow, no external video-editing
library) built to replace manual CapCut editing for a specific creator's
Vietnamese-language short-form content. Started as an adaptation of
[editvideoskill](https://github.com/PhongMenly/editvideoskill)'s brand style
constants, then grew into a full local web app.

## Architecture

`app/pipeline.py` is the entire engine — every function is plain Python/ffmpeg
subprocess calls, no Flask dependency. `app/server.py` is a thin Flask layer:
routes, file listing, background-thread job tracking with a `progress_store`
dict polled by the frontend. `app/templates/index.html` is one vanilla-JS page,
no build step, no framework.

Two render entry points, both converging on the same per-segment pipeline
(grade → optional captions/keywords → hook → crossfade concat → music):

- `run_pipeline()` — manual mode, explicit ordered clip list from the UI.
- `run_highlight_pipeline()` — analyzes long footage, auto-scores candidate
  segments, then calls `render_segment_list()` with its picks.
- `render_segment_list()` — the shared renderer. Call this directly with your
  own `[{file, start, end, text}, ...]` list to bypass the automatic scorer
  entirely. This is the intended integration point for a human (or Claude, in
  a chat session) to read the actual transcript and hand-curate an edit by
  topic/narrative instead of trusting a motion-based heuristic — see
  "Highlight mode's real limits" below.

## Hard-won bugs — don't re-introduce these

**Vietnamese font glyph coverage.** `Impact`, `Georgia Bold`, and `Comic Sans
Bold` (all standard Windows fonts) are missing 92 of 178 Vietnamese characters
— every horn vowel (ư, ơ) and every one of their tone-mark combinations. PIL
silently renders these as an invisible/near-invisible `.notdef` glyph instead
of erroring, so text like "người" quietly becomes "ng␣␣i" with no exception
raised. Checking `font.getmask(ch).getbbox()` or even pixel extrema is **not
enough** to catch this — the notdef box itself has nonzero pixels. The only
reliable check is the font's actual cmap table:

```python
from fontTools.ttLib import TTFont
cmap = TTFont(path, fontNumber=0).getBestCmap()
missing = [ch for ch in test_chars if ord(ch) not in cmap]
```

`FONT_PRESETS` only lists fonts verified this way (Segoe UI Bold, Arial Bold,
Verdana Bold, Tahoma Bold). If you add a font, run the cmap check against the
full Vietnamese alphabet (`aăâeêioôơuưy` × 6 tones × upper/lower, see git
history around this file for the exact test script) before adding it to the
picker.

**Freeze-trim must be gated on silence, not just visual stillness.** Talking-
head footage is often visually static while the person is actively speaking —
`ffmpeg freezedetect` alone flags this as "frozen" and a naive cut removes
live dialogue. `trim_freezes()` intersects `detect_freeze_ranges()` (video)
with `detect_silence_ranges()` (audio) and only cuts where *both* agree —
never trim on freeze detection alone.

**Whisper segment merging must cap at `HIGHLIGHT_MAX_SEG`.** Continuous
narration often has <0.4s gaps between every sentence, so a naive "merge if
gap < 0.4s" collapses an entire multi-minute clip into one candidate — which
then gets truncated to just its first few seconds when length-capped,
defeating the entire point of scanning the whole video. The merge loop in
`build_highlight_candidates()` checks cumulative duration before merging, not
just the gap.

**Overlay canvas must match the actual source resolution.** The upstream
`editvideoskill` kit assumes 1920×1080 landscape; this creator's source clips
are 720×1280 portrait. `build_overlay()` takes `w, h` from `ffprobe_info()` of
the actual clip, not a hardcoded constant — an overlay built for the wrong
canvas size silently mis-positions (or entirely clips) text.

**Hook titles need their own wrap + plate, and their own style.** A single-
line, unwrapped, plate-less title (the original quick implementation) overflows
off-frame on anything longer than ~4 words. `build_overlay()` wraps hook title
text via `wrap_text()` + `plate_tile_multiline()` exactly like captions, and
takes an independent `hook_style_key` — don't let it silently inherit
whichever clip happens to be first in the timeline.

## Highlight mode's real limits

`build_highlight_candidates()` scores segments by **technical signals only**:
fraction of the segment that's non-frozen (`score_dynamism`), and a mild
preference for ~4s length. There is no vision model, no aesthetic judgement,
no understanding of what's actually being said. It is explicitly *not* "AI
that knows what's beautiful" — it's the same class of heuristic every
auto-highlight feature in consumer editors uses.

It also cannot sequence multiple videos by topic/narrative — `select_highlight_segments()`
sorts picks back into `(clip_idx, start_time)` order, i.e. chronological
per-source-file, nothing smarter.

For anything that needs real content understanding — arranging clips by theme,
handling silent b-roll that gets narrated afterward, mixing multiple source
types coherently — the intended workflow is: call `build_highlight_candidates()`
or `transcribe_segments()` yourself to get the actual transcript with timing,
read/reason about it as an agent, then call `render_segment_list()` directly
with your own curated `[{file, start, end, text}]` order. Don't try to encode
"understand the topic" as a bigger pile of heuristics — that's the wrong tool
for it here.

## Style/brand system

`STYLE_PRESETS` and `FONT_PRESETS` in `pipeline.py` are user-selectable per
clip (and independently for the hook). `GRADE` is one shared color-grade
filter string applied uniformly to every clip. `ASPECT_RATIOS` defines the
three supported output sizes (9:16, 16:9, 4:5) — `normalize_aspect()`
scale+crops (never letterboxes/stretches) every clip to whichever one is
selected, since crossfade concat requires uniform resolution across all clips
in a render anyway.

## Copyright note (music)

The app never fetches "trending"/copyrighted music automatically — that would
be reproducing copyrighted material without a license. `pick_music_track()`
only picks randomly from whatever the user has manually placed in `nhac/`.
Don't change this to auto-source music from the web.
