# PROMPT-A（第 2 期 · A 侧）：收尾第 1 期 + 任务包/桥 + 补推触发 + 双试点

你是 A 机（DESKTOP-LM7RKI1）上的 DSH。先读同目录 `README.md` 与
`TASK_PACKAGE.md`，再读你自己的第 1 期补单报告（status 仓 main
`reports/20261109-phase1-fix-a.md`）与 B 的补记（handoff 仓
`b/phase1-fix-20261109` 的 `reports/20261109-phase1-fix-b2.md`）。

依据：`.agent/GOAL.md` v2、`APPROVAL_POLICY.md` v1。红线沿用：
不动 `dsh-a` 定义、不新写 hub 插件代码、不升级 DSH、不装软件、
不改 PATH、不重启 hub/看板/隧道（rules 热加载除外）、不真合 main。

## 任务一：第 1 期收尾

1. 在 `.agent/DECISIONS.md` 记一条：第 1 期于 2026-11-09 19:24 经用户
   拍板关期，注记原文「跨机主链（派单→执行→回执）已证明；会话内 push
   被 B 沙箱两条硬限制（文件策略范围、命名管道 Win32 error 5）挡住，
   分支由 B 宿主补推、磁盘事实成立；push 改造进第 2 期」。走 kit 流程。
2. 删除两条临时规则 `第1期冒烟A`、`第1期冒烟B`：先备份 rules.json
   （命名仿此前惯例），机器比对自证只删这两条、agents 与其余规则
   逐字未动，跑 `agent-autoloop check` 确认。

## 任务二：任务包规范落盘

把同目录 `TASK_PACKAGE.md` 的格式规范落进项目（放项目根或 docs，
位置你定、报告里注明），作为此后所有任务的统一格式。本期两个试点
任务都按它写。

## 任务三：tasks.json → emit 桥（只许脚本+台账，不许插件）

实现一个 A 侧脚本（放项目内、路径报告注明），职责：

- 轮询项目 `.agent/tasks.json`，找 `status=approved` 且台账里没有
  emit 记录的任务；
- 同项目已有在飞任务（已 emit 未见 PASS/BLOCKED 终局）时，后续
  approved 任务**不 emit**，只在台账记 `held: serial`；
- emit 时只发 TASK_PACKAGE 的派单短句模板，事件 subject 带任务号；
- 台账为脚本旁的 jsonl 文件：每条 emit/held/终局各记一行（含时间、
  任务号、事件 id）；终局由你按 run 结果与评审结论补记。
- 轮询的驱动方式用既有手段（计划任务或 hub 既有定时能力），不新写
  hub 插件；驱动方式与周期写进报告。

自证：造一个假 approved 任务跑两轮轮询——第一轮 emit 一次、第二轮
不重发；再造第二个同项目 approved 任务，证明被 held。假任务测完
撤销并在报告注明。

## 任务四：B 侧补推的触发接线

B 会落地宿主补推脚本 `host-tools\push-task.ps1`（见 B 报告，含路径
白名单）。你这边：注册一个 command agent（如 `host-push-b`）指向它，
并定一条规则/流程：任务 run done 且执行者报告「已 commit 未 push」
时，emit 补推事件（subject 带任务号、仓库与分支以任务包为准）。
注册前先备份 rules、只新增，机器比对自证。若既有形态承载不了
「run done 后触发」，把卡点原文写进报告，不许绕。

## 任务五：GitHub https 会话内 push 探针（A 侧，只测）

经 `dsh-a` 在会话内对 autolAgentloop 新建探针分支
`chore/push-probe-20261109`（只加一个探针文件）尝试 push 到 GitHub，
记录成功或错误原文。探针分支留着不删。

## 任务六：两个试点（与 B 的进度经用户转告对齐，不抢跑）

- **试点 1**：你写任务包（executor=dsh-b，reviewer=codex-a 或 dsh-a，
  内容选一个小实活：在 B 第 1 期合成仓的姊妹仓里补一份 README 索引
  或同等低风险文档活，验收命令明确），提交入仓后**经桥 emit**
  （不要手工派单——桥就是本期要验的东西）。B 执行、补推后，你侧
  评审：结论落文件，FIX 往返 ≤3 轮逐轮记录。
- **试点 2**：方向相反——executor=dsh-a（或 codex-a）、reviewer=dsh-b，
  内容同为低风险文档活，走同一条桥与评审流程。B 的评审结论回来后
  按 FIX 处理或收尾。

两试点都不真合 main，PASS 即止，分支留着。

## 报告

写 status 仓 main `reports/20261109-phase2-a.md`，包含：

1. 第 1 期收尾两项的证据（DECISIONS 条目、rules diff 结论）；
2. 任务包规范落盘位置；
3. 桥：脚本路径、驱动方式与周期、台账样例、自证两项结果；
4. 补推接线：新 agent 定义全文、触发方式、比对结论（或卡点原文）；
5. A 侧 push 探针结论；
6. 两试点的全程记录（任务号、事件/run id、commit、补推 ref、
   评审结论与往返轮次）；
7. 关期自检（对照 README 五条逐条）与未完成/未验项。

做完把报告路径报给用户。任何一步卡住，只报事实与原文，
下一步等用户与 Muse 验收后再定。
