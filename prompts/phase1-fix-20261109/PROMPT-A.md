# PROMPT-A（第 1 期补单 · A 侧）：重注册 dsh-b + 重派跨机冒烟

你是 A 机（DESKTOP-LM7RKI1）上的 DSH。先读同目录 `README.md`（含验收认定的
失败根因与固定约定），再读你自己的第 1 期报告（status 仓 main
`reports/20261109-phase1-a.md`）与 B 的第 1 期报告（handoff 仓
`b/phase1-20261109` 的 `reports/20261109-phase1-b.md`，尤其第二节三条发现）。

前置事实：用户 2026-11-09 12:50 已拍板**接受 `dsh-a` 的包装器偏离**
（内建 dsh 适配器 + program 包装器为正式形态，本补单不动 `dsh-a`）。
请把这条追认记入项目 DECISIONS（注明日期与「用户经 Muse 验收报告拍板」）。

依据：`.agent/GOAL.md` v2、项目根 `APPROVAL_POLICY.md` v1（本轮只执行不修改）。
红线沿用第 1 期：不动 `dsh-a` 定义、不新写插件代码、不升级任何一侧 DSH、
不装软件、不改 PATH、不重启 hub/看板/隧道（rules 热加载除外）。

## 任务一：等 B 就绪

先读 B 的补单报告：handoff 仓分支 `b/phase1-fix-20261109` 的
`reports/20261109-phase1-fix-b.md`。读不到该分支或报告里没有明确「可派单」
声明时，**不要动 rules、不要派单**，把等待状态报给用户即可。
（B 的工件路径以 README 约定为准：包装器
`C:\Users\19082\.agent-autoloop\phase1-smoke\dsh-headless.ps1`、
overlay `…\phase1-smoke\patch-headless-go.yml`。）

## 任务二：重注册 dsh-b（只改这一条）

1. 先备份当前 rules.json（命名仿上次：`rules.json.bak-2026-11-09-phase1fix`），
   记下备份 sha256。
2. 只修改 `dsh-b` 一条 agent 定义，改成经 B 包装器调用的 command 形态：
   执行 B 侧 `dsh-headless.ps1`、任务以 `{prompt}` 占位传入；
   命令中**不得出现** `--permission-mode`、`--approval-policy`、
   不得内嵌任何 `--patch` 路径或凭据（都由 B 包装器负责）。
   `dsh-b` 的 worker 仍为 `b-magicbook14`、access 与 timeout 沿用现值。
   若 B 报告里给出了期望的注册形态，优先逐字采用并在报告中注明。
3. 改后机器比对（备份 vs 改后）并在报告中贴结论：应只有 `dsh-b` 一条变化，
   agents/rules 的新增、删除、其他条目改动均为零；`dsh-a` 逐字未动。
4. 跑 `agent-autoloop check`，确认 `/v1/state` 里 agents 仍为 9、
   `dsh-b` 定义与第 2 步一致。

## 任务三：重派跨机冒烟

1. 复用现有规则 `第1期冒烟B` 派新事件（新事件 id，如 `p1-smoke-b-2`），
   subject 沿用第 1 期的合成任务口径：在 B 的合成仓库
   `C:\Users\19082\.agent-autoloop\phase1-smoke\repo` 内，
   从 main 建分支 `task/p1-smoke-b`，写 `evidence/phase1-smoke/dsh-b.txt`
   （日期、机器名、一句自我介绍），commit 并 push 到 origin。
2. 全程观测事件链（routed / claimed / done 或失败），记录新 run id、
   attempts、起止时间、exit 状态；失败就如实记录错误尾部并停手，
   **不许改参数连环重试**（自动重试按既有规则走完即止），更不许代 B
   改其工件。
3. 从 run 的 stdout 里提取 session id（`--json` 事件流应含 session 事件）；
   取不到就写明取不到，不编造。用量同理，有则记、无则写无。

## 任务四：报告

写 status 仓 main `reports/20261109-phase1-fix-a.md`，包含：

1. DECISIONS 追认记录（`dsh-a` 包装器偏离经用户拍板接受）；
2. B 就绪证据（B 报告分支/提交、其「可派单」原话）；
3. rules 备份与 diff 结论、`dsh-b` 最终定义全文（脱敏，本就无凭据）、
   check 与 `/v1/state` 结果；
4. 重派全记录：事件 id、run id、事件链时间点、exit、耗时、
   session id/用量（如有）、run 汇总原文；
5. 关期自检（对照 README 关期标准逐条）：跨机 done/exit 0、
   B 侧分支与文件推送到位（以 B 补记为准、注明出处）、回执结果；
6. 未完成/未验项逐条（如有）。

做完把报告路径报给用户。跨机若仍失败，只报事实与错误原文，
下一步等用户与 Muse 验收后再定，不自行开新方案。
