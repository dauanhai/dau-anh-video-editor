# App Edit Video Đậu Ánh

Local web app that auto-edits short-form Vietnamese video: brand-styled overlays,
speech-synced captions, auto background music, and an experimental "highlight
reel" mode that picks the best moments out of long raw footage.

Runs entirely on your own machine — no cloud API, no per-render cost. The only
network call is a one-time download of the Whisper speech-recognition model on
first use.

## Features

- **Manual timeline editor** — pick clips, reorder, add keyword callouts or an
  opening hook, per-clip playback speed, 6 color styles, 4 Vietnamese-safe fonts.
- **Auto captions** — local Whisper speech-to-text syncs captions to what's
  actually being said, no manual timing.
- **Decorative scrolling ticker** — separate from captions; a fixed message you
  type yourself (e.g. a channel handle), independent on/off.
- **Auto background music** — mixes a random track from your own `nhac/` folder
  under the video's own audio, looped/faded/ducked automatically.
- **Duplicate/freeze trimming** — cuts dead, frozen stretches, but only where
  the audio is *also* silent, so it never chops live speech.
- **Crossfade transitions** between clips instead of hard cuts.
- **Aspect ratio standardization** — 9:16 / 16:9 / 4:5, scale+crop every clip to
  one consistent output size.
- **Highlight mode** — upload long raw footage; the app transcribes it, scores
  each spoken segment by how dynamic (non-frozen) it is, and assembles a short
  cut from the best moments. This is a technical heuristic, not real aesthetic
  judgement — see `SKILL.md` for the honest limits and the recommended
  human/Claude-curated alternative for anything that needs real editorial judgement.
- Mobile-friendly UI — usable from a phone on the same LAN as the machine
  running the server.

## Setup

Requires Python 3.10+ and ffmpeg on your `PATH` (or drop portable builds into
`tools/python/` and `tools/ffmpeg/bin/` next to this README — `server.py`
prepends those to `PATH` automatically if present).

```bash
pip install -r requirements.txt
```

Fonts used (`Segoe UI Bold`, `Arial Bold`, `Verdana Bold`, `Tahoma Bold`) are
standard Windows fonts. On non-Windows systems, edit `FONT_PRESETS` in
`app/pipeline.py` to point at fonts you have — see `SKILL.md` for why not just
any bold font works for Vietnamese text.

## Run

```bash
python app/server.py
```

Open `http://127.0.0.1:5151`. To use from a phone on the same WiFi, open
`http://<this-machine's-LAN-IP>:5151` instead (find the IP with `ipconfig` /
`ifconfig`) — note this exposes render control to anyone on that network, there
is no auth.

Put your own clips as `.mp4` files in the project root (one level above
`app/`) — they'll show up in the clip list automatically.

## Project layout

```
app/
  server.py      Flask app, routes, job/progress tracking
  pipeline.py    All the actual video work (ffmpeg + Pillow), no Flask deps
  templates/
    index.html   Single-page UI, vanilla JS, no build step
```

`pipeline.py` has no dependency on Flask or the web layer — every function in
it is a plain Python function you can call directly (see `SKILL.md` for how
this is used to let a human, or Claude, curate an edit by hand instead of
trusting the automatic scorer).

## Credit

Brand style constants (colors, plate style, easing, no outline-stroke
captions) originally sourced from
[editvideoskill](https://github.com/PhongMenly/editvideoskill)
(`video-brand-kit`), adapted here for portrait AI-generated source footage
and extended with a full render pipeline.
