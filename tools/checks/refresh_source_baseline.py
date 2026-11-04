#!/usr/bin/env python3
"""按当前 app/ 工作区重算 evidence/source-baseline.json 的改动清单与包哈希。

只重算「改了哪些文件、每个文件本地/上游哈希、补丁与部署包哈希」，不改基线提交、许可证、
治理哈希等判定性字段。用法：python -B tools/checks/refresh_source_baseline.py
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app"
BASELINE = ROOT / "evidence" / "source-baseline.json"


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def file_sha(p: Path) -> str:
    return sha(p.read_bytes())


def git(*args: str) -> str:
    out = subprocess.run(["git", *args], cwd=APP, capture_output=True)
    if out.returncode != 0:
        raise SystemExit(out.stderr.decode("utf-8", "replace").strip())
    return out.stdout.decode("utf-8", "replace")


def main() -> int:
    base = json.loads(BASELINE.read_text(encoding="utf-8"))
    commit = base["baselineCommit"]
    status = [line for line in git("status", "--porcelain=v1").splitlines() if line.strip()]
    modified = sorted(line[3:] for line in status if line.startswith(" M"))
    untracked = sorted(line[3:] for line in status if line.startswith("??"))

    base["contentHashes"]["modified"] = [
        {
            "path": p,
            "upstream": sha(subprocess.run(["git", "show", f"{commit}:{p}"], cwd=APP, capture_output=True).stdout),
            "local": file_sha(APP / p),
        }
        for p in modified
    ]
    generated = [p for p in untracked if p in {"pnpm-lock.yaml"}]
    added: list[str] = []
    for entry in untracked:
        if entry in generated:
            continue
        target = APP / entry.rstrip("/")
        if target.is_dir():  # git 把新目录报成一条，这里展开成逐个文件，避免对目录算哈希
            added.extend(str(f.relative_to(APP)).replace("\\", "/") for f in sorted(target.rglob("*")) if f.is_file())
        else:
            added.append(entry)
    added = sorted(added)
    base["contentHashes"]["added"] = [{"path": p, "sha256": file_sha(APP / p)} for p in added]
    base["changedFiles"]["modified"] = modified
    base["changedFiles"]["added"] = added
    base["changedFiles"]["generated"] = generated
    base["gitStatus"]["afterWindowsChanges"] = status

    bundle = base["contentHashes"]["bundle"]
    patch = ROOT / base["windowsChangeBundle"]["patch"]
    tar = ROOT / bundle["deploy_tarball"]
    bundle["patch_sha256"] = file_sha(patch)
    base["windowsChangeBundle"]["patch_bytes"] = patch.stat().st_size
    bundle["deploy_sha256"] = file_sha(tar)
    bundle["deploy_bytes"] = tar.stat().st_size

    BASELINE.write_text(json.dumps(base, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"modified={len(modified)} added={len(added)} generated={len(generated)}")
    print(f"patch={bundle['patch_sha256']}")
    print(f"deploy={bundle['deploy_sha256']} ({bundle['deploy_bytes']} B, {tar.name})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
