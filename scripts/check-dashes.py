"""Fail if any text file contains an em dash (U+2014) or en dash (U+2013)."""
import pathlib
import sys

BANNED = (chr(0x2014), chr(0x2013))
SKIP_DIRS = {".git", "node_modules", "dist", "out", "cache", "lib"}
EXTS = {".md", ".ts", ".tsx", ".js", ".json", ".sol", ".css", ".html", ".txt", ".yml", ".yaml", ".toml"}

found = 0
for path in pathlib.Path(".").rglob("*"):
    if not path.is_file() or path.suffix not in EXTS or SKIP_DIRS & set(path.parts):
        continue
    for n, line in enumerate(path.read_text(errors="ignore").splitlines(), 1):
        if any(c in line for c in BANNED):
            print(f"{path}:{n}: {line.strip()[:100]}")
            found += 1

sys.exit(1 if found else 0)
