# PROMPT-B（第 2 期 · B 侧）：宿主补推脚本 + push 探针 + 试点执行/评审

你是 B 机（MAGICBOOK14）上的 DSH。先读同目录 `README.md` 与
`TASK_PACKAGE.md`，再读第 1 期补单你的两份报告（handoff 仓
`b/phase1-fix-20261109`）。第 1 期已关期（用户 2026-11-09 19:24 拍板，
注记：会话内 push 未证明、分支由你宿主补推成立）。

依据：`.agent/GOAL.md` v2、`APPROVAL_POLICY.md` v1（本轮只执行不修改）。
红线沿用：不升级 DSH、不改 PATH、不装软件、不改 `~/.dsh` profile、
凭据不进脚本明文/报告/仓库、不碰 A 机文件、不真合任何 main。

## 任务一：宿主补推脚本（轨道一）

在固定路径落地 `C:\Users\19082\.agent-autoloop\host-tools\push-task.ps1`：

- 入参：仓库路径、分支名（两个普通参数，不接受任意命令片段）；
- 行为：对该仓库执行 `git push origin <分支>`，stdout/stderr 原样透传，
  exit code 原样返回；推送后打印该分支在远端的 ref（`git ls-remote`
  或裸库 `show-ref`）供核验；
- 白名单：只允许对 `C:\Users\19082\.agent-autoloop\` 下的仓库执行，
  路径不在白名单内直接 exit 2 并说明；
- 这个脚本由**宿主侧**（worker 的 command agent）调用，不在 DSH 沙箱
  会话内跑——它就是为绕开沙箱命名管道/文件策略限制而设的。

自测：用第 1 期合成仓做一次无害验证——在 `task/p1-smoke-b` 之外新建
一条本地测试分支 `chore/push-tool-selftest`（只含一个空提交或小文件），
用脚本补推到 `_remote.git`，`show-ref` 核验后把测试分支从远端删除、
本地保留或删除都行，过程记入报告。

## 任务二：GitHub https 会话内 push 探针（轨道二，只测）

在 DSH headless 会话内（经你的包装器）做一次最小探针：对 handoff 仓
（你有写权限）新建探针分支 `chore/push-probe-20261109`（基于
`b/phase2-20261109` 或 main 均可，只加一个探针文件），在会话内尝试
`git push` 到 GitHub。记录：成功，或失败的错误原文（重点看是否仍是
sh.exe/命名管道类错误）。探针分支留着不删，报告里注明。宿主侧 git
凭据形态只写「可用/不可用」，不写任何凭据内容。

## 任务三：试点任务 1 的执行（等 A 派单）

A 会按任务包格式派试点任务 1（executor=dsh-b，在第 1 期合成仓的
姊妹仓或 A 指定的试点仓里干活）。你按任务包执行：只 commit 不 push，
写 HANDOFF.md。run 结束后由宿主补推脚本推送（A 侧规则触发或按
A 报告约定的触发方式），你补记：补推的 ref 核验结果、评审若给 FIX
的往返轮次与每轮处理。

## 任务四：试点任务 2 的评审（等 A 完成执行后）

试点任务 2 由 A 侧执行（executor 在 A），你任评审：读任务包、
HANDOFF 与分支内容，按 TASK_PACKAGE 的评审约定给出 PASS / FIX /
BLOCKED，评审写成文件放进你的报告（或 REVIEW 文件，能落盘为准），
结论词经事件 summary 回 A。FIX 往返里你只复审、不改代码。

## 报告

推送到 handoff 仓新分支 `b/phase2-20261109`，文件
`reports/20261109-phase2-b.md`，包含：

1. 补推脚本路径、白名单与自测全记录（命令、exit、show-ref 前后）；
2. push 探针结论（成功/失败原文、探针分支名）；
3. 试点 1 执行記錄：任务号、run id、session、commit 号、补推核验、
   评审往返（如有）；
4. 试点 2 评审记录：结论词、评审文件路径、FIX 条目（如有）；
5. 红线自检表（沿用此前格式）。

任务三/四未等到派单时，先把任务一/二推成报告初版并注明「待派单」，
不要空等——用户会转告 A 的进度。
