# -*- coding: utf-8 -*-
"""Local web app: pick clips, order them, add keyword callouts, render.

Run: python server.py, then open http://127.0.0.1:5151 in a browser.
"""
from __future__ import annotations

import glob
import os
import sys
import threading
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

PROJECT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_tool_paths = [os.path.join(PROJECT_DIR, "tools", "python"), os.path.join(PROJECT_DIR, "tools", "ffmpeg", "bin")]
os.environ["PATH"] = os.pathsep.join(_tool_paths) + os.pathsep + os.environ.get("PATH", "")

from flask import Flask, jsonify, render_template, request, send_from_directory

import pipeline
EXCLUDE_PREFIXES = ("VIDEO_HOAN_CHINH", "VIDEO_TEST_XEM_THU", "final_test", "HIGHLIGHT_")

app = Flask(__name__)
JOBS: dict[str, dict] = {}


def list_clips() -> list[str]:
    files = []
    for path in sorted(glob.glob(os.path.join(PROJECT_DIR, "*.mp4"))):
        name = os.path.basename(path)
        if name.startswith(EXCLUDE_PREFIXES):
            continue
        files.append(name)
    return files


def _rgba_css(rgba) -> str:
    r, g, b = rgba[0], rgba[1], rgba[2]
    a = rgba[3] / 255.0 if len(rgba) > 3 else 1.0
    return f"rgba({r},{g},{b},{a:.2f})"


@app.route("/")
def index():
    styles_css = {
        key: {"label": v["label"], "plate_css": _rgba_css(v["plate"]), "text_css": _rgba_css(v["text"])}
        for key, v in pipeline.STYLE_PRESETS.items()
    }
    return render_template(
        "index.html", clips=list_clips(),
        fonts=pipeline.FONT_PRESETS, styles=styles_css,
        aspects=pipeline.ASPECT_RATIOS,
        default_font=pipeline.DEFAULT_FONT_KEY, default_style=pipeline.DEFAULT_STYLE_KEY,
        default_aspect=pipeline.DEFAULT_ASPECT_KEY,
    )


@app.route("/api/render", methods=["POST"])
def api_render():
    data = request.get_json(force=True)
    timeline = data.get("clips", [])
    hook = data.get("hook", {"enabled": False, "title": "", "accent": ""})
    music_enabled = data.get("music_enabled", True)
    aspect_key = data.get("aspect_key", pipeline.DEFAULT_ASPECT_KEY)
    if not timeline:
        return jsonify({"error": "Chua chon clip nao"}), 400

    job_id = uuid.uuid4().hex[:8]
    JOBS[job_id] = {"logs": [], "percent": 0, "done": False, "error": False, "output": None}
    t = threading.Thread(
        target=pipeline.run_pipeline,
        args=(PROJECT_DIR, timeline, hook, job_id, JOBS),
        kwargs={"music_enabled": music_enabled, "aspect_key": aspect_key},
        daemon=True,
    )
    t.start()
    return jsonify({"job_id": job_id})


MUSIC_DIR = os.path.join(PROJECT_DIR, "nhac")
ALLOWED_MUSIC_EXT = (".mp3", ".wav", ".m4a", ".aac")


@app.route("/api/music", methods=["GET"])
def api_music_list():
    os.makedirs(MUSIC_DIR, exist_ok=True)
    tracks = sorted(f for f in os.listdir(MUSIC_DIR) if f.lower().endswith(ALLOWED_MUSIC_EXT))
    return jsonify({"tracks": tracks})


@app.route("/api/music", methods=["POST"])
def api_music_upload():
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "Khong co file"}), 400
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in ALLOWED_MUSIC_EXT:
        return jsonify({"error": f"Chi nhan file {', '.join(ALLOWED_MUSIC_EXT)}"}), 400
    os.makedirs(MUSIC_DIR, exist_ok=True)
    safe_name = os.path.basename(f.filename)
    f.save(os.path.join(MUSIC_DIR, safe_name))
    return jsonify({"ok": True, "filename": safe_name})


RAW_DIR = os.path.join(PROJECT_DIR, "nguyen_lieu_dai")
ALLOWED_VIDEO_EXT = (".mp4", ".mov", ".m4v")


@app.route("/api/raw_videos", methods=["GET"])
def api_raw_videos_list():
    os.makedirs(RAW_DIR, exist_ok=True)
    files = sorted(f for f in os.listdir(RAW_DIR) if f.lower().endswith(ALLOWED_VIDEO_EXT))
    return jsonify({"files": files})


@app.route("/api/raw_videos", methods=["POST"])
def api_raw_videos_upload():
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "Khong co file"}), 400
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in ALLOWED_VIDEO_EXT:
        return jsonify({"error": f"Chi nhan file {', '.join(ALLOWED_VIDEO_EXT)}"}), 400
    os.makedirs(RAW_DIR, exist_ok=True)
    safe_name = os.path.basename(f.filename)
    f.save(os.path.join(RAW_DIR, safe_name))
    return jsonify({"ok": True, "filename": safe_name})


@app.route("/api/raw_videos/<path:filename>", methods=["DELETE"])
def api_raw_videos_delete(filename):
    path = os.path.join(RAW_DIR, os.path.basename(filename))
    if os.path.exists(path):
        os.remove(path)
    return jsonify({"ok": True})


@app.route("/api/render_highlight", methods=["POST"])
def api_render_highlight():
    data = request.get_json(force=True)
    files = data.get("files", [])
    target_duration = float(data.get("target_duration", 90))
    style_key = data.get("style_key", pipeline.DEFAULT_STYLE_KEY)
    font_key = data.get("font_key", pipeline.DEFAULT_FONT_KEY)
    auto_caption = bool(data.get("auto_caption", True))
    hook = data.get("hook", {"enabled": False, "title": "", "accent": ""})
    music_enabled = bool(data.get("music_enabled", True))
    aspect_key = data.get("aspect_key", pipeline.DEFAULT_ASPECT_KEY)
    if not files:
        return jsonify({"error": "Chua tai video dai nao len"}), 400

    job_id = uuid.uuid4().hex[:8]
    JOBS[job_id] = {"logs": [], "percent": 0, "done": False, "error": False, "output": None}
    t = threading.Thread(
        target=pipeline.run_highlight_pipeline,
        args=(PROJECT_DIR, RAW_DIR, files, target_duration, job_id, JOBS),
        kwargs={
            "style_key": style_key, "font_key": font_key,
            "auto_caption": auto_caption, "hook": hook, "music_enabled": music_enabled,
            "aspect_key": aspect_key,
        },
        daemon=True,
    )
    t.start()
    return jsonify({"job_id": job_id})


@app.route("/api/status/<job_id>")
def api_status(job_id):
    job = JOBS.get(job_id)
    if not job:
        return jsonify({"error": "not found"}), 404
    return jsonify(job)


@app.route("/video/<path:filename>")
def video(filename):
    return send_from_directory(PROJECT_DIR, filename)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5151, debug=False)
