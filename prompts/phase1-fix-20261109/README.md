# 第 1 期补单：修跨机冒烟（A → B）

日期：2026-11-09。用户 2026-11-09 12:50 拍板：接受 `dsh-a` 的包装器偏离，并批准本补单。

## 背景（验收结论，Muse 主会话只读复核）

第 1 期四项里三项已过：A 注册完成、A 本机经 hub 冒烟通过（run 72）、B 直连冒烟通过。
未过的是跨机冒烟：A 派的 run 73 两次 exit 1 后被 A 取消。根因在 A 注册的 `dsh-b`
命令本身，三条任一都足以失败：

1. 命令带 `--permission-mode` / `--approval-policy`——0.2.2 才有的参数，
   B 的 DSH 0.2.1-rc.3 直接报 `unknown option`（B 报告发现①已预言）；
2. `--patch` 指向的 overlay 路径在 B 上不存在（两边没对齐路径）；
3. 命令形态无凭据注入，而 B 已实测 headless 不注 `OPENCODE_GO_API_KEY` 必报
   `MISSING_CREDENTIAL`。

## 本补单的固定约定（两边照此执行，不再各行其是）

- **B 侧工件路径（新建，固定）**：
  - 包装器：`C:\Users\19082\.agent-autoloop\phase1-smoke\dsh-headless.ps1`
  - overlay：`C:\Users\19082\.agent-autoloop\phase1-smoke\patch-headless-go.yml`
    （内容与 B 直连冒烟已验证跑通的 `models.patch.yml` 一致）
  - 合成仓库：`C:\Users\19082\.agent-autoloop\phase1-smoke\repo`
    （含 workspace 内的 `_remote.git` 作 origin，仿 A 侧做法）
- **命令形态**：经 B 的包装器调用
  `D:\DPH\resources\runtime\cli\bin\dsh.cmd --profile headless --patch <overlay> --json "<任务>"`；
  凭据只由包装器在子进程环境内注入，**不写进 rules.json、不进任何文件明文**；
  命令里**不许出现** `--permission-mode`、`--approval-policy` 两个参数。
- **工作目录避开 `D:\AutoAgentloop`**（B 发现③：该目录 ACL 拒绝 workspace-write）。
- **顺序**：B 先落地工件并用包装器本体做预检、推报告；A 读到 B 的「可派单」
  报告后再改 rules、再派单；派单后 B 补记跨机结果（含回执是否再现 `fetch failed`）。
- **不做**：不升级 DSH、不改 PATH、不装软件、不改 `~/.dsh` 任何 profile 文件、
  不新写 hub 插件代码、不动 A 的 `dsh-a` 定义、两条临时冒烟规则本补单不删
  （第 1 期收口时再清）。

## 报告路径

- B：handoff 仓新分支 `b/phase1-fix-20261109`，`reports/20261109-phase1-fix-b.md`
  （预检报告；跨机结果以补充段落或同分支第二个文件追加）
- A：status 仓 main，`reports/20261109-phase1-fix-a.md`

## 关期标准

跨机 run 状态 done、exit 0；B 侧合成仓出现分支 `task/p1-smoke-b` 且
`evidence/phase1-smoke/dsh-b.txt` 已推送到 origin；回执上交结果有明确记录
（成功，或 `fetch failed` 原文与时间）。三者齐了，第 1 期才算关期。
