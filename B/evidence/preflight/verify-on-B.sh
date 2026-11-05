#!/usr/bin/env bash
# verify-on-B.sh — Codex/审阅者在 B 上复验 T3 结论的最小脚本
# 用法: bash verify-on-B.sh [env|full]     env=只查环境与端口(不调用模型)  full=另跑模型实测
# 注意: codex 在非 git 目录会要求 --skip-git-repo-check，已内置；stdin 已重定向，避免额外输入提示
# 退出码: 0 全部符合预期(或预期的失败被正确识别)  1 出现不符合预期的结果
set -u
MODE=${1:-env}
FAIL=0
ok(){ printf "OK   %s\n" "$1"; }
bad(){ printf "FAIL %s\n" "$1"; FAIL=1; }
note(){ printf "NOTE %s\n" "$1"; }

echo "== 0. 机器身份 =="
echo "host=$(hostname) user=$(whoami) date=$(date -Iseconds)"

echo "== 1. 软件入口与版本 =="
CODEX="C:/Users/19082/AppData/Local/OpenAI/Codex/bin/codex.exe"
DSH="D:/DPH/resources/runtime/cli/bin/dsh.cmd"
CLAUDE="C:/Users/19082/.local/bin/claude.exe"
v=$(node --version 2>/dev/null); [ "$v" = "v24.12.0" ] && ok "node $v" || bad "node=$v (期望 v24.12.0)"
v=$(git --version 2>/dev/null); case "$v" in *2.56.0*) ok "git $v";; *) note "git $v (记录时为 2.56.0.windows.2，允许变化)";; esac
v=$(powershell -NoProfile -Command "Get-ExecutionPolicy" 2>/dev/null | tr -d "\r"); [ "$v" = "RemoteSigned" ] && ok "ExecutionPolicy RemoteSigned" || bad "ExecutionPolicy=$v"
command -v pwsh >/dev/null 2>&1 && note "pwsh 存在（记录时不存在，环境已变化）" || ok "pwsh 不存在（与报告一致）"
[ -x "$CODEX" ] && ok "codex 存在: $("$CODEX" --version 2>&1 | head -1)" || bad "codex 缺失: $CODEX"
[ -f "$DSH" ] && ok "dsh.cmd 存在: $("$DSH" --version 2>&1 | tail -1)" || bad "dsh.cmd 缺失: $DSH"
[ -x "$CLAUDE" ] && ok "claude 存在: $("$CLAUDE" --version 2>&1 | head -1)" || bad "claude 缺失: $CLAUDE"

echo "== 2. 模型上游 8317 =="
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://127.0.0.1:8317/v1/models 2>/dev/null || echo 000)
case "$code" in 200|401|404) ok "8317 有响应 (http=$code)";; *) bad "8317 无响应 (http=$code) — 检查计划任务 \\CLIProxyAPI 与 cli-proxy-api.exe 进程";; esac

echo "== 3. 证据文件哈希 =="
cd "$(dirname "$0")" && for f in B.md manifest.json b-preflight.json; do [ -f "$f" ] && ok "$f $(sha256sum "$f" | cut -c1-16)" || bad "$f 缺失"; done

if [ "$MODE" = "full" ]; then
  echo "== 4. 模型实测（Codex 备用模型；默认模型应 429，属已知冷却） =="
  out=$("$CODEX" exec --skip-git-repo-check -m deepseek-v4.1-flash-1017 "只输出一行：CODEX_VERIFY_OK" </dev/null 2>&1)
  echo "$out" | grep -q "CODEX_VERIFY_OK" && ok "codex -m deepseek-v4.1-flash-1017 可用" || bad "codex 备用模型不可用: $(echo "$out" | tail -2)"
  echo "== 5. 模型实测（Claude Code） =="
  out=$("$CLAUDE" -p --model deepseek-v4.1-flash-1017 "只输出一行：CLAUDE_VERIFY_OK" </dev/null 2>&1)
  echo "$out" | grep -q "CLAUDE_VERIFY_OK" && ok "claude 可用" || bad "claude 不可用: $(echo "$out" | tail -2)"
  echo "== 6. DSH headless（需要 OPENCODE_GO_API_KEY 注入，见 raw/run-dsh-headless2.sh） =="
  if [ -n "${OPENCODE_GO_API_KEY:-}" ]; then
    out=$("$DSH" --profile headless --patch "$(pwd)/raw/headless-opencode-go.patch.yml" "只输出一行：DSH_VERIFY_OK" 2>&1)
    echo "$out" | grep -q "DSH_VERIFY_OK" && ok "dsh headless 可用" || bad "dsh headless 失败: $(echo "$out" | tail -3)"
  else
    note "OPENCODE_GO_API_KEY 未注入，跳过 dsh headless（预期失败 MISSING_CREDENTIAL）"
  fi
else
  echo "NOTE 环境模式：未调用模型。加 full 参数可复验 Codex/Claude/DSH headless。"
fi

echo "== 结果: $([ $FAIL -eq 0 ] && echo PASS || echo CHECK-FAILED) =="
exit $FAIL
