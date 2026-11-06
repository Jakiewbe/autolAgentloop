#!/usr/bin/env bash
# 最短启动：只依赖本目录 + 本机 Node 24 + 本机 Chrome/Edge。
# 用法：./run.sh                 # 跑全部 14 条正向用例
#       ./run.sh T8 T9           # 只跑指定用例
#       ./run.sh negatives       # 跑 15 条负例
#       ./run.sh supplement      # 补充用例（时序A/B、宽度、/c/ 面板侧）
#       ./run.sh q3              # Q3：两档真实视口 + DPR + 独立截图
#       ./run.sh q5-hold         # Q5：时序A 请求顺序与分母
#       ./run.sh q5-history      # Q5：时序B 请求顺序与分母
#       ./run.sh lock            # 只校验受审构建字节（build-lock）
#       ./run.sh guard           # T9 分母判据单元正负例（空录制必须 false）
#       ./run.sh q4-expiry       # Q4：/c/ 合法/无效/回跳/CSP/过期（可控时钟，不改系统时间）
#       ./run.sh q4-centry       # Q4：真实内核 /c/ 的 CSP/安全头/伪造链接（自建临时 HOME）
#       ./run.sh q4-fold         # Q4：心跳折叠判据（合成输入，秒级）
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export REVIEW_APP_DIR="$HERE/app"
export REVIEW_EXTRACT="$HERE/extract-v2-c66a3c64"
export REVIEW_RULES="$HERE/selftest-v2/rules-v2.json"
export SUITE_LABEL="${SUITE_LABEL:-pkgcheck}"
NODE="${NODE_BIN:-node}"
# 先钉死受审构建：任何一处字节不符直接退出，避免「跑的不是受审构建」。
if [ "${1:-all}" != "lock" ]; then
  "$NODE" "$HERE/real-board/build-lock.mjs"
fi
case "${1:-all}" in
  lock)       exec "$NODE" "$HERE/real-board/build-lock.mjs" ;;
  guard)      exec "$NODE" "$HERE/real-board/t9-guard-unit.mjs" ;;
  q4-centry)  exec "$NODE" "$HERE/real-board/q4-centry.mjs" ;;
  q4-fold)    exec "$NODE" "$HERE/real-board/q4-fold-unit.mjs" ;;
  negatives)  exec "$NODE" "$HERE/real-board/negatives-real.mjs" ;;
  supplement) exec "$NODE" "$HERE/real-board/supplement.mjs" "${@:2}" ;;
  q3)         exec "$NODE" "$HERE/real-board/q3-viewports.mjs" ;;
  q5-hold)    exec "$NODE" "$HERE/real-board/q5-order.mjs" hold ;;
  q5-history) exec "$NODE" "$HERE/real-board/q5-order.mjs" history ;;
  q4-expiry)  exec "$NODE" "$HERE/real-board/q4-expiry.mjs" ;;
  all)        exec "$NODE" "$HERE/real-board/suite-real.mjs" ;;
  T[0-9]*)    exec "$NODE" "$HERE/real-board/suite-real.mjs" "$@" ;;
  *)          echo "未知用例：$1（可用：all、T1..T14、negatives、supplement、q3、q5-hold、q5-history、q4-centry、q4-expiry、q4-fold、guard、lock）" >&2; exit 2 ;;
esac
