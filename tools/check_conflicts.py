"""Finds leftover git merge-conflict markers. Run from the unsilo folder:  python tools/check_conflicts.py"""
import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[1]
skip = {"node_modules", ".venv", "dist", ".git", "__pycache__", "data"}
bad = 0
for p in root.rglob("*"):
    if p.is_file() and not (skip & set(p.parts)) and p.suffix in {".py", ".ts", ".tsx", ".js", ".css", ".html", ".json", ".md", ".env", ".txt"}:
        for n, line in enumerate(p.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if re.match(r"^(<{7}|={7}|>{7})( |$)", line):
                print(f"{p.relative_to(root)}:{n}: {line[:60]}")
                bad += 1
print("No conflict markers found. ✅" if not bad else f"\n{bad} conflict marker line(s) found. Replace those files with the clean copies.")
