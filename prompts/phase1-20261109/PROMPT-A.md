# PROMPT-A1 · 第 1 期 A 侧：注册 DSH agent + 经 hub 真模型冒烟

机器：A（DESKTOP-LM7RKI1）。执行者：本机 DSH。
依据：《项目目标》v2（`.agent/GOAL.md`）、《拍板策略》v1（`APPROVAL_POLICY.md`）、本期执行包 README（分支 `deliver/prompt-phase1-20261109` 的 `prompts/phase1-20261109/`）。
第 0 期结论已定：本机 DSH 为档位 ①，绝对路径 `D:\DSH\resources\runtime\cli\bin\dsh.cmd`，版本 0.2.2-rc.1，headless 与 acp 入口均在。

## 任务一：注册两个 DSH agent（只加条目，不动其他规则）

1. 先只读核查现有 `rules.json` 中 agent 的注册形态（以 `claude-go-review` 与 codex 条目为样本），确认现有 `command` 类插件能否承载下列调用形态：
   `D:\DSH\resources\runtime\cli\bin\dsh.cmd headless --json --permission-mode workspace-write --approval-policy never "<任务>"`
   - 能承载 → 走注册，第 2 步。
   - 不能承载 → **停下**，在报告中写清缺口（缺什么字段/能力），不新写插件代码（另派 Codex），任务二改走「本机直连冒烟」并注明未经 hub。
2. 备份 `rules.json`（带日期后缀，放在原目录），然后只新增两条 agent：
   - `dsh-a`：绑定 A 机 worker，命令为 A 机绝对路径（见上）。
   - `dsh-b`：绑定 B 机 worker（`b-magicbook14`），命令为 B 机绝对路径 `D:\DPH\resources\runtime\cli\bin\dsh.cmd`，其余参数同构。
   - 两条的 access、timeout 等字段参照现有可写 agent 的口径；拿不准的字段在报告中列出所选值与理由。
3. 改后自检：rules.json 可解析、hub 健康检查正常（`/healthz`）、原有 agent 条目逐条未变（diff 证明只有新增）。

## 任务二：经 hub 的真模型冒烟（A 本机先行）

1. 经 hub 正常派单流程给 `dsh-a` 一个零副作用合成任务，例如：「在任务分支 `task/p1-smoke-a` 上新建 `evidence/phase1-smoke/dsh-a.txt`，写入当前日期、机器名与一句自我介绍，提交并推送该分支。」
2. 验收取证（全部写入报告）：
   - hub 事件链中该任务的 assigned → done 完整记录（run id、时间）；
   - DSH 的 session id、实际模型名（只写模型名，如 deepseek-v4.1-flash，不写任何凭据值）、耗时、exit 状态；
   - 产物核验：分支与文件真实存在、内容符合任务要求。
3. 若任务一停在「不能承载」，本任务改为本机直连 `dsh.cmd headless --json …` 跑同一合成任务（不经 hub），并在报告标题注明降级原因。

## 任务三：发起跨机冒烟（B 侧配合）

- 注册完成后，经 hub 给 `dsh-b` 派同构合成任务（分支 `task/p1-smoke-b`、文件 `evidence/phase1-smoke/dsh-b.txt`），并在本报告中记录派单时间与 run id；B 侧的执行证据由 B 的报告给出，你只需记录本侧派单与 hub 事件链中可见的回执状态。
- 派单后若 B 侧长时间无回执，如实记录为未完成，不代 B 执行。

## 红线

- 不装软件、不改 PATH、不启用 command-path、不升级 DSH；不改 GOAL/策略/DECISIONS；不合 main、不推 main；不动他人未提交改动。
- `--approval-policy never` 只覆盖任务分支内常规动作；命中拍板清单的动作一律停下出卡说明，不执行。
- 任何 key/token 不得进报告与仓库。

## 报告

写 `reports/20261109-phase1-a.md` 提交到 `autoagentloop-status` 仓 main，含：注册 diff 摘要与备份位置、两条 agent 的最终定义（脱敏）、A 本机冒烟全证据、跨机派单记录、未完成/未验项清单。完成后停工待命，不进入第 2 期。
