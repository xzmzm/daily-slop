#!/usr/bin/env python3
"""Build the daily-slop gallery.

Scans YYYY-MM-DD-* project folders, parses each README.md / NOTES.md,
captures a screenshot of each project with headless Chrome, and writes
gallery/manifest.js consumed by the root index.html + view.html.

Zero dependencies beyond the Python stdlib. Chrome is optional — if it
is missing (or a capture fails) an SVG placeholder is generated instead.

Usage:  python3 tools/build_gallery.py [--no-shots] [--strict-shots]
"""

import functools
import base64
import http.server
import json
import os
import re
import secrets
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
GALLERY = ROOT / "gallery"
SHOTS = GALLERY / "shots"

PROJECT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$")

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    shutil.which("chrome") or "",
    shutil.which("google-chrome-stable") or "",
    shutil.which("google-chrome") or "",
    shutil.which("chromium") or "",
    shutil.which("chromium-browser") or "",
]

SHOT_W, SHOT_H = 1280, 800     # capture size
THUMB_W = 800                  # downscaled width kept in the repo
SETTLE_MS = 6000               # let animations run this long before the shot
WAIT_S = 30                    # max real time to wait for the png to appear


def recoverable_discard(path):
    """Move an obsolete artifact somewhere recoverable instead of deleting it."""
    path = Path(path)
    if not path.exists() and not path.is_symlink():
        return

    trash_command = shutil.which("trash")
    if trash_command:
        subprocess.run([trash_command, str(path)], check=True)
        return

    # CI images do not provide the macOS `trash` command. Keep the artifact on
    # the same filesystem in a hidden quarantine directory for the job's life.
    quarantine = path.parent / ".daily-slop-trash"
    quarantine.mkdir(exist_ok=True)
    destination = quarantine / f"{path.name}.{secrets.token_hex(8)}"
    path.rename(destination)


def find_chrome():
    for c in CHROME_CANDIDATES:
        if c and Path(c).exists():
            return c
    return None


def clean_built_by(raw):
    """Keep only the model name from a 'Built by' value.

    The line must be "Built by <model>" — no occasion, date or commentary
    (those belong in the tagline). If extra text sneaks in behind a
    separator ("Built by GLM-5.3 · World Honey Bee Day (…)"), cut at the
    first separator and warn so the README gets fixed too.
    """
    value = raw.strip()
    for sep in ("·", " — ", " – ", " ("):
        cut = value.find(sep)
        if cut != -1:
            print(f"  ! trimmed 'Built by' value {raw!r} -> {value[:cut].strip()!r}"
                  " (model name only; move the rest into the tagline)")
            value = value[:cut].strip()
    return value.rstrip(".:*_ \t").strip()


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
            built_by = clean_built_by(m.group(1))
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


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_for_devtools(port, proc, timeout):
    """Wait for Chrome's local DevTools HTTP endpoint and return a page socket URL."""
    endpoint = f"http://127.0.0.1:{port}/json/list"
    deadline = time.time() + timeout
    last_error = None
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"Chrome exited before DevTools started (exit {proc.returncode})")
        try:
            with urlopen(endpoint, timeout=1) as response:
                targets = json.load(response)
            for target in targets:
                if target.get("type") == "page" and target.get("webSocketDebuggerUrl"):
                    return target["webSocketDebuggerUrl"]
        except (OSError, ValueError) as exc:
            last_error = exc
        time.sleep(0.1)
    raise TimeoutError(f"DevTools did not start on port {port}: {last_error or 'timeout'}")


class DevToolsConnection:
    """Small stdlib-only WebSocket client for the Chrome DevTools Protocol."""

    def __init__(self, websocket_url):
        from urllib.parse import urlparse

        parsed = urlparse(websocket_url)
        self.sock = socket.create_connection(
            (parsed.hostname, parsed.port or 80), timeout=WAIT_S
        )
        key = base64.b64encode(secrets.token_bytes(16)).decode("ascii")
        host = parsed.hostname if not parsed.port else f"{parsed.hostname}:{parsed.port}"
        request = (
            f"GET {parsed.path} HTTP/1.1\r\n"
            f"Host: {host}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "Origin: http://127.0.0.1\r\n\r\n"
        )
        self.sock.sendall(request.encode("ascii"))
        response = bytearray()
        while b"\r\n\r\n" not in response:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("Chrome closed the DevTools handshake")
            response.extend(chunk)
        if not response.startswith(b"HTTP/1.1 101"):
            raise ConnectionError(response.decode("utf-8", errors="replace"))
        self.next_id = 0

    def _read_exact(self, size):
        data = bytearray()
        while len(data) < size:
            chunk = self.sock.recv(size - len(data))
            if not chunk:
                raise ConnectionError("Chrome closed the DevTools socket")
            data.extend(chunk)
        return bytes(data)

    def _send_frame(self, payload, opcode=1):
        payload = payload if isinstance(payload, bytes) else payload.encode("utf-8")
        length = len(payload)
        if length < 126:
            header = bytes([0x80 | opcode, 0x80 | length])
        elif length < 65536:
            header = bytes([0x80 | opcode, 0x80 | 126]) + struct.pack("!H", length)
        else:
            header = bytes([0x80 | opcode, 0x80 | 127]) + struct.pack("!Q", length)
        mask = secrets.token_bytes(4)
        masked = bytes(value ^ mask[i % 4] for i, value in enumerate(payload))
        self.sock.sendall(header + mask + masked)

    def _receive_frame(self, timeout):
        self.sock.settimeout(timeout)
        first, second = self._read_exact(2)
        opcode = first & 0x0F
        masked = bool(second & 0x80)
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", self._read_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._read_exact(8))[0]
        mask = self._read_exact(4) if masked else None
        payload = bytearray(self._read_exact(length))
        if mask:
            for i in range(length):
                payload[i] ^= mask[i % 4]
        return opcode, bytes(payload)

    def command(self, method, params=None, timeout=WAIT_S):
        self.next_id += 1
        command_id = self.next_id
        message = {"id": command_id, "method": method}
        if params:
            message["params"] = params
        self._send_frame(json.dumps(message, separators=(",", ":")))
        deadline = time.time() + timeout
        while time.time() < deadline:
            opcode, payload = self._receive_frame(max(.1, deadline - time.time()))
            if opcode == 0x9:
                self._send_frame(payload, opcode=0xA)
                continue
            if opcode == 0x8:
                raise ConnectionError("Chrome closed the DevTools connection")
            if opcode != 0x1:
                continue
            response = json.loads(payload.decode("utf-8"))
            if response.get("id") != command_id:
                continue
            if "error" in response:
                raise RuntimeError(response["error"])
            return response.get("result", {})
        raise TimeoutError(f"Timed out waiting for DevTools command {method}")

    def close(self):
        try:
            self.sock.close()
        except OSError:
            pass


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


def capture(chrome, port, project, tmp_dir, strict=False):
    """Screenshot one project; return shot filename relative to gallery/."""
    png = SHOTS / f"{project['dir']}.png"
    svg = SHOTS / f"{project['dir']}.svg"
    if chrome:
        url = f"http://127.0.0.1:{port}/{project['dir']}/index.html"
        capture_dir = tmp_dir / "captures" / project["dir"]
        capture_dir.mkdir(parents=True, exist_ok=True)
        tmp_png = capture_dir / "screenshot.png"
        log_path = capture_dir / "chrome.log"
        ci_flags = ["--no-sandbox", "--disable-dev-shm-usage"] if os.environ.get("CI") else []
        debug_port = find_free_port()
        cmd = [
            chrome, "--headless", "--disable-gpu", "--hide-scrollbars",
            "--mute-audio", "--disable-extensions", "--no-first-run",
            *ci_flags,
            f"--user-data-dir={capture_dir / 'chrome-profile'}",
            "--remote-allow-origins=*",
            "--remote-debugging-address=127.0.0.1",
            f"--remote-debugging-port={debug_port}",
            url,
        ]
        return_code = None
        proc = None
        devtools = None
        log = None
        try:
            log = log_path.open("w", encoding="utf-8")
            proc = subprocess.Popen(
                cmd,
                cwd=str(capture_dir),
                stdout=log,
                stderr=subprocess.STDOUT,
            )
            websocket_url = wait_for_devtools(debug_port, proc, WAIT_S)
            devtools = DevToolsConnection(websocket_url)
            devtools.command("Page.enable")
            devtools.command(
                "Emulation.setDeviceMetricsOverride",
                {
                    "width": SHOT_W,
                    "height": SHOT_H,
                    "deviceScaleFactor": 1,
                    "mobile": False,
                },
            )
            devtools.command("Page.navigate", {"url": url})
            # Let animations settle before asking the page for its bitmap.
            time.sleep(SETTLE_MS / 1000)
            result = devtools.command(
                "Page.captureScreenshot",
                {"format": "png", "fromSurface": True},
            )
            tmp_png.write_bytes(base64.b64decode(result["data"]))
        except Exception as e:
            print(f"  ! capture failed for {project['dir']}: {e}")
        finally:
            if devtools:
                devtools.close()
            if proc:
                if proc.poll() is None:
                    proc.terminate()
                try:
                    return_code = proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    return_code = proc.wait(timeout=5)
            if log:
                log.close()

        if tmp_png.exists() and tmp_png.stat().st_size > 0:
            recoverable_discard(png)
            shutil.copy2(tmp_png, png)
            # downscale in place to keep the repo light (macOS sips)
            if shutil.which("sips"):
                subprocess.run(
                    ["sips", "--resampleWidth", str(THUMB_W), str(png)],
                    capture_output=True,
                )
            recoverable_discard(svg)
            return f"shots/{png.name}"

        details = ""
        if log_path.exists():
            lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
            if lines:
                details = "\n".join("    " + line for line in lines[-8:])
        print(
            f"  ! capture produced no png for {project['dir']} "
            f"(Chrome exit {return_code})"
        )
        if details:
            print(f"  ! Chrome output:\n{details}")
        if strict:
            return None

    if strict:
        return None
    if not png.exists():
        if not svg.exists():
            svg.write_text(placeholder_svg(project), encoding="utf-8")
        return f"shots/{svg.name}"
    return f"shots/{png.name}"  # keep a stale png over a placeholder


def main():
    take_shots = "--no-shots" not in sys.argv
    strict_shots = "--strict-shots" in sys.argv
    SHOTS.mkdir(parents=True, exist_ok=True)

    print("scanning projects…")
    projects = collect_projects()
    print(f"  found {len(projects)}")

    chrome = find_chrome() if take_shots else None
    if take_shots:
        print(f"screenshots via: {chrome or 'placeholder SVGs (no Chrome found)'}")
        httpd, port = start_server()
        tmp_dir = Path(tempfile.mkdtemp(prefix="daily-slop-gallery-"))
        try:
            failed = []
            for p in projects:
                t0 = time.time()
                p["shot"] = capture(chrome, port, p, tmp_dir, strict=strict_shots)
                if p["shot"] is None:
                    failed.append(p["dir"])
                print(f"  {p['dir']} -> {p['shot']} ({time.time() - t0:.1f}s)")
        finally:
            httpd.shutdown()
            recoverable_discard(tmp_dir)
        if failed:
            raise SystemExit(
                "screenshot generation failed for: " + ", ".join(failed)
            )
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
        if f.name.startswith("."):
            continue
        if f.name not in live:
            recoverable_discard(f)
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
