#!/usr/bin/env python3
"""重算 evidence/manifest.json 里 artifacts 的 bytes/sha256（只改这几项与 generated_at）。

防的失败方式：清单说某材料是这个哈希，实物已经变了 —— 验收方按清单核对会得出错误结论。
只读实物、只写 manifest.json；不提交、不碰 app/。
用法：python -B tools/checks/refresh_manifest.py
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "evidence" / "manifest.json"
CN = timezone(timedelta(hours=8))


def main() -> int:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    missing = []
    for art in data["artifacts"]:
        p = ROOT / art["path"]
        if not p.exists():
            missing.append(art["path"])
            continue
        b = p.read_bytes()
        art["bytes"] = len(b)
        art["sha256"] = hashlib.sha256(b).hexdigest()
    data["generated_at"] = datetime.now(CN).isoformat(timespec="seconds")
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"artifacts={len(data['artifacts'])} missing={len(missing)}")
    for m in missing:
        print("缺文件：", m)
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
