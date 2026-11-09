# 第 1 期执行包：DSH 接入（注册 + 真模型冒烟）

- 日期：2026-11-09
- 前置：第 0 期已落盘并经独立复核（GOAL v2 哈希 `a97b5735…`、策略 v1 哈希 `7ce2cdb3…`，两机 DSH 入口均为档位 ①：随包 CLI/ACP、不在 PATH）。
- 本期目标：把两机的 DSH 注册为中台 agent，并各完成一次**经 hub 派发**的真实模型冒烟，拿到 done 回执。

## 本期执行约定（经用户批准后生效）

1. **调用一律用绝对路径**，不改 PATH、不启用 command-path、不 `npm i -g`：
   - A：`D:\DSH\resources\runtime\cli\bin\dsh.cmd`
   - B：`D:\DPH\resources\runtime\cli\bin\dsh.cmd`
   - 一次性任务形态：`dsh.cmd headless --json --permission-mode workspace-write --approval-policy never "<任务>"`
2. **rules.json 本期只允许新增 dsh agent 条目**（A 侧执行），改前备份、改后在报告中贴 diff；其余规则一律不动。优先复用现有 `command` 类插件承载；若现有插件无法承载，**停下报告，不新写插件代码**（写代码另派 Codex）。
3. **分支命名**：本期起新任务分支统一 `task/<任务号>-<短名>`；历史 `b/*` 分支不追溯改名。
4. **评审落位**：B 侧只承担实现与复跑；评审一律派 A 侧另一 Agent（满足异机异 Agent）。
5. **版本差已知悉**：A 的 DSH 为 0.2.2-rc.1、B 为 0.2.1-rc.3，本期不升级（升级属装软件，另行拍板），报告各自记录版本。
6. DSH 注册角色：可写 agent，但只动任务分支；`--approval-policy never` 仅限任务分支内的常规动作，命中《拍板策略》必须拍板清单时仍须出卡，不得以 never 绕过。

## 分工

- A 的 DSH 执行 `PROMPT-A.md`：备份并修改 A 的 rules.json 注册 `dsh-a`（绑定 A 机 worker）与 `dsh-b`（绑定 B 机 worker）的 agent 条目（命令均为各机绝对路径）；经 hub 派发冒烟任务；报告回 `autoagentloop-status` 仓 `reports/20261109-phase1-a.md`。
- B 的 DSH 执行 `PROMPT-B.md`：先在本机直连跑一次 headless 冒烟作对照证据，再配合 A 完成跨机冒烟（A 派活 → B 的 dsh 执行 → 回执）；不改 rules、不动 PATH；报告回 handoff 仓新分支 `b/phase1-20261109` 的 `reports/20261109-phase1-b.md`。

两边可并行启动，但跨机冒烟需等 A 完成注册后由 A 发起，B 侧留意 hub 派单。

## 本期红线（两边通用）

- 不装软件、不改 PATH、不改系统配置；不升级 DSH。
- 不改 GOAL、APPROVAL_POLICY、DECISIONS（本期结论只写报告）；不合 main、不推 main。
- 冒烟任务必须是零业务副作用的合成任务，不碰真实项目文件与任何密钥。
- 报告不得出现任何 key/token 明文；模型凭据来源只写通道名（opencode-go），不写值。
