# -*- coding: utf-8 -*-
"""Core render pipeline for the video-brand-kit local app.

Adapts the style constants from editvideoskill/SKILL.md (neon yellow,
Segoe UI Bold, soft dark plates, cubic easing, no outline strokes) to
whatever the source clip's actual resolution is, since the kit itself
assumes a 1920x1080 landscape canvas and these source clips are 720x1280
portrait.
"""
from __future__ import annotations

import json
import os
import random
import re
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

WHITE = (255, 255, 255)
NEON = (255, 240, 0)
PLATE_RGBA = (12, 12, 12, 165)


# Only fonts confirmed (via fontTools cmap check) to cover the full Vietnamese
# alphabet — Impact/Georgia/Comic Sans Bold were tested and drop 92/178 Vietnamese
# characters (all horn vowels ư/ơ and their tone marks), silently mangling captions.
FONT_PRESETS = {
    "segoe":   {"label": "Segoe UI Bold (mac dinh)", "path": r"C:\Windows\Fonts\segoeuib.ttf"},
    "arial":   {"label": "Arial Bold (co dien)",       "path": r"C:\Windows\Fonts\arialbd.ttf"},
    "verdana": {"label": "Verdana Bold (tron, ro)",    "path": r"C:\Windows\Fonts\verdanab.ttf"},
    "tahoma":  {"label": "Tahoma Bold (gon, de doc)",  "path": r"C:\Windows\Fonts\tahomabd.ttf"},
}
DEFAULT_FONT_KEY = "segoe"

# Named style presets for the keyword-tag plate + hook text, in the spirit of
# CapCut's "Phong cach" swatches — plate color, text color, accent color.
STYLE_PRESETS = {
    "neon_vang":  {"label": "Vang neon (mac dinh)", "plate": (12, 12, 12, 165),  "text": WHITE,          "accent": (255, 240, 0)},
    "tim_hot":    {"label": "Tim hot trend",         "plate": (123, 47, 247, 210), "text": WHITE,        "accent": (255, 240, 0)},
    "do_noi_bat": {"label": "Do noi bat",            "plate": (214, 32, 32, 215),  "text": WHITE,        "accent": (255, 220, 0)},
    "trang_toi_gian": {"label": "Trang toi gian",    "plate": (245, 245, 245, 225), "text": (20, 20, 20), "accent": (214, 32, 32)},
    "vang_ruc":   {"label": "Vang ruc",              "plate": (255, 200, 0, 225),   "text": (20, 20, 20), "accent": (20, 20, 20)},
    "xanh_bien":  {"label": "Xanh bien",              "plate": (20, 90, 160, 210),  "text": WHITE,        "accent": (120, 220, 255)},
}
DEFAULT_STYLE_KEY = "neon_vang"

ASPECT_RATIOS = {
    "9:16": {"label": "Doc 9:16 (TikTok/Reels/Shorts)", "w": 1080, "h": 1920},
    "16:9": {"label": "Ngang 16:9 (YouTube)", "w": 1920, "h": 1080},
    "4:5": {"label": "Vuong 4:5 (Instagram feed)", "w": 1080, "h": 1350},
}
DEFAULT_ASPECT_KEY = "9:16"

GRADE = (
    "eq=contrast=1.06:brightness=0.0:saturation=1.0,"
    "curves=master='0/0 0.25/0.23 0.75/0.77 1/1',"
    "smartblur=lr=1.2:ls=0.3:lt=12.0"
)

HOOK_DURATION = 2.0
KW_DURATION = 1.3
KW_REVEAL = 0.3
KW_FADE = 0.3


def ease_out_cubic(t: float) -> float:
    return 1 - (1 - t) ** 3


def ease_in_out_cubic(t: float) -> float:
    if t < 0.5:
        return 4 * t ** 3
    return 1 - (-2 * t + 2) ** 3 / 2


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def ffprobe_info(path: str) -> tuple[int, int, float, float]:
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate",
        "-show_entries", "format=duration",
        "-of", "json", path,
    ]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    data = json.loads(out)
    stream = data["streams"][0]
    w, h = int(stream["width"]), int(stream["height"])
    num, den = stream["r_frame_rate"].split("/")
    fps = float(num) / float(den)
    duration = float(data["format"]["duration"])
    return w, h, fps, duration


def text_tile(text: str, font: ImageFont.FreeTypeFont, color: tuple[int, int, int]) -> Image.Image:
    meas = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    bbox = meas.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    margin = 6
    tile = Image.new("RGBA", (tw + margin * 2, th + margin * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    d.text((margin - bbox[0], margin - bbox[1]), text, font=font, fill=color + (255,))
    return tile


def plate_tile(text: str, font: ImageFont.FreeTypeFont, pad_h: int, pad_v: int, radius: int,
               plate_rgba: tuple[int, int, int, int] = PLATE_RGBA,
               text_rgb: tuple[int, int, int] = WHITE) -> Image.Image:
    meas = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    bbox = meas.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    w, h = tw + 2 * pad_h, th + 2 * pad_v
    margin = 8
    tile = Image.new("RGBA", (w + margin * 2, h + margin * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    rect = [margin, margin, w + margin, h + margin]
    d.rounded_rectangle(rect, radius=radius, fill=plate_rgba)
    tx = margin + pad_h - bbox[0]
    ty = margin + pad_v - bbox[1]
    d.text((tx, ty), text, font=font, fill=text_rgb + (255,))
    return tile


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    meas = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    lines: list[str] = []
    current = ""
    for word in words:
        trial = (current + " " + word).strip()
        bbox = meas.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def text_tile_multiline(lines: list[str], font: ImageFont.FreeTypeFont, color: tuple[int, int, int],
                         line_gap: int = 4) -> Image.Image:
    meas = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    bboxes = [meas.textbbox((0, 0), ln, font=font) for ln in lines]
    widths = [b[2] - b[0] for b in bboxes]
    heights = [b[3] - b[1] for b in bboxes]
    content_w = max(widths) if widths else 0
    content_h = sum(heights) + line_gap * max(0, len(lines) - 1)
    margin = 6
    tile = Image.new("RGBA", (content_w + margin * 2, content_h + margin * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    y = margin
    for ln, bbox, lh in zip(lines, bboxes, heights):
        lw = bbox[2] - bbox[0]
        x = margin + (content_w - lw) / 2.0 - bbox[0]
        d.text((x, y - bbox[1]), ln, font=font, fill=color + (255,))
        y += lh + line_gap
    return tile


def plate_tile_multiline(lines: list[str], font: ImageFont.FreeTypeFont, pad_h: int, pad_v: int, radius: int,
                          plate_rgba: tuple[int, int, int, int], text_rgb: tuple[int, int, int],
                          line_gap: int = 6) -> Image.Image:
    meas = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    bboxes = [meas.textbbox((0, 0), ln, font=font) for ln in lines]
    widths = [b[2] - b[0] for b in bboxes]
    heights = [b[3] - b[1] for b in bboxes]
    content_w = max(widths) if widths else 0
    content_h = sum(heights) + line_gap * max(0, len(lines) - 1)
    w, h = content_w + 2 * pad_h, content_h + 2 * pad_v
    margin = 8
    tile = Image.new("RGBA", (w + margin * 2, h + margin * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle([margin, margin, w + margin, h + margin], radius=radius, fill=plate_rgba)
    y = margin + pad_v
    for ln, bbox, lh in zip(lines, bboxes, heights):
        lw = bbox[2] - bbox[0]
        x = margin + pad_h + (content_w - lw) / 2.0 - bbox[0]
        d.text((x, y - bbox[1]), ln, font=font, fill=text_rgb + (255,))
        y += lh + line_gap
    return tile


_WHISPER_MODEL = None


def get_whisper_model():
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        from faster_whisper import WhisperModel
        _WHISPER_MODEL = WhisperModel("small", device="cpu", compute_type="int8")
    return _WHISPER_MODEL


def transcribe_segments(path: str, log=print) -> list[tuple[str, float, float]]:
    """Speech-to-text with per-segment timing, so captions land in sync with speech."""
    log("  dang nghe loi thoai (AI)...")
    model = get_whisper_model()
    segments, _info = model.transcribe(path, language="vi", vad_filter=True)
    result = [(s.text.strip(), s.start, s.end) for s in segments if s.text.strip()]
    log(f"  nhan dien duoc {len(result)} cau thoai")
    return result


FREEZE_START_RE = re.compile(r"freeze_start:\s*([\d.]+)")
FREEZE_END_RE = re.compile(r"freeze_end:\s*([\d.]+)")
SILENCE_START_RE = re.compile(r"silence_start:\s*([\d.]+)")
SILENCE_END_RE = re.compile(r"silence_end:\s*([\d.]+)")


def detect_freeze_ranges(path: str, min_duration: float = 0.6, noise_db: int = -30) -> list[tuple[float, float]]:
    """Find static/frozen (duplicate-frame) stretches using ffmpeg's freezedetect filter."""
    cmd = [
        "ffmpeg", "-i", path,
        "-vf", f"freezedetect=n={noise_db}dB:d={min_duration}",
        "-an", "-f", "null", "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    starts = [float(x) for x in FREEZE_START_RE.findall(proc.stderr)]
    ends = [float(x) for x in FREEZE_END_RE.findall(proc.stderr)]
    return list(zip(starts, ends))


def detect_silence_ranges(path: str, duration: float, noise_db: int = -35, min_duration: float = 0.3) -> list[tuple[float, float]]:
    """Find silent stretches on the audio track, so freeze-cuts never land on live speech."""
    if not has_audio_stream(path):
        return [(0.0, duration)]
    cmd = [
        "ffmpeg", "-i", path,
        "-af", f"silencedetect=noise={noise_db}dB:d={min_duration}",
        "-vn", "-f", "null", "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    starts = [float(x) for x in SILENCE_START_RE.findall(proc.stderr)]
    ends = [float(x) for x in SILENCE_END_RE.findall(proc.stderr)]
    if len(ends) < len(starts):
        ends.append(duration)
    return list(zip(starts, ends))


def intersect_ranges(a_ranges: list[tuple[float, float]], b_ranges: list[tuple[float, float]],
                      min_overlap: float = 0.2) -> list[tuple[float, float]]:
    result = []
    for a_s, a_e in a_ranges:
        for b_s, b_e in b_ranges:
            s, e = max(a_s, b_s), min(a_e, b_e)
            if e - s >= min_overlap:
                result.append((s, e))
    return result


def trim_freezes(path: str, out_path: str, log=print) -> bool:
    """Cut out frozen/duplicate-frame stretches, but only where the audio is also silent —
    never cut a range that overlaps live speech, even if the video looks visually static there."""
    duration = ffprobe_info(path)[3]
    freeze_ranges = detect_freeze_ranges(path)
    if not freeze_ranges:
        return False
    silence_ranges = detect_silence_ranges(path, duration)
    ranges = intersect_ranges(freeze_ranges, silence_ranges)
    if not ranges:
        return False
    keep_expr = "+".join(f"between(t,{s:.3f},{e:.3f})" for s, e in ranges)
    cmd = [
        "ffmpeg", "-y", "-i", path,
        "-vf", f"select='not({keep_expr})',setpts=N/FRAME_RATE/TB",
        "-af", f"aselect='not({keep_expr})',asetpts=N/SR/TB",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    total_cut = sum(e - s for s, e in ranges)
    log(f"  cat {len(ranges)} doan dung hinh/trung lap, bo {total_cut:.2f}s")
    return True


def resolve_font_path(font_key: str) -> str:
    return FONT_PRESETS.get(font_key, FONT_PRESETS[DEFAULT_FONT_KEY])["path"]


def resolve_style(style_key: str) -> dict:
    return STYLE_PRESETS.get(style_key, STYLE_PRESETS[DEFAULT_STYLE_KEY])


def paste_scaled_faded(canvas: Image.Image, tile: Image.Image, cx: float, cy: float, scale: float, alpha: float) -> None:
    if alpha <= 0.0:
        return
    tw, th = tile.size
    nw, nh = max(1, int(round(tw * scale))), max(1, int(round(th * scale)))
    scaled = tile.resize((nw, nh), Image.LANCZOS)
    if alpha < 0.999:
        r, g, b, a = scaled.split()
        a = a.point(lambda p, m=alpha: int(p * m))
        scaled = Image.merge("RGBA", (r, g, b, a))
    px, py = int(round(cx - nw / 2.0)), int(round(cy - nh / 2.0))
    canvas.alpha_composite(scaled, (px, py))


def plan_keyword_slots(keywords: list[str], duration: float, hook_enabled: bool):
    """Evenly space keyword tags across the clip, after the hook window if present."""
    if not keywords:
        return []
    start_zone = (HOOK_DURATION + 0.4) if hook_enabled else 0.3
    end_zone = duration - 0.3
    available = max(0.5, end_zone - start_zone)
    n = len(keywords)
    slot = available / n
    tag_dur = min(KW_DURATION, max(0.8, slot - 0.2))
    slots = []
    for i, kw in enumerate(keywords):
        slot_start = start_zone + i * slot
        centered_start = slot_start + max(0.0, (slot - tag_dur) / 2.0)
        slots.append((kw, centered_start, tag_dur))
    return slots


def build_overlay(w: int, h: int, fps: float, duration: float, keywords: list[str],
                   hook_enabled: bool, hook_title: str, hook_accent: str,
                   out_path: str, log=print,
                   font_key: str = DEFAULT_FONT_KEY, style_key: str = DEFAULT_STYLE_KEY,
                   hook_style_key: str | None = None,
                   marquee_text: str = "", marquee_position: str = "bottom",
                   captions: list[tuple[str, float, float]] | None = None) -> None:
    font_path = resolve_font_path(font_key)
    style = resolve_style(style_key)
    hook_style = resolve_style(hook_style_key) if hook_style_key else style

    title_size = max(28, round(43 * w / 720))
    accent_size = max(12, round(17 * w / 720))
    kw_font_size = max(16, round(25 * w / 720))
    caption_font_size = max(16, round(24 * w / 720))
    marquee_font_size = max(14, round(22 * w / 720))
    cx = w // 2
    bar_half_w = round(60 * w / 720)
    kw_cy = round(1133 * h / 1280)
    caption_cy = round(1133 * h / 1280)
    pad_h, pad_v, radius = round(18 * w / 720), round(10 * w / 720), round(12 * w / 720)

    title_tile_img = accent_tile_img = None
    title_cy = accent_cy = bar_cy = 0
    if hook_enabled:
        title_font = ImageFont.truetype(font_path, title_size, index=0)
        accent_font = ImageFont.truetype(font_path, accent_size, index=0)

        title_pad_h, title_pad_v, title_radius = round(22 * w / 720), round(14 * w / 720), round(16 * w / 720)
        max_title_w = round(w * 0.82)
        title_lines = wrap_text(hook_title, title_font, max_title_w)
        title_tile_img = plate_tile_multiline(
            title_lines, title_font, title_pad_h, title_pad_v, title_radius,
            plate_rgba=hook_style["plate"], text_rgb=hook_style["text"],
        )

        max_accent_w = round(w * 0.82)
        accent_lines = wrap_text(hook_accent, accent_font, max_accent_w)
        accent_tile_img = text_tile_multiline(accent_lines, accent_font, hook_style["accent"])

        title_top = round(90 * h / 1280)
        title_cy = title_top + title_tile_img.height // 2
        bar_cy = title_top + title_tile_img.height + round(26 * h / 1280)
        accent_cy = bar_cy + round(34 * h / 1280) + accent_tile_img.height // 2

    # Auto captions (synced to speech) take over the bottom text zone from manual
    # keyword tags when present, to avoid stacking two competing text overlays.
    caption_slots: list[tuple[Image.Image, float, float]] = []
    slots = []
    if captions:
        caption_font = ImageFont.truetype(font_path, caption_font_size, index=0)
        max_text_w = round(w * 0.82)
        for text, cstart, cend in captions:
            cstart, cend = max(0.0, cstart), min(duration, cend)
            if cend - cstart < 0.15:
                continue
            lines = wrap_text(text, caption_font, max_text_w)
            tile = plate_tile_multiline(
                lines, caption_font, pad_h, pad_v, radius,
                plate_rgba=style["plate"], text_rgb=style["text"],
            )
            caption_slots.append((tile, cstart, cend))
    else:
        kw_font = ImageFont.truetype(font_path, kw_font_size, index=0)
        kw_tiles = {
            kw: plate_tile(kw, kw_font, pad_h, pad_v, radius, plate_rgba=style["plate"], text_rgb=style["text"])
            for kw in set(keywords)
        }
        slots = plan_keyword_slots(keywords, duration, hook_enabled)

    title_start, title_end = 0.05, 0.45
    bar_start, bar_end = 0.55, 0.85
    accent_start, accent_end = 0.65, 1.0
    hook_fade_start, hook_fade_end = HOOK_DURATION - 0.3, HOOK_DURATION

    marquee_tile = marquee_gap = marquee_y = None
    marquee_speed_px = round(140 * w / 720)
    if marquee_text.strip():
        marquee_font = ImageFont.truetype(font_path, marquee_font_size, index=0)
        marquee_tile = plate_tile(
            "   " + marquee_text.strip() + "   ", marquee_font,
            pad_h=round(10 * w / 720), pad_v=round(8 * w / 720), radius=0,
            plate_rgba=(style["plate"][0], style["plate"][1], style["plate"][2], min(255, style["plate"][3] + 20)),
            text_rgb=style["text"],
        )
        marquee_gap = round(30 * w / 720)
        marquee_y = round(60 * h / 1280) if marquee_position == "top" else round(1190 * h / 1280)

    total_frames = int(round(duration * fps))

    with tempfile.TemporaryDirectory() as frames_dir:
        for i in range(total_frames):
            t = i / float(fps)
            canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))

            if hook_enabled and t < HOOK_DURATION:
                overall_fade = 1.0
                if t >= hook_fade_start:
                    overall_fade = 1.0 - ease_in_out_cubic(clamp01((t - hook_fade_start) / (hook_fade_end - hook_fade_start)))
                if t >= title_start:
                    e = ease_out_cubic(clamp01((t - title_start) / (title_end - title_start)))
                    paste_scaled_faded(canvas, title_tile_img, cx, title_cy, 0.88 + 0.12 * e, e * overall_fade)
                if t >= bar_start:
                    p = ease_out_cubic(clamp01((t - bar_start) / (bar_end - bar_start)))
                    half_w = bar_half_w * p
                    if half_w > 1:
                        d = ImageDraw.Draw(canvas)
                        a = int(255 * overall_fade)
                        d.line([(cx - half_w, bar_cy), (cx + half_w, bar_cy)], fill=hook_style["accent"] + (a,), width=2)
                if t >= accent_start:
                    e = ease_out_cubic(clamp01((t - accent_start) / (accent_end - accent_start)))
                    paste_scaled_faded(canvas, accent_tile_img, cx, accent_cy, 0.92 + 0.08 * e, e * overall_fade)

            for kw, kstart, kdur in slots:
                kt = t - kstart
                if 0 <= kt <= kdur:
                    if kt < KW_REVEAL:
                        e = ease_out_cubic(clamp01(kt / KW_REVEAL))
                        scale, alpha = 0.9 + 0.1 * e, e
                    elif kt > kdur - KW_FADE:
                        e = ease_in_out_cubic(clamp01((kt - (kdur - KW_FADE)) / KW_FADE))
                        scale, alpha = 1.0, 1.0 - e
                    else:
                        scale, alpha = 1.0, 1.0
                    paste_scaled_faded(canvas, kw_tiles[kw], cx, kw_cy, scale, alpha)

            for tile, cstart, cend in caption_slots:
                ct = t - cstart
                cdur = cend - cstart
                if 0 <= ct <= cdur:
                    reveal, fade = min(0.15, cdur / 3), min(0.15, cdur / 3)
                    if ct < reveal:
                        alpha = ease_out_cubic(clamp01(ct / reveal))
                    elif ct > cdur - fade:
                        alpha = 1.0 - ease_in_out_cubic(clamp01((ct - (cdur - fade)) / fade))
                    else:
                        alpha = 1.0
                    paste_scaled_faded(canvas, tile, cx, caption_cy, 1.0, alpha)

            if marquee_tile is not None:
                step = marquee_tile.width + marquee_gap
                offset = int((t * marquee_speed_px) % step)
                x = -offset
                while x < w:
                    canvas.alpha_composite(marquee_tile, (x, marquee_y))
                    x += step

            canvas.save(os.path.join(frames_dir, "f_%05d.png" % i))

        cmd = [
            "ffmpeg", "-y", "-framerate", str(fps),
            "-i", os.path.join(frames_dir, "f_%05d.png"),
            "-c:v", "prores_ks", "-profile:v", "4444",
            "-pix_fmt", "yuva444p10le", "-r", str(fps),
            out_path,
        ]
        subprocess.run(cmd, check=True, capture_output=True)
    log(f"  overlay xong: {os.path.basename(out_path)}")


def has_audio_stream(path: str) -> bool:
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "a:0",
        "-show_entries", "stream=index", "-of", "csv=p=0", path,
    ]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    return bool(out.strip())


def apply_speed(source_path: str, speed: float, out_path: str, log=print) -> None:
    """Speed up (or slow down) both video and audio, pitch-corrected, before overlay/grade."""
    if has_audio_stream(source_path):
        filter_complex = f"[0:v]setpts=PTS/{speed}[v];[0:a]atempo={speed}[a]"
        maps = ["-map", "[v]", "-map", "[a]"]
    else:
        filter_complex = f"[0:v]setpts=PTS/{speed}[v]"
        maps = ["-map", "[v]"]
    cmd = [
        "ffmpeg", "-y", "-i", source_path,
        "-filter_complex", filter_complex,
        *maps,
        "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    log(f"  toc do x{speed}: {os.path.basename(out_path)}")


def normalize_aspect(source_path: str, aspect_key: str, out_path: str, log=print) -> bool:
    """Scale+crop the source to the target aspect ratio (cover-fit, centered), so every
    clip in a render shares one resolution — required for crossfade concat, and for
    keeping brand style positions consistent across mixed-resolution source footage."""
    target = ASPECT_RATIOS.get(aspect_key, ASPECT_RATIOS[DEFAULT_ASPECT_KEY])
    tw, th = target["w"], target["h"]
    w, h, _fps, _dur = ffprobe_info(source_path)
    if w == tw and h == th:
        return False
    vf = f"scale={tw}:{th}:force_original_aspect_ratio=increase,crop={tw}:{th}"
    cmd = [
        "ffmpeg", "-y", "-i", source_path,
        "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    log(f"  chuan hoa ti le {aspect_key} ({tw}x{th}): {os.path.basename(out_path)}")
    return True


def render_clip(source_path: str, overlay_path: str, out_path: str, log=print) -> None:
    filter_complex = f"[0:v]{GRADE}[graded];[graded][1:v]overlay=0:0:format=auto[outv]"
    cmd = [
        "ffmpeg", "-y",
        "-i", source_path,
        "-i", overlay_path,
        "-filter_complex", filter_complex,
        "-map", "[outv]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    log(f"  clip render xong: {os.path.basename(out_path)}")


def pick_music_track(project_dir: str) -> str | None:
    music_dir = os.path.join(project_dir, "nhac")
    if not os.path.isdir(music_dir):
        return None
    tracks = [
        os.path.join(music_dir, f) for f in os.listdir(music_dir)
        if f.lower().endswith((".mp3", ".wav", ".m4a", ".aac"))
    ]
    if not tracks:
        return None
    return random.choice(tracks)


def add_background_music(video_path: str, music_path: str, out_path: str, volume: float = 0.22, log=print) -> None:
    """Mix a looping, faded, ducked-under music bed under the video's own audio."""
    duration = ffprobe_info(video_path)[3]
    fade_out_start = max(0.0, duration - 1.5)
    filter_complex = (
        f"[1:a]aloop=loop=-1:size=2000000000,atrim=0:{duration},"
        f"afade=t=in:st=0:d=1.5,afade=t=out:st={fade_out_start}:d=1.5,"
        f"volume={volume}[music];"
        f"[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[aout]"
    )
    cmd = [
        "ffmpeg", "-y", "-i", video_path, "-i", music_path,
        "-filter_complex", filter_complex,
        "-map", "0:v", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    log(f"  nhac nen: {os.path.basename(music_path)}")


def concat_clips(clip_paths: list[str], out_path: str, log=print) -> None:
    with tempfile.TemporaryDirectory() as tmpdir:
        list_path = os.path.join(tmpdir, "list.txt")
        with open(list_path, "w", encoding="utf-8") as f:
            for p in clip_paths:
                escaped = p.replace("'", "'\\''")
                f.write(f"file '{escaped}'\n")
        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", list_path, "-c", "copy", out_path,
        ]
        subprocess.run(cmd, check=True, capture_output=True)
    log(f"video hoan chinh: {os.path.basename(out_path)}")


def concat_with_crossfade(clip_paths: list[str], out_path: str, xfade_duration: float = 0.4, log=print) -> None:
    """Join clips with a short crossfade instead of a hard cut, for a smoother, more professional flow."""
    if len(clip_paths) == 1:
        shutil.copy(clip_paths[0], out_path)
        log(f"video hoan chinh: {os.path.basename(out_path)}")
        return

    durations = [ffprobe_info(p)[3] for p in clip_paths]
    inputs = []
    for p in clip_paths:
        inputs += ["-i", p]

    filter_parts = []
    v_prev, a_prev = "0:v", "0:a"
    cumulative = durations[0]
    for i in range(1, len(clip_paths)):
        d = max(0.1, min(xfade_duration, durations[i - 1] - 0.1, durations[i] - 0.1))
        offset = max(0.0, cumulative - d)
        v_out, a_out = f"v{i}", f"a{i}"
        filter_parts.append(f"[{v_prev}][{i}:v]xfade=transition=fade:duration={d:.3f}:offset={offset:.3f}[{v_out}]")
        filter_parts.append(f"[{a_prev}][{i}:a]acrossfade=d={d:.3f}[{a_out}]")
        v_prev, a_prev = v_out, a_out
        cumulative = offset + d + (durations[i] - d)

    cmd = [
        "ffmpeg", "-y", *inputs,
        "-filter_complex", ";".join(filter_parts),
        "-map", f"[{v_prev}]", "-map", f"[{a_prev}]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    log(f"video hoan chinh (chuyen canh mem {xfade_duration}s): {os.path.basename(out_path)}")


def run_pipeline(project_dir: str, timeline: list[dict], hook: dict, job_id: str, progress_store: dict,
                  music_enabled: bool = True, aspect_key: str = DEFAULT_ASPECT_KEY) -> None:
    def log(msg: str) -> None:
        progress_store[job_id]["logs"].append(msg)

    work_dir = os.path.join(project_dir, "tools", f"job_{job_id}")
    os.makedirs(work_dir, exist_ok=True)
    rendered_paths = []
    total = len(timeline)
    try:
        for idx, item in enumerate(timeline):
            src = os.path.join(project_dir, item["file"])
            log(f"[{idx + 1}/{total}] dang xu ly: {item['file']}")

            aspect_path = os.path.join(work_dir, f"aspect_{idx:02d}.mp4")
            if normalize_aspect(src, aspect_key, aspect_path, log=log):
                src = aspect_path

            speed = float(item.get("speed") or 1.0)
            if abs(speed - 1.0) > 0.001:
                sped_path = os.path.join(work_dir, f"speed_{idx:02d}.mp4")
                apply_speed(src, speed, sped_path, log=log)
                src = sped_path

            trimmed_path = os.path.join(work_dir, f"trimmed_{idx:02d}.mp4")
            if trim_freezes(src, trimmed_path, log=log):
                src = trimmed_path

            auto_caption = bool(item.get("auto_caption", False))
            captions = transcribe_segments(src, log=log) if auto_caption else None

            w, h, fps, duration = ffprobe_info(src)
            is_first = idx == 0
            overlay_path = os.path.join(work_dir, f"overlay_{idx:02d}.mov")
            build_overlay(
                w, h, fps, duration,
                keywords=[k for k in item.get("keywords", []) if k.strip()],
                hook_enabled=is_first and hook.get("enabled", False),
                hook_title=hook.get("title", ""),
                hook_accent=hook.get("accent", ""),
                out_path=overlay_path, log=log,
                font_key=item.get("font_key", DEFAULT_FONT_KEY),
                style_key=item.get("style_key", DEFAULT_STYLE_KEY),
                hook_style_key=hook.get("style_key"),
                marquee_text=item.get("marquee_text", ""),
                marquee_position=item.get("marquee_position", "bottom"),
                captions=captions,
            )
            rendered_path = os.path.join(work_dir, f"clip_{idx:02d}.mp4")
            render_clip(src, overlay_path, rendered_path, log=log)
            rendered_paths.append(rendered_path)
            progress_store[job_id]["percent"] = int(round((idx + 1) / total * 90))

        final_name = f"VIDEO_HOAN_CHINH_{job_id}.mp4"
        final_path = os.path.join(project_dir, final_name)
        concat_with_crossfade(rendered_paths, final_path, log=log)

        if music_enabled:
            track = pick_music_track(project_dir)
            if track:
                with_music_path = os.path.join(work_dir, "with_music.mp4")
                add_background_music(final_path, track, with_music_path, log=log)
                shutil.move(with_music_path, final_path)
            else:
                log("  (chua co nhac trong thu muc 'nhac/' - bo qua nhac nen)")

        progress_store[job_id]["percent"] = 100
        progress_store[job_id]["done"] = True
        progress_store[job_id]["output"] = final_name
        log("Hoan tat!")
    except subprocess.CalledProcessError as e:
        err = e.stderr.decode("utf-8", errors="ignore") if e.stderr else str(e)
        log(f"LOI: {err[-2000:]}")
        progress_store[job_id]["error"] = True
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Auto-highlight: pick the best moments out of long raw footage and cut them
# into one short video. Candidate segments come from Whisper's own utterance
# boundaries (never slices mid-sentence); each is scored by how much of it is
# NOT frozen/dead footage, with a mild preference for ~4s chunks. This is a
# technical-signal heuristic, not real aesthetic judgement — there's no vision
# model here to know what looks "beautiful".
# ---------------------------------------------------------------------------

HIGHLIGHT_MIN_SEG = 1.0
HIGHLIGHT_MAX_SEG = 7.0
HIGHLIGHT_PREFERRED_LEN = 4.0


def score_dynamism(freeze_ranges: list[tuple[float, float]], seg_start: float, seg_end: float) -> float:
    seg_dur = seg_end - seg_start
    if seg_dur <= 0:
        return 0.0
    frozen = sum(max(0.0, min(seg_end, e) - max(seg_start, s)) for s, e in freeze_ranges)
    return max(0.0, 1.0 - frozen / seg_dur)


def build_highlight_candidates(path: str, log=print) -> list[dict]:
    """Score candidate moments in one long source clip."""
    duration = ffprobe_info(path)[3]
    freeze_ranges = detect_freeze_ranges(path, min_duration=0.5)
    speech_segs = transcribe_segments(path, log=log)

    candidates = []
    if speech_segs:
        merged: list[list] = []
        for text, s, e in speech_segs:
            if merged and s - merged[-1][2] < 0.4 and (e - merged[-1][1]) <= HIGHLIGHT_MAX_SEG:
                merged[-1][0] += " " + text
                merged[-1][2] = e
            else:
                merged.append([text, s, e])
        for text, s, e in merged:
            dur = e - s
            if dur < HIGHLIGHT_MIN_SEG:
                continue
            if dur > HIGHLIGHT_MAX_SEG:
                e = s + HIGHLIGHT_MAX_SEG
                dur = HIGHLIGHT_MAX_SEG
            dyn = score_dynamism(freeze_ranges, s, e)
            length_bonus = 1.0 - min(1.0, abs(dur - HIGHLIGHT_PREFERRED_LEN) / 8.0)
            score = 0.7 * dyn + 0.3 * length_bonus
            candidates.append({"start": s, "end": e, "text": text.strip(), "score": score})
    else:
        log("  (khong nghe duoc loi thoai trong doan nay - chon theo chuyen dong hinh anh)")
        step = HIGHLIGHT_PREFERRED_LEN
        t = 0.0
        while t < duration:
            e = min(duration, t + step)
            if e - t >= HIGHLIGHT_MIN_SEG:
                dyn = score_dynamism(freeze_ranges, t, e)
                candidates.append({"start": t, "end": e, "text": "", "score": dyn})
            t += step
    return candidates


def select_highlight_segments(all_candidates: list[dict], target_duration: float) -> tuple[list[dict], float]:
    ranked = sorted(all_candidates, key=lambda c: -c["score"])
    selected = []
    total = 0.0
    for c in ranked:
        dur = c["end"] - c["start"]
        if total + dur > target_duration * 1.08:
            continue
        selected.append(c)
        total += dur
        if total >= target_duration * 0.95:
            break
    selected.sort(key=lambda c: (c["clip_idx"], c["start"]))
    return selected, total


def extract_segment(source_path: str, start: float, end: float, out_path: str, log=print) -> None:
    duration = max(0.1, end - start)
    cmd = [
        "ffmpeg", "-y", "-ss", f"{start:.3f}", "-i", source_path, "-t", f"{duration:.3f}",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    log(f"  cat doan {start:.1f}-{end:.1f}s")


def render_segment_list(project_dir: str, source_dir: str, segments: list[dict],
                         job_id: str, progress_store: dict, output_prefix: str = "HIGHLIGHT",
                         style_key: str = DEFAULT_STYLE_KEY, font_key: str = DEFAULT_FONT_KEY,
                         auto_caption: bool = True, hook: dict | None = None,
                         music_enabled: bool = True, aspect_key: str = DEFAULT_ASPECT_KEY,
                         progress_range: tuple[int, int] = (35, 90)) -> None:
    """Render an explicit, already-decided list of {file, start, end, text} segments, in the
    given order, through the full brand pipeline (grade, captions, hook, crossfade, music).
    Used both by the automatic highlight selector and by a human/Claude-curated edit plan."""
    def log(msg: str) -> None:
        progress_store[job_id]["logs"].append(msg)

    hook = hook or {"enabled": False, "title": "", "accent": ""}
    work_dir = os.path.join(project_dir, "tools", f"hl_{job_id}")
    os.makedirs(work_dir, exist_ok=True)
    p_start, p_end = progress_range
    try:
        rendered_paths = []
        for i, seg in enumerate(segments):
            src = os.path.join(source_dir, seg["file"])
            seg_path = os.path.join(work_dir, f"seg_{i:02d}.mp4")
            extract_segment(src, seg["start"], seg["end"], seg_path, log=log)

            aspect_path = os.path.join(work_dir, f"hl_aspect_{i:02d}.mp4")
            if normalize_aspect(seg_path, aspect_key, aspect_path, log=log):
                seg_path = aspect_path

            w, h, fps, seg_duration = ffprobe_info(seg_path)
            seg_text = seg.get("text", "")
            captions = [(seg_text, 0.0, seg_duration)] if (auto_caption and seg_text) else None
            overlay_path = os.path.join(work_dir, f"hl_overlay_{i:02d}.mov")
            build_overlay(
                w, h, fps, seg_duration, keywords=[],
                hook_enabled=(i == 0 and hook.get("enabled", False)),
                hook_title=hook.get("title", ""), hook_accent=hook.get("accent", ""),
                out_path=overlay_path, log=log,
                font_key=font_key, style_key=style_key,
                hook_style_key=hook.get("style_key"),
                captions=captions,
            )
            rendered_path = os.path.join(work_dir, f"hl_clip_{i:02d}.mp4")
            render_clip(seg_path, overlay_path, rendered_path, log=log)
            rendered_paths.append(rendered_path)
            progress_store[job_id]["percent"] = p_start + int(round((i + 1) / len(segments) * (p_end - p_start)))

        final_name = f"{output_prefix}_{job_id}.mp4"
        final_path = os.path.join(project_dir, final_name)
        concat_with_crossfade(rendered_paths, final_path, log=log)

        if music_enabled:
            track = pick_music_track(project_dir)
            if track:
                with_music_path = os.path.join(work_dir, "with_music.mp4")
                add_background_music(final_path, track, with_music_path, log=log)
                shutil.move(with_music_path, final_path)
            else:
                log("  (chua co nhac trong thu muc 'nhac/' - bo qua nhac nen)")

        progress_store[job_id]["percent"] = 100
        progress_store[job_id]["done"] = True
        progress_store[job_id]["output"] = final_name
        log("Hoan tat!")
    except subprocess.CalledProcessError as e:
        err = e.stderr.decode("utf-8", errors="ignore") if e.stderr else str(e)
        log(f"LOI: {err[-2000:]}")
        progress_store[job_id]["error"] = True
    except Exception as e:
        log(f"LOI: {e}")
        progress_store[job_id]["error"] = True
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def run_highlight_pipeline(project_dir: str, source_dir: str, uploaded_files: list[str],
                            target_duration: float, job_id: str, progress_store: dict,
                            style_key: str = DEFAULT_STYLE_KEY, font_key: str = DEFAULT_FONT_KEY,
                            auto_caption: bool = True, hook: dict | None = None,
                            music_enabled: bool = True, aspect_key: str = DEFAULT_ASPECT_KEY) -> None:
    def log(msg: str) -> None:
        progress_store[job_id]["logs"].append(msg)

    work_dir_check = os.path.join(project_dir, "tools", f"hl_{job_id}")
    os.makedirs(work_dir_check, exist_ok=True)
    try:
        all_candidates: list[dict] = []
        for idx, fname in enumerate(uploaded_files):
            src = os.path.join(source_dir, fname)
            log(f"[{idx + 1}/{len(uploaded_files)}] dang phan tich: {fname}")
            cands = build_highlight_candidates(src, log=log)
            for c in cands:
                c["clip_idx"] = idx
                c["file"] = fname
            all_candidates.extend(cands)
            log(f"  tim thay {len(cands)} doan ung vien")
            progress_store[job_id]["percent"] = int(round((idx + 1) / len(uploaded_files) * 35))

        if not all_candidates:
            raise RuntimeError("Khong tim thay doan nao phu hop (video co the qua tinh hoac khong co tieng)")

        selected, total = select_highlight_segments(all_candidates, target_duration)
        log(f"Da chon {len(selected)} doan hay nhat, tong {total:.1f}s")
    except Exception as e:
        log(f"LOI: {e}")
        progress_store[job_id]["error"] = True
        shutil.rmtree(work_dir_check, ignore_errors=True)
        return

    render_segment_list(
        project_dir, source_dir, selected, job_id, progress_store,
        output_prefix="HIGHLIGHT", style_key=style_key, font_key=font_key,
        auto_caption=auto_caption, hook=hook, music_enabled=music_enabled,
        aspect_key=aspect_key, progress_range=(35, 90),
    )
