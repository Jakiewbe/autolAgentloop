# 生产模式（PRODUCTION-MODE）

这台机器上的生产模式由三个循环组成，模型只出现在生产闭环里，修复与提案都是纯本地的。

| 循环 | 触发 | 谁在跑 | 有没有模型 | 产物 |
|---|---|---|---|---|
| A 自修复巡检 | 登录后常驻，每 3 小时一次 | `deploy/scripts/self-heal-loop.ps1`（隐藏窗口） | 无 | `evidence/ops/self-heal/` |
| B 进化提案 | 巡检之后立刻跑 | `deploy/scripts/evolve.mjs` | 无 | `evidence/ops/evolution/proposals/` |
| C 生产闭环 | 定时规则 `生产修复定时主控`（每分钟） | `runs/project-pilot-T35/delivery/production-loop/controller.mjs` | 有，且受预算约束 | `~/.agent-autoloop/production-loop/state.json` |

## 三条硬规矩

1. **验收只能由原生校验器给**。`delivery/session-repair-release/checks/native_verify.mjs` 用 DSH 自带校验器判定，退出码就是结论；修复工具自己说 `repaired: true` 不算。
2. **没有批准就没有轮次**。`native.mjs:74 authorize()` 要求账本里那条任务的 `approved_scope.hash` 等于 `contract.approvalHash`、`plan === "approved"`、`!scope_dirty`、`status ∈ {doing,todo}`；不满足就抛 `Production job has no matching current task approval`。
3. **提案不自动生效**。`evolve.mjs` 只写提案；把它变成生产任务要人注册任务、拿到批准哈希、改 `contract.json`。

## A 自修复巡检

- 入口：Startup 里的 `Agent Loop Self-Heal.lnk` → `wscript.exe` → `deploy/scripts/self-heal-launcher.vbs` → 隐藏的 `powershell.exe -File deploy/scripts/self-heal-loop.ps1`。
- 循环：每 10800 秒跑一次 `node deploy/scripts/self-heal.mjs --apply --max 3 --json`，随后跑一次 `node deploy/scripts/evolve.mjs --json`；每次运行追加两行到 `deploy/logs/self-heal.log`，日志超过 2 MB 自动轮转成 `.log.1`。
- 单实例：`Local\agent-autoloop-self-heal` 互斥体，第二个进程直接退出。
- 巡检做什么：健康探测 3350 / 3351 / 4041；扫 `~/.dsh/sessions/*/*/session.v4.jsonl.zstd`；15 分钟内改过的跳过（`fresh`）；独占打开探测判 `held`；先用 `--check-only` 统计 loadable；`--apply` 时修复前把原件复制到 `~/.dsh/session-repair-backup/self-heal/<stamp>/`，落地后再 `--check-only` 复核，失败自动还原。
- 退出码：0 健康 / 1 有未决问题（已写进 problems，交给进化提案）/ 2 巡检本身跑不起来。
- 实测（2026-11-10 20:18）：`checked 94 / loadable 94 / repaired 0 / refused 0 / held 0 / fresh 1 / healthy true`，exit 0，巡检进程 1 个。
- 关掉：删除 Startup 里的 `Agent Loop Self-Heal.lnk`，再结束命令行含 `self-heal-loop.ps1` 的 powershell 进程。

## B 进化提案

```
node deploy/scripts/evolve.mjs --json            # 读巡检报告 + 跑原生门禁
node deploy/scripts/evolve.mjs --json --skip-gate # 只按巡检报告提案
```

- 输入：`evidence/ops/self-heal/latest.json` 的 `problems`，以及 `tools/production_loop/native_gate.mjs` 的失败项。
- 输出：`evidence/ops/evolution/proposals/<stamp>-<issueId>.{json,md}`，`issueId` 形如 `session-log-unrepairable-v1`、`repair-tool-claim-v1`，版本号按同名提案数递增。
- 没有任何问题时不写文件，只打印 `nothing to propose`。
- 提案里写清：证据路径、范围、必须绿的三个门禁、激活四步（注册任务 → 复制 contract → 填 taskId/issueId/approvalHash 且 enabled=false → 批准后才 enabled=true）。

## C 生产闭环

- 契约文件：`runs/project-pilot-T35/delivery/production-loop/contract.json`（`enabled`、`taskId`、`approvalHash`、`issueId`、`maxTurns`、`maxReviews`、`maxMinutes`、`dailyCodexTurns`、`check`、`project`）。
- `check` 是验收命令：`native.mjs:64` 用 `spawnSync` 跑它，要求退出码等于声明值且 stdout 是 JSON。**门禁就是这一条命令**，所以它必须能代表全部验收。
- 当前状态：`(`state.json`)` phase=`published`、turns 2、receipts run 161(A)/170(B)、verification 8 项全 true、installed commit `4ae2351…`；契约绑的是 `T41`（账本 status=done），所以下一轮 cycle 会在 authorize 处被拒——这是设计如此，不是故障。
- 要开新一轮：必须先在账本里有 `status ∈ {doing,todo}`、`plan=approved` 的任务，并把它的 `approved_scope.hash` 写进 `contract.approvalHash`（例如 T42 的 `aa7d14822bbb6272f06a0c5bb53f7a9f878c89a23798f36b4e42fe82cfdc4318`），再把 `issueId` 换成提案里的名字。
- 停：把 `contract.enabled` 置 false，控制器下一步就回到 `approval-required`。

## 门禁（三处都要绿）

```
node tools/production_loop/native_gate.mjs --json     # 4 项：损坏日志必须被拒 / 修复后必须被原生接受 / 好日志修复后仍可加载 / 工具自称不算验收
python tools/production_loop/verify.py                # 63 项：native gates 30 + strict adapters 29 + native validator gates 4
npm run test:windows                                   # worker 侧（B 机）
```

- 2026-11-10 20:12 实测：`native_gate` exit 0（4/4），`verify.py` `passed 63 / failed 0`。
- `native_gate` 的“可修复夹具”是运行时从一份可加载日志重新插回重复的 `step/end`+`step/start` 边界生成的，不把真实会话内容放进仓库；换机器用 `--good/--bad` 或 `NATIVE_GATE_GOOD/NATIVE_GATE_BAD` 指自己的日志。
- 夹具缺失时 `native_gate` 退出 2（不能认证），不是通过。

## 已知缺陷（登记在案，不隐藏）

- **发布版修复工具会误报**：对不可修复的日志，`dsh-session-repair-step.mjs` 输出 `repaired: true`，而原生校验器仍判 `system/message requires a protected first surface head`。`native_gate` 的第 4 项就是钉住这条：验收只认 `native_verify` 的退出码，不认工具自述。
- 本会话非提权，因此 A/B 两个循环都挂在 Startup + 用户级互斥体，不用计划任务。
- 巡检只处理“已关闭且 15 分钟未改动”的会话日志；活会话一律跳过（`held`/`fresh`）。

## 回滚

```
# 1) 关自修复
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Agent Loop Self-Heal.lnk"
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -like '*self-heal-loop.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
# 2) 撤销一次巡检修复（每次修复都留了原件）
#    $d = "$env:USERPROFILE\.dsh\session-repair-backup\self-heal\<stamp>" 里的 <name>.zstd 覆盖回原位
# 3) 关生产闭环
#    把 contract.json 的 enabled 改成 false
```
