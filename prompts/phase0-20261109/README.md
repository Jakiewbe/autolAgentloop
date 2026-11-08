# 第 0 期执行包（2026-11-09，用户批准下发）

本目录由 Muse 起草、用户 2026-11-09 批准，随分支 `deliver/prompt-phase0-20261109` 下发。

## 文件

- `GOAL.md` —— 《项目目标》正式版（用户批准），由 A 侧落入 `.agent/GOAL.md`。
- `APPROVAL_POLICY.md` —— 《拍板策略》正式版 v1（用户批准），由 A 侧落为项目根目录常驻文件。
- `PROMPT-A.md` —— 给 A 机 DSH 的执行指令（落盘 + DSH 入口核查）。
- `PROMPT-B.md` —— 给 B 机 DSH 的执行指令（对齐确认 + DSH 入口核查）。

## 执行方式（给用户）

- 把 `PROMPT-A.md` 全文发给 A 机的 DSH，把 `PROMPT-B.md` 全文发给 B 机的 DSH；两边可并行，互不等待。
- A 的报告回在 autoagentloop-status 仓 `reports/20261109-phase0-a.md`；B 的报告回在 agent-autoloop-b-handoff-20261107 仓分支 `b/phase0-20261109` 的 `reports/20261109-phase0-b.md`。
- 两份报告齐后由 Muse 只读复核（对哈希、对 hub.db、对仓库实据），再起草第 1 期（DSH 注册与冒烟）的 prompt。

## 本轮边界

只做到：第 0 期治理文件落盘（A）、两机 DSH 入口查清。**不含**：DSH 注册、rules 修改、任务源打通、基座切换——那些在后续期次的 prompt 里。
