#!/usr/bin/env python3
"""
cooked-check deterministic scorer — scoreVersion v1.0

Fixed checks, fixed weights. The agent chooses WHICH files land in work/files/;
this script alone decides the score. No LLM involvement past this point.

Usage: python3 score.py --workdir work > score.json
Expects in <workdir>: repo.json, tree.json, languages.json, files/<sampled paths>
"""
import argparse
import json
import re
import sys
from pathlib import Path

SCORE_VERSION = "v1.0"

WEIGHTS = {
    "no_tests": 20,
    "unused_deps": 15,
    "debug_artifacts": 12,
    "no_error_handling": 12,
}

SOURCE_EXTS = {
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs",
    ".java", ".kt", ".swift", ".c", ".cc", ".cpp", ".h", ".hpp", ".cs", ".php",
    ".vue", ".svelte",
}
TEST_PATH_RE = re.compile(
    r"(^|/)(tests?|__tests__|spec|specs)(/|$)|\.(test|spec)\.[\w]+$|_test\.[\w]+$|test_[\w]+\.py$",
    re.I,
)
GENERATED_RE = re.compile(
    r"(^|/)(node_modules|dist|build|out|vendor|\.next|target|__pycache__|coverage)(/|$)"
)


def tier_for(score: int) -> str:
    if score <= 20:
        return "Raw"
    if score <= 40:
        return "Rare"
    if score <= 60:
        return "Medium"
    if score <= 80:
        return "Well-Done"
    return "Burnt"


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return None


def read_sampled(workdir: Path):
    """{repo-relative path: text} for every file the agent downloaded."""
    files = {}
    root = workdir / "files"
    if not root.is_dir():
        return files
    for p in root.rglob("*"):
        if p.is_file():
            rel = p.relative_to(root).as_posix()
            files[rel] = p.read_text(encoding="utf-8", errors="replace")
    return files


def source_paths_in_tree(tree) -> list:
    out = []
    for entry in (tree or {}).get("tree", []):
        if entry.get("type") != "blob":
            continue
        path = entry.get("path", "")
        if GENERATED_RE.search(path):
            continue
        if Path(path).suffix.lower() in SOURCE_EXTS:
            out.append(path)
    return out


# ---------- check 1: no tests ----------
def check_no_tests(tree, sampled):
    for entry in (tree or {}).get("tree", []):
        if TEST_PATH_RE.search(entry.get("path", "")):
            return False, f"test files exist ({entry['path']})"
    pkg = sampled.get("package.json")
    if pkg:
        try:
            scripts = json.loads(pkg).get("scripts", {})
            test_cmd = scripts.get("test", "")
            if test_cmd and "no test specified" not in test_cmd:
                return False, f'package.json has a test script ("{test_cmd[:60]}")'
        except Exception:
            pass
    return True, "no test directory, no *.test.* files, no test script anywhere"


# ---------- check 2: unused/hallucinated deps ----------
def declared_deps(sampled):
    deps = set()
    pkg = sampled.get("package.json")
    if pkg:
        try:
            d = json.loads(pkg)
            deps |= set(d.get("dependencies", {}).keys())
        except Exception:
            pass
    for name in ("requirements.txt",):
        txt = sampled.get(name)
        if txt:
            for line in txt.splitlines():
                line = line.strip()
                if line and not line.startswith(("#", "-")):
                    deps.add(re.split(r"[<>=!~\[;]", line)[0].strip().lower())
    return deps


def check_unused_deps(sampled):
    deps = declared_deps(sampled)
    if not deps:
        return False, 0.0, "no manifest dependencies to check"
    source_blob = "\n".join(
        text for path, text in sampled.items()
        if Path(path).suffix.lower() in SOURCE_EXTS
    )
    if not source_blob:
        return False, 0.0, "no source files sampled"
    unused = []
    for dep in sorted(deps):
        # match import/require of the package (allowing scoped subpaths)
        base = dep.split("/")[0] if not dep.startswith("@") else dep
        pat = re.compile(
            r"""(from\s+["']|require\(\s*["']|import\s+["']|import\s+|^\s*import\s)"""
            + re.escape(base), re.M)
        py_pat = re.compile(
            r"^\s*(import|from)\s+" + re.escape(dep.replace("-", "_")), re.M)
        if not pat.search(source_blob) and not py_pat.search(source_blob):
            unused.append(dep)
    if not unused:
        return False, 0.0, "every declared dependency is imported somewhere sampled"
    ratio = len(unused) / len(deps)
    severity = 1.0 if ratio >= 0.5 else (0.66 if ratio >= 0.25 else 0.33)
    shown = ", ".join(unused[:6]) + ("…" if len(unused) > 6 else "")
    return True, severity, f"{len(unused)}/{len(deps)} declared deps never imported in sampled files: {shown}"


# ---------- check 3: leftover debug artifacts ----------
DEBUG_PATTERNS = [
    (re.compile(r"\bconsole\.log\("), "console.log"),
    (re.compile(r"\bdebugger\b"), "debugger"),
    (re.compile(r"^\s*print\("), "bare print()"),
    (re.compile(r"//\s*TODO[:\s].*remove|#\s*TODO[:\s].*remove", re.I), "TODO remove"),
]


def check_debug_artifacts(sampled):
    hits, total_loc, worst = 0, 0, {}
    for path, text in sampled.items():
        ext = Path(path).suffix.lower()
        if ext not in SOURCE_EXTS:
            continue
        lines = text.splitlines()
        total_loc += len(lines)
        count = 0
        for line in lines:
            for pat, _label in DEBUG_PATTERNS:
                if pat.search(line):
                    # print() is only debug smell outside python CLIs — count it
                    # in .py files only when not under if __name__ guard heuristics
                    count += 1
                    break
        if count:
            hits += count
            worst[path] = count
    if not total_loc or not hits:
        return False, 0.0, "no debug artifacts in sampled files"
    density = hits / total_loc * 100  # per 100 LOC
    if density < 0.5:
        return False, 0.0, f"only {hits} debug lines in {total_loc} LOC — within tolerance"
    severity = 1.0 if density >= 3 else (0.66 if density >= 1.5 else 0.33)
    top = max(worst, key=worst.get)
    return True, severity, f"{hits} debug artifacts across sampled files (worst: {top} with {worst[top]})"


# ---------- check 4: no error handling on IO/network ----------
IO_CALL_RE = re.compile(
    r"\bfetch\(|\baxios[.(]|\brequests\.(get|post|put|delete|patch)\(|"
    r"\.query\(|\.execute\(|urlopen\(|http\.request|\bopen\("
)
HANDLER_RE = re.compile(r"\btry\b|\.catch\(|\bexcept\b|\brescue\b|\.then\([^)]*,")


def check_no_error_handling(sampled):
    total_calls, unhandled, worst = 0, 0, {}
    for path, text in sampled.items():
        if Path(path).suffix.lower() not in SOURCE_EXTS:
            continue
        lines = text.splitlines()
        for i, line in enumerate(lines):
            if not IO_CALL_RE.search(line):
                continue
            total_calls += 1
            lo, hi = max(0, i - 10), min(len(lines), i + 11)
            window = "\n".join(lines[lo:hi])
            if not HANDLER_RE.search(window):
                unhandled += 1
                worst[path] = worst.get(path, 0) + 1
    if not total_calls:
        return False, 0.0, "no IO/network calls in sampled files"
    ratio = unhandled / total_calls
    if ratio < 0.3 or unhandled < 2:
        return False, 0.0, f"{unhandled}/{total_calls} IO calls unhandled — within tolerance"
    severity = 1.0 if ratio >= 0.7 else (0.66 if ratio >= 0.5 else 0.33)
    top = max(worst, key=worst.get)
    return True, severity, f"{unhandled}/{total_calls} IO/network calls with no try/catch or .catch (worst: {top})"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workdir", default="work")
    args = ap.parse_args()
    workdir = Path(args.workdir)

    repo = load_json(workdir / "repo.json") or {}
    tree = load_json(workdir / "tree.json") or {}
    languages = load_json(workdir / "languages.json") or {}
    sampled = read_sampled(workdir)
    if not sampled:
        print(json.dumps({"error": "no sampled files in workdir"}))
        sys.exit(1)

    findings = []

    t1, ev1 = check_no_tests(tree, sampled)
    findings.append({"check": "no_tests", "triggered": t1, "severity": 1.0 if t1 else 0.0, "evidence": ev1})

    t2, s2, ev2 = check_unused_deps(sampled)
    findings.append({"check": "unused_deps", "triggered": t2, "severity": s2, "evidence": ev2})

    t3, s3, ev3 = check_debug_artifacts(sampled)
    findings.append({"check": "debug_artifacts", "triggered": t3, "severity": s3, "evidence": ev3})

    t4, s4, ev4 = check_no_error_handling(sampled)
    findings.append({"check": "no_error_handling", "triggered": t4, "severity": s4, "evidence": ev4})

    raw = sum(WEIGHTS[f["check"]] * f["severity"] for f in findings if f["triggered"])
    score = max(0, min(100, round(raw)))

    src_paths = source_paths_in_tree(tree)
    sampled_src = [p for p in sampled if Path(p).suffix.lower() in SOURCE_EXTS]
    sampled_loc = sum(len(sampled[p].splitlines()) for p in sampled_src)
    if sampled_src and len(src_paths) > len(sampled_src):
        est_loc = round(sampled_loc / len(sampled_src) * len(src_paths))
    else:
        est_loc = sampled_loc

    eligible = len(src_paths) >= 5 and est_loc >= 300

    print(json.dumps({
        "repoUrl": f"https://github.com/{repo.get('full_name', '').lower()}",
        "scoreVersion": SCORE_VERSION,
        "cookedScore": score,
        "tier": tier_for(score),
        "findings": findings,
        "filesExamined": sorted(sampled.keys()),
        "leaderboardEligible": eligible,
        "stats": {
            "files": len(src_paths),
            "loc": est_loc,
            "languages": list(languages.keys())[:5],
        },
    }, indent=2))


if __name__ == "__main__":
    main()
