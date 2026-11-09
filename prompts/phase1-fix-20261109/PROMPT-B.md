# PROMPT-B（第 1 期补单 · B 侧）：落地跨机工件 + 预检，等 A 重派

你是 B 机（MAGICBOOK14）上的 DSH。先读同目录 `README.md`（固定约定与关期标准），
再读第 1 期你自己的报告（handoff 仓 `b/phase1-20261109` 的
`reports/20261109-phase1-b.md`）与 A 的报告（status 仓 main 的
`reports/20261109-phase1-a.md` 第三节：run 73 失败记录）。

背景一句话：跨机 run 73 失败的根因在 A 注册的 `dsh-b` 命令（0.2.2 专属参数、
overlay 路径不存在、无凭据注入）。本补单由你先把 B 侧工件按约定路径落地并
预检通过，A 再按你的形态重注册、重派。

依据：项目 `.agent/GOAL.md` v2 与项目根 `APPROVAL_POLICY.md`
（本地副本以 A 机为准，本轮只执行不修改）。红线沿用第 1 期：
不升级 DSH、不改 PATH、不装软件、不改 `~/.dsh` 任何 profile 文件、
不动生产基座、不重启 worker、不碰 A 机文件；凭据值不进任何报告与仓库。

## 任务一：落地三个工件（路径以 README 约定为准）

1. **overlay**：`C:\Users\19082\.agent-autoloop\phase1-smoke\patch-headless-go.yml`，
   内容与你直连冒烟验证跑通的 `models.patch.yml` 一致（agent-default-model →
   opencode-go / deepseek-v4.1-flash；llm-pi-ai 的 opencode-go apiKeyEnv →
   OPENCODE_GO_API_KEY）。写完用 `--dump-config` 复核两处生效。
2. **包装器**：`C:\Users\19082\.agent-autoloop\phase1-smoke\dsh-headless.ps1`，
   仿 A 侧 `dsh-headless.ps1` 的职责，只做两件事：
   - 从本机凭据存放处读取 `OPENCODE_GO_API_KEY`，只注入**本子进程**环境
     （不打印、不落日志、进程结束即消失）；
   - 转发调用 `D:\DPH\resources\runtime\cli\bin\dsh.cmd --profile headless
     --patch <上面的 overlay 绝对路径> --json <收到的任务原文>`，
     stdout 原样透传、exit code 原样返回。
   任务原文以单个参数形式接收（A 侧 command 插件用 `{prompt}` 占位传入），
   包装器不得改写任务内容。
3. **合成仓库**：`C:\Users\19082\.agent-autoloop\phase1-smoke\repo`：
   git init、main 上一条 init 提交、origin 指向同目录内裸库 `_remote.git`
   并已推送 main（仿 A 侧结构，保证 push 不出 workspace、避开 ACL 问题）。

## 任务二：用包装器本体预检（不经 hub）

在 `%TEMP%` 下建一次性目录，用**与 A 将来派单完全相同的调用方式**
（即直接执行包装器、任务以单参数传入）跑一个最小合成任务：
在预检目录写 `wrapper-preflight.txt`（日期、机器名、一句自我介绍），
读回核对。记录：exit code、耗时、session id（`--json` 事件流首行）、
事件流行数。预检不过就停在这里：把报错原文写进报告，不许换方案绕
（不许改 profile、不许把 key 写进文件、不许升级）。

## 任务三：报告（含「可派单」声明）

推送到 handoff 仓新分支 `b/phase1-fix-20261109`，文件
`reports/20261109-phase1-fix-b.md`，包含：

1. 三个工件的路径与校验（overlay 的 `--dump-config` 复核结果摘录、
   包装器职责逐行说明、合成仓 `git log` 与远端分支列表）；
2. 预检全记录（命令形态脱敏、exit、耗时、session id、产物内容读回）；
3. 明确一句「可派单」或「不可派单＋原因」；
4. 给 A 的注册提示：你期望 A 把 `dsh-b` 注册成什么形态（命令数组逐字给出，
   路径用上面的固定路径；提醒 A 不要加 `--permission-mode` /
   `--approval-policy`）；
5. 红线自检表（沿用你第 1 期报告的格式）。

## 任务四：派单到达后补记（A 重派后）

盯 `up.log` 与 worker 状态，跨机 run 到达后在同一分支追加补充
（同文件加一节或新增 `reports/20261109-phase1-fix-b2.md`）：
run id、到达/开始/结束时间、本机侧 session id、exit 状态；
**回执上交结果**：成功，或若再现 `couldn't hand in the result: fetch failed`
记原文与时间（这是第 0 期欠账 #5 的验证点）；
产物核验：合成仓分支 `task/p1-smoke-b`、`evidence/phase1-smoke/dsh-b.txt`
内容读回、origin 推送状态。

做完把分支与报告路径报给用户转交 A 和 Muse 验收。
