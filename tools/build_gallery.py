#!/usr/bin/env python3
"""Build the daily-slop gallery.

Scans YYYY-MM-DD-* project folders, parses each README.md / NOTES.md,
captures a screenshot of each project with headless Chrome, and writes
gallery/manifest.js consumed by the root index.html + view.html.

Zero dependencies beyond the Python stdlib. Chrome is optional — if it
is missing (or a capture fails) an SVG placeholder is generated instead.

Usage:  python3 tools/build_gallery.py [--no-shots]
"""

import functools
import http.server
import json
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GALLERY = ROOT / "gallery"
SHOTS = GALLERY / "shots"

PROJECT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$")

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    shutil.which("google-chrome") or "",
    shutil.which("chromium") or "",
]

SHOT_W, SHOT_H = 1280, 800     # capture size
THUMB_W = 800                  # downscaled width kept in the repo
SETTLE_MS = 6000               # let animations run this long before the shot
WAIT_S = 30                    # max real time to wait for the png to appear


def find_chrome():
    for c in CHROME_CANDIDATES:
        if c and Path(c).exists():
            return c
    return None


def parse_readme(text):
    """Extract title, tagline and 'Built by' from a project README."""
    title, tagline, built_by = None, None, None
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if title is None and line.startswith("# "):
            title = line[2:].strip()
            i += 1
            continue
        # matches "Built by X." and wrapped forms like "> *Built by X.*"
        m = re.match(r"^(?:>\s*)?[*_]*Built by (.+?)\.?[*_]*$", line)
        if m:
            built_by = m.group(1).strip()
            i += 1
            continue
        if title is not None and tagline is None and line and not line.startswith("#"):
            # first paragraph after the title = tagline
            para = []
            while i < len(lines) and lines[i].strip():
                para.append(lines[i].strip())
                i += 1
            tagline = " ".join(para)
            continue
        if line.startswith("## "):
            break
        i += 1
    return title, tagline, built_by


def detect_stack(pdir):
    if (pdir / "main.py").exists():
        return "FastAPI + vanilla"
    if (pdir / "package.json").exists():
        return "Framework (pnpm)"
    return "Vanilla HTML/CSS/JS"


def collect_projects():
    projects = []
    for pdir in sorted(ROOT.iterdir()):
        if not pdir.is_dir() or not PROJECT_RE.match(pdir.name):
            continue
        if not (pdir / "index.html").exists():
            print(f"  skip {pdir.name} (no index.html)")
            continue
        readme = (pdir / "README.md").read_text(encoding="utf-8") if (pdir / "README.md").exists() else ""
        notes = (pdir / "NOTES.md").read_text(encoding="utf-8") if (pdir / "NOTES.md").exists() else ""
        title, tagline, built_by = parse_readme(readme)
        projects.append({
            "dir": pdir.name,
            "date": pdir.name[:10],
            "slug": pdir.name[11:],
            "title": title or pdir.name[11:],
            "tagline": tagline or "",
            "builtBy": built_by or "",
            "stack": detect_stack(pdir),
            "notes": notes,
            "readme": readme,
        })
    projects.sort(key=lambda p: p["date"], reverse=True)
    return projects


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def start_server():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


def placeholder_svg(project):
    hue = sum(project["dir"].encode()) % 360
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{SHOT_W}" height="{SHOT_H}" viewBox="0 0 {SHOT_W} {SHOT_H}">
  <rect width="100%" height="100%" fill="hsl({hue},35%,14%)"/>
  <text x="50%" y="46%" text-anchor="middle" font-family="ui-monospace,monospace"
        font-size="56" fill="hsl({hue},60%,70%)">{project['slug']}</text>
  <text x="50%" y="56%" text-anchor="middle" font-family="ui-monospace,monospace"
        font-size="28" fill="hsl({hue},30%,50%)">{project['date']}</text>
</svg>
"""


def capture(chrome, port, project, tmp_dir):
    """Screenshot one project; return shot filename relative to gallery/."""
    png = SHOTS / f"{project['dir']}.png"
    svg = SHOTS / f"{project['dir']}.svg"
    if chrome:
        url = f"http://127.0.0.1:{port}/{project['dir']}/index.html"
        tmp_png = tmp_dir / f"{project['dir']}.png"
        cmd = [
            chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--mute-audio", "--disable-extensions", "--no-first-run",
            f"--user-data-dir={tmp_dir / 'chrome-profile' / project['dir']}",
            f"--window-size={SHOT_W},{SHOT_H}",
            # capture SETTLE_MS after load so animations have drawn something
            f"--timeout={SETTLE_MS}",
            f"--screenshot={tmp_png}", url,
        ]
        try:
            # Chrome writes the png but often never exits on pages with an
            # endless rAF loop — so poll for the file, then kill the process.
            proc = subprocess.Popen(
                cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            deadline = time.time() + WAIT_S
            size = -1
            while time.time() < deadline:
                if tmp_png.exists():
                    s = tmp_png.stat().st_size
                    if s > 0 and s == size:
                        break  # file present and stable
                    size = s
                if proc.poll() is not None and tmp_png.exists():
                    break
                time.sleep(0.5)
            proc.kill()
            proc.wait(timeout=10)
            if tmp_png.exists() and tmp_png.stat().st_size > 0:
                shutil.move(str(tmp_png), png)
                # downscale in place to keep the repo light (macOS sips)
                if shutil.which("sips"):
                    subprocess.run(
                        ["sips", "--resampleWidth", str(THUMB_W), str(png)],
                        capture_output=True,
                    )
                svg.unlink(missing_ok=True)
                return f"shots/{png.name}"
            print(f"  ! capture produced no png for {project['dir']}")
        except (subprocess.SubprocessError, OSError) as e:
            print(f"  ! capture failed for {project['dir']}: {e}")
    if not png.exists():
        svg.write_text(placeholder_svg(project), encoding="utf-8")
        return f"shots/{svg.name}"
    return f"shots/{png.name}"  # keep a stale png over a placeholder


def main():
    take_shots = "--no-shots" not in sys.argv
    SHOTS.mkdir(parents=True, exist_ok=True)

    print("scanning projects…")
    projects = collect_projects()
    print(f"  found {len(projects)}")

    chrome = find_chrome() if take_shots else None
    if take_shots:
        print(f"screenshots via: {chrome or 'placeholder SVGs (no Chrome found)'}")
        httpd, port = start_server()
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            tmp_dir = Path(td)
            for p in projects:
                t0 = time.time()
                p["shot"] = capture(chrome, port, p, tmp_dir)
                print(f"  {p['dir']} -> {p['shot']} ({time.time() - t0:.1f}s)")
        httpd.shutdown()
    else:
        for p in projects:
            png = SHOTS / f"{p['dir']}.png"
            svg = SHOTS / f"{p['dir']}.svg"
            p["shot"] = f"shots/{png.name}" if png.exists() else f"shots/{svg.name}"
            if not png.exists() and not svg.exists():
                svg.write_text(placeholder_svg(p), encoding="utf-8")

    # prune shots of removed projects
    live = {p["shot"].split("/", 1)[1] for p in projects}
    for f in SHOTS.iterdir():
        if f.name not in live:
            f.unlink()
            print(f"  pruned stale shot {f.name}")

    manifest = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "projects": projects,
    }
    out = GALLERY / "manifest.js"
    out.write_text(
        "// generated by tools/build_gallery.py — do not edit by hand\n"
        "window.GALLERY = " + json.dumps(manifest, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {out.relative_to(ROOT)} ({len(projects)} projects)")


if __name__ == "__main__":
    main()
