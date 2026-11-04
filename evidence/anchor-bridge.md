# T8 Anchor 桥接：从治理账本到中台事件

写这份文档的目的：说明「谁可以领任务」这个判断从哪里来、依据什么字段、失败时说什么话，以及桥接在两台机器上的边界。所有结论都对应本机实跑记录。

## 1. 位置与不变量

- 桥接程序：`tools/anchor_bridge/bridge.mjs`（纯 Node，无依赖，不 import 中台内部模块）。
- 单测：`tools/anchor_bridge/bridge.test.mjs`（`node --test`，8 条）。
- 桩治理程序：`tools/anchor_bridge/fixture-status.mjs`（只在联调时用，喂一条可领 + 一条草稿）。
- 三条不变量：
  1. **只读本机账本**。桥接调用本机治理程序的只读命令 `status <project> --brief --all`，不调用任何写命令。
  2. **不硬编码 A 机路径**。B 机用自己的治理程序；桥接只负责找到它，找不到就退出码 2 并说明怎么指定。
  3. **账本归属不跨越机器**。A 的账本只在 A 写；B 的项目账本由 B 的治理程序写。桥接既不远程写，也不把 A 的账本路径下发给 B。

## 2. 治理程序定位

`findKit(startDir)` 按顺序找：

| 顺序 | 来源 | 说明 |
|---|---|---|
| 1 | 环境变量 `ANCHOR_KIT` | 显式指定，优先；找不到直接报错，不静默回退 |
| 2 | `<project>/.codex/skills/**/project-anchor*/kit.py`、`<project>/.claude/skills/**` | 项目内技能安装 |
| 3 | `~/.codex/skills/**`、`~/.claude/skills/**` | 用户级技能安装；递归深度 ≤ 2 层 |

解释器 `interpreters()`：`ANCHOR_PYTHON` → `py -3` → `python` → `python3`，逐个试 `--version`；全失败则退出码 2。这样 B 机上「Python 装在哪」不影响桥接。

本机实测：`ANCHOR_KIT=C:/Users/chs/Desktop/codex-plus/kit.py`、`ANCHOR_PYTHON=C:/Users/chs/AppData/Local/Programs/Python/Python311/python.exe`（`py -3` 在本机报「需要 Python 3.11+」，所以必须显式指定）。

## 3. 领取判定（`objection(task, byId)`）

按顺序判，第一条命中的就是原因；返回 `null` 才叫「可领」。

| 顺序 | 条件 | 输出给中台/人的原因 |
|---|---|---|
| 1 | `plan !== "approved"` | 计划是 draft，没有批准 |
| 2 | `status === "done"` / `"cancelled"` | 已经结束 |
| 3 | `status === "blocked"` | 任务自身被阻塞 |
| 4 | `scope_dirty` | 范围改过，要重新批准 |
| 5 | `legacy_unverified` | 旧账本未核验 |
| 6 | 任一 `dependencies` 不在 `done` | 依赖未完成：T3（列出未完成的） |
| 7 | `deliverable_coverage !== "covered"` | 交付未声明 |
| 8 | `status === "doing"` | 已经在做 |
| — | 其余 | 可领 |

顺序是有意的：先判「批没批」再说「能不能做」，因为 draft 任务的依赖/交付字段本来就不可信；`blocked` 单独说，是因为它和「等别人」不是一回事（等依赖会自己好，被阻塞要人处理）。

## 4. 事件与幂等

- 事件类型 `task.claimable`；`subject` 是地址不是散文：`task/<project>/<task_id>`，项目名与任务号先 `slug()`（非 `[A-Za-z0-9#._:/@-]` 一律换 `-`，空则 `project`）。中文标题放在 `summary`。
- 事件 id：`anchor/<project>/<task_id>/r<账本 revision>`。**同一个 revision 重跑是 no-op**，不会把同一件事派两遍；账本 revision 变了（任务或依赖改了）才会产生新事件。
- 发送记录：`<AGENT_AUTOLOOP_HOME>/bridge/anchor-events.json`，键是事件 id，值是发送时间。失败不写记录，所以失败项下次会重试。
- 密钥：只从环境变量 `AGENT_AUTOLOOP_SOURCE_KEY` 取，不落盘、不写进项目、不进日志。

## 5. 实测（证据：`evidence/raw/deploy/20261104-185000-anchor-bridge.txt`）

| # | 场景 | 结果 |
|---|---|---|
| 1 | 真实账本 dry-run（`--project .`，rev 33，14 条任务） | `可领 0 条`；T4/T6–T14「计划是 draft，没有批准」、T5「依赖未完成：T3」、T3「任务自身被阻塞」、T1/T2「已经结束」——与账本实际状态逐条一致 |
| 2 | 单测 | 8 pass / 0 fail（含「中文项目名也能给出中台收得下的地址」） |
| 3 | 端到端 emit（桩治理程序 + 真实中台 127.0.0.1:3350） | `已发送 1 条事件`；中台「没有规则接的事件」里出现 `task/fixture-project/F1：F1 可领的一条…` |
| 4 | 同一条再跑一次 | `已发送 0 条事件`（幂等成立），发送记录只有 `anchor/fixture-project/F1/r7` |
| 5 | 撤回测试密钥 | `密钥已失效。` |

联调中两次真实失败与根因（都留在日志里，没有绕过）：

1. `401 {"error":"要来源自己的密钥"}` —— `key new` 的第 1 行才是密钥，第 2/3 行是 Node 警告；脚本用 `tail -1` 取到了警告行。改用 `head -1`。
2. `400 {"error":"subject 只能用字母、数字和 # . _ : / @ -"}` —— 最初把中文任务标题放进 `subject`。改为 ASCII 地址 + 中文进 `summary`，并补了单测。

## 6. 与真机 worker 的边界（未接的部分）

桥接只把「可以领」变成事件，**事件进来不等于派单**：中台要有一条规则认领这个 `subject`/`type` 才会启动 Agent。当前 A 机只有 init 生成的「试一下」规则（`cwd=~/.agent-autoloop/try`、`command=codex exec …`），没有任何规则匹配 `task/…`。

因此现在的真机端到端是两段分开验证过的：

- 段一（已通）：治理账本 → 事件 → 中台收下（本文档第 5 节第 3 项）。
- 段二（已通，另一条路径）：中台规则 → worker → codex 两轮问答 → 卡片 → 回答 → 结案（`evidence/deployment/A.md` §4）。

把两段接起来的规则（每个项目固定 cwd、按任务配 model、并发上限）属 T9 的调度设计，不在 T8 里假装跑通。

## 7. 未验证

- B 机上的桥接实跑：B 未接入（T3 阻塞），只在 A 验证了「不硬编码路径」的探测逻辑。
- `legacy_unverified` 分支：本机账本是 schema 4，没有旧账本可用真样本。
- 规则绑定后「事件 → 派单 → 回执 → 账本状态推进」的闭环：需要 T9 的规则与 T10 的部署一起才有意义。
