"""Build the static upload bundle for the daily-slop gallery.

The bundle intentionally contains only files needed at runtime: the gallery
shell, generated gallery assets, and each project's web assets. Documentation,
tooling, Git metadata, and hidden hosting metadata stay in the source tree.
"""

from pathlib import Path
import re
import shutil


ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
PROJECT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$")
PROJECT_ASSET_SUFFIXES = {
    ".html",
    ".css",
    ".js",
    ".json",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".ico",
    ".svg",
    ".avif",
    ".woff",
    ".woff2",
    ".mp3",
    ".wav",
    ".ogg",
    ".webm",
    ".wasm",
}


def copy_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def copy_project(project: Path) -> None:
    destination_root = DIST / project.name
    for source in project.rglob("*"):
        if not source.is_file():
            continue
        relative = source.relative_to(project)
        if any(part.startswith(".") for part in relative.parts):
            continue
        if source.name in {"README.md", "NOTES.md"}:
            continue
        if source.suffix.lower() not in PROJECT_ASSET_SUFFIXES:
            continue
        copy_file(source, destination_root / relative)


def main() -> None:
    DIST.mkdir(parents=True, exist_ok=True)

    for filename in ("index.html", "view.html"):
        copy_file(ROOT / filename, DIST / filename)

    for filename in (
        "gallery.css",
        "gallery.js",
        "manifest.js",
        "md.js",
        "viewer.js",
    ):
        copy_file(ROOT / "gallery" / filename, DIST / "gallery" / filename)

    for source in (ROOT / "gallery" / "shots").iterdir():
        if source.is_file():
            copy_file(source, DIST / "gallery" / "shots" / source.name)

    projects = sorted(
        path
        for path in ROOT.iterdir()
        if path.is_dir() and PROJECT_RE.fullmatch(path.name)
    )
    for project in projects:
        copy_project(project)

    files = sorted(path for path in DIST.rglob("*") if path.is_file())
    print(f"built {len(files)} files in {DIST}")


if __name__ == "__main__":
    main()
