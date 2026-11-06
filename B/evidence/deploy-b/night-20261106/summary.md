# NIGHT-20261106-B 夜间执行总结（封存版）

- night_id: NIGHT-20261106
- 角色: B（本机 Magicbook14-zz / worker b-magicbook14）
- 封存时间: 2026-11-06T10:12+08:00（夜间窗口 08:00 到期后补封存；08:00–10:06 无真实运行，10:07 恢复服务后由 A 派发 1 次，见第 3.2 节 run 26）
- 模型: deepseek-v4.1-flash-1017（固定未改）
- cwd: D:\AutoAgentloop（固定）
- MCP: 保持，未改 C:\Users\19082\.codex\config.toml
- 结论: 启动阻塞根因已定位并有决定性证据；正式 0.130 通道六项联调中 1/2/3/4/5 通过（第 5 项经 run 26 闭环）、6 未验证（未派发、未重登）。

## 1. 实际修复了什么

### 1.1 启动阻塞根因（已定位，证据充分）
候选 codex.exe 所在树 D:\AutoAgentloop 带 **Low 完整性标签（S-1-16-4096）**，从该树启动的进程一律被降为 Low；而 CODEX_HOME `C:\Users\19082\.codex` 为 Medium（S-1-16-8192）。Low 进程无法在其中创建 `tmp\arg0-windows\*` 与打开 sqlite state runtime，于是 exec 在模型开始前就报：

```
WARNING: failed to clean up stale arg0 temp dirs: 拒绝访问。 (os error 5)
WARNING: proceeding, even though we could not create PATH aliases: 拒绝访问。 (os error 5) at path "C:\Users\19082\.codex\tmp\arg0-windows\codex-arg0XXXX"
Error: failed to initialize in-process app-server client: 拒绝访问。 (os error 5)
```

决定性证据（全部非模型探针，CreateProcessW CREATE_SUSPENDED 后只查 token 再终止）：

| 被测可执行文件 | 测得完整性 |
| --- | --- |
| `C:\Users\19082\.codex-nighttest-20261106\codex-medium.exe`（同字节副本） | Medium 8192 |
| `D:\_iltest_20261106\codex-copy.exe`（D: 根下新目录） | Medium 8192 |
| `D:\AutoAgentloop\_iltest_20261106\codex-copy.exe` | **Low 4096** |
| 钉值路径 `tools\codex\0.166.0-alpha.5.1\package\vendor\x86_64-pc-windows-msvc\bin\codex.exe` | **Low 4096** |

已排除的替代解释：
- 普通别名警告（`mcp list` 在同一上下文 exit 0，5715B 合法 JSON）；
- 遗留 DENY ACE（S-1-21…-2092190072 属旧装机 machine SID，`whoami /groups` 无此 SID）；
- 库内容损坏（5 个 sqlite 库 python 直连全部 OK，journal_mode=wal）；
- 卷/路径本身（`CODEX_HOME=D:\...\codexhome-*` 与 `C:\Users\19082\.codex-nighttest-*` 复制库均 exit 0）。

### 1.2 本夜实际落地的修复
1. **验证用最小修复（已落地）**：把候选字节精确复制到 Medium 标签路径 `C:\Users\19082\.codex-nighttest-20261106\codex-medium.exe`（368970544 B，sha256 与钉值一致），仅作本夜真实运行入口；钉值路径与 tools 树未改动。→ run-02 借此完成真实显式模型 + 真实 node_repl MCP 返回 2。
2. **应用 A 的固定补充包** `night-parse-terminal-boundary-v1.zip`（13090 B sha256 254b44b1…）：`runtime/d504e4876d07/plugins/command/agent.ts` 5691 B / `ac23aa9b…` → 6268 B / `1b8933c0…`；agents.ts、worker.ts 已等于 after，跳过；原文件备份在 `evidence/deploy-b/night-20261106/apply-v1-20261106T0157/backup/`。
3. **worker 维护重启**（授权范围内）：PID 11968 → 33160（01:57:45），日志 `worker.stdout.restart-20261106T0206.log` 见 `worker b-magicbook14 started`。
4. **第 5 项由模型自身执行的停机/重启**（A 派发，非 B 手工）：33160 于 03:05:22.909 被 Stop-Process 成功终止，03:07:23.069 由 `aa-item5-restart.ps1` 拉起 PID 3600。

### 1.3 未落地的修复（留给 A 决策，B 不做）
- **FIX-A**：对钉值 exe 设置 Medium 完整性标签 —— 需 SeSecurityPrivilege，当前上下文 `IsInRole(Administrator)=False`，B 侧不动权限。
- **FIX-B（B 推荐）**：中心 rules.json `command[0]` 指向 Medium 完整性下的字节一致副本（哈希可校验），无需改 ACL。
- **FIX-C**：该树整体去掉 Low 标签 —— 涉及 ACL/标签变更，超出 B 授权。

## 2. 当前版本完整哈希

| 对象 | 字节 | sha256 |
| --- | --- | --- |
| 候选 codex.exe（钉值路径，未改） | 368970544 | `6ca87057d80648f18f8cba0db224ae3e885b25326c07dcc798d38caef22c302c` |
| 验证用 Medium 副本 codex-medium.exe | 368970544 | `6ca87057d80648f18f8cba0db224ae3e885b25326c07dcc798d38caef22c302c` |
| 正式通道 codex.exe（0.130，未切未改） | 245812016 | `dd4adf302b112fdc30fce509a5e261a0a6f1118dc58ac2da636eb84e0a6b3e3e` |
| runtime/d504e4876d07/plugins/command/agent.ts（应用补丁后） | 6268 | `1b8933c0d1f8976b5afe7cc9fbdcd9021549a1057e68ae96f35ed85fd0bcd4f1` |
| runtime/d504e4876d07/worker/agents.ts | 2328 | `6c150fc07d6ec255df6aadc6cc73192d829333dda7b18d276ce8574d0e23b471` |
| runtime/d504e4876d07/worker/worker.ts | 17335 | `9899c23219722532f4d42b13106cde224ec890287d66027910106150dcac6cbb` |
| coordination/isolated-check-v3-review/isolated-one-turn.mjs | — | `fd5019a9b18e8e9880927686b2ad79de5064483de7decd7b500bf6256965a430` |
| C:\Users\19082\.codex\config.toml（未改） | — | `4b76035688a5edf7a1aa9ccf757de2096f2a14c133ac8167edfbeafbe9762393` |
| 启动项 agent-autoloop.cmd（未改） | 430 | `aa2cfb4207edb8e3e67a0268d82fa19dddd0a1397374742052d17b45a40f28a6` |
| D:\AutoAgentloop\b-ping.txt | 21 | `fcd7cde285272fb42b222c931ed3d45ed7d18ad057a58a496f7e8dc413d46658` |
| D:\AutoAgentloop\resume-mark.txt | 54 | `c73b859bba30a6bc06649874b17da3656128349328ca4bcb0888edc40111230e` |

## 3. 调用次数与结果（全部保留原始输出与原生退出码）

### 3.1 候选 0.166 通道（本夜上限 6）

| # | 运行 | 入口 | 原生退出码 | 结果 |
| --- | --- | --- | --- | --- |
| 1 | run-01-20261106T0145 | 钉值 exe（Low） | 11 | 失败：exec 初始化 os error 5，模型未开始 |
| 2 | diag-02-exec-rustlog | 钉值 exe（Low） | 1 | 失败：同上，RUST_LOG 显示 goals/state runtime 打不开 |
| 3 | run-02-20261106T0224 | codex-medium.exe（Medium） | **0** | **通过：真实模型 + 真实 node_repl MCP 返回 2** |
| 4 | run-03-pinned-20261106T0148 | 钉值 exe（Low） | 11 | 失败：与 run-01 完全复现 |

用 4 / 6，通过 1、失败 3，余 2（A 裁定仅留作 FIX-B 切换验证，未得指令未使用）。

run-02 关键证据：protocol.pass=true，final text="2"，session `01a1acc9-bde3-7910-bba0-68b3fdfb4656`，usage input 413111 / cached 148608 / output 154，duration 39860 ms；stdout.jsonl 内 `mcp_tool_call server=node_repl tool=js {code:"1+1"}` 与其结果 `2`。

### 3.2 正式 0.130 通道（A 中心 run，A 侧 cap 12 / used 0）

| run | 项 | test_id | 原生退出码 | 结果 |
| --- | --- | --- | --- | --- |
| 19 | 1 通信闭环 | A-J1-20261106-001 | 0 | 通过 |
| 20 | 2 临时目录 | A-J2-20261106-002 | 0 | 通过 |
| 21 | 3 接续第 1 轮 | A-J3-20261106-003 | 0 | 通过（出问题卡片） |
| 22 | 3 接续第 2 轮 | A-J3-20261106-003 | 0 | 通过（resume 同会话，ROUND2 甲） |
| 23 | 4 运行中取消 | A-J4-20261106-004 | 无 exit 文件（取消） | 通过（21.7 s 后被真实取消） |
| 24 | 唤醒探测 | A-WAKE-20261106-001 | 0 | 通过 |
| 26 | 重启后接活 | A-J5B-20261106-006 | 0 | 通过（worker 9420 启动 2 s 后接到派发并完成整轮） |
| 25 | 5 断线恢复 | A-J5-20261106-005 | 0 | 部分通过（停机+重启执行成功，重启后接活未验证） |

合计真实模型运行 12 次（候选 4 + 正式 8：19/20/21/22/23/24/25/26），机械解析明细见 `final-runs-20261106T1012.json`。

## 4. 六项配合证据

| 项 | 结论 | 关键证据 |
| --- | --- | --- |
| 1 派发/执行/回传 + 严格协议/session/真实 usage | **通过** | run 19：exit 0，18156 B / 25 行，终态拍照在第 21 行，终态后 3 行非 JSON 被正确容忍、终态前 0 行；session `01a1ace2-4837-7952-b034-af2a049766b0` 等于本轮 thread.started；usage 673864/1819/665600 取自本轮 turn.completed；首行逐字「B 接线通过：b-magicbook14」；`b-ping.txt` 21 B sha256 `fcd7cde2…` 单行 `B-PONG b-magicbook14` |
| 2 合成临时目录增删列清 | **通过** | run 20：exit 0，建 `D:\AutoAgentloop\aa-tmp-item2-20261106020807`，写 a.txt(ITEM2-A)/b.txt(ITEM2-B)，列 a.txt、b.txt，删除并确认不存在；B 侧复查 `none_remaining`；过程中一次多行 PowerShell 脚本被审批策略 declined，改单行完成，B 未改任何策略 |
| 3 同会话 回执→卡片→回答→resume | **通过** | run 21 发卡片（key `b-resume-item3`，选项 甲/乙）；run 22 argv 为 `exec resume 01a1ace6-40d4-72c3-8d63-306059611b9e …`，session 与第 1 轮相同，回答 choice=0(甲)，`resume-mark.txt` 追加 `ROUND2 甲`（54 B，sha256 `c73b859b…`），首行「第3项第2轮完成：你选了 甲，接续成功」 |
| 4 运行中取消（非排队重试） | **通过** | run 23：18:14:34.243Z 启动 → 18:14:55.943Z `run 23: stopping (cancel)` → 18:14:56.386Z `run 23: cancelled`，历时 21.7 s；无 exit-1；stdout 仅 101 B（thread.started + turn.started）；b-ping.txt mtime 未变（仍为 02:06）证明模型侧未写入 |
| 5 断线/重启/恢复 | **通过（分两段取证）** | 段一 run 25：脚本 `aa-item5-restart.ps1` 1561 B 布置成功，`aa-item5-restart.log` 记录 STOP succeeded(33160) 03:05:22.909、START succeeded workerPid=3600 03:07:23.069；但该进程未存活（10:04 复查无 node.exe）。段二：B 于 10:07:37 显式维护重启 worker=9420（up.pid=9420，日志 `worker.stdout.post-night-20261106T1020.log` 见 `worker b-magicbook14 started`），10:07:39 即接到 A 派发的 A-J5B-20261106-006，10:09:09 完成整轮 exit 0（session `01a1ae9c-96f3-7bf1-afea-8026e0684aef`，usage 539242/2062/403328）→ 重启后接活已闭环 |
| 6 登录启动项登记与路径核对 | **未验证** | 离线核对：`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\agent-autoloop.cmd` 430 B sha256 `aa2cfb42…`，指向 `C:\Program Files\nodejs\node.exe`(v24.12.0) + `runtime\d504e4876d07\bin\agent-autoloop.ts`，重定向目标 `~/.agent-autoloop/logs/up.log` 不存在；真机重登录未做，故按约定报未验证，不凑 6/6 |

## 5. 未解决事项 / 移交 A

1. **永久修复口径未定**：钉值路径候选仍因 Low 标签无法真实运行（run-03 可复现），需 A 在 FIX-A / FIX-B / FIX-C 中选定；B 已备好 run-02 的 Medium 字节一致副本可立即复测。
2. ~~worker 当前不在运行~~ **已恢复**：03:07 拉起的 PID 3600 未存活；B 于 10:07:37 显式维护重启为 PID 9420（授权范围内、带日志重定向），10:07:39 即接到 A 派发并完成 run 26 → 服务已恢复且接活已验证。
3. ~~第 5 项恢复段未闭环~~ **已闭环**：run 26（A-J5B-20261106-006）在重启后 2 s 内被接活并完成整轮；第 4→第 5 项紧接顺序亦满足（run 23 → run 25）。
4. **第 6 项真机重登未做**：只完成启动项与链路静态核对，未做真实登录/重登复现。
5. **A 侧 main 自 96bc760（seq4）后无新提交**：J2–J5 的判定与补充派发未落到 git，B 的 seq5/seq6 与本封存回执只能单向发布。
6. **第 2 项审批策略噪声**：多行 PowerShell 脚本被 declined（未触发 ask 升级），属中心策略口径，B 未改。
7. **doctor 噪声已解释**：钉值路径 `codex doctor` 的 state 项时好时坏，因 `-shm` 由中完整性进程创建后 Low 进程可只读打开 WAL，不构成本因反驳。

## 6. 清理与留档

- **已清理（10:16）**：`_probe/legacy-rt`（1.5 MB 旧适配器对照树）、`_probe/codexhome-20261106T0136`（3.1 MB）、`_probe/codexhome-copy-20261106T0140`（305 MB 库副本）、`_probe/codex-copy-medium.exe`（352 MB 重复 Medium 副本）——共回收约 662 MB。
- **保留为证据**：`D:\AutoAgentloop\b-ping.txt`（21 B）、`resume-mark.txt`（54 B）、`aa-item5-restart.ps1`（1561 B）、`aa-item5-restart.log`（358 B）、`_probe/*.ts`、`_probe/*.ps1`（探针脚本，小体积）。
- **暂留至 A 决定 FIX-B**：`C:\Users\19082\.codex-nighttest-20261106\`（657 MB，含 codex-medium.exe 与库副本）——FIX-B 切换验证可直接复用；A 若无需要可整目录删除。
- **未改动项**：`C:\Users\19082\.codex\config.toml`、MCP 配置、登录启动项、ACL/完整性标签、身份、其他进程。
- **当前服务状态**：worker PID 9420 在运行（up.pid=9420），日志 `worker.stdout.post-night-20261106T1020.log`；最后一个 run 为 26（exit 0，10:09:09）。
- 原始 stdout/配置/环境/身份材料全部留在本机，仓库只放脱敏证据与哈希。

## 7. 时间线（上海时间）

| 时间 | 事件 |
| --- | --- |
| 01:40 前后 | 协调文件落地；非模型探针开始 |
| 01:45 | run-01 失败（exit 11） |
| 01:55–02:10 | 完整性 token 取证 → 根因定位；配对实验（D:\ 根 Medium / 树内 Low） |
| 02:24 | run-02 通过（真实模型 + 真实 MCP） |
| 01:57 | worker 维护重启 11968 → 33160 |
| 02:04 | 补充包应用 + 离线 14/14 + run18 差分回放 |
| 02:04:32–02:06:08 | run 19 第 1 项通过 |
| 02:06:32–02:08:23 | run 20 第 2 项通过 |
| 02:08:52–02:12:58 | run 21/22 第 3 项两轮通过 |
| 02:14:34–02:14:56 | run 23 第 4 项真实取消通过 |
| 02:58–02:59 | run 24 唤醒探测通过 |
| 03:01–03:07 | run 25 第 5 项停机/重启执行 |
| 03:06–10:06 | 无新 run；worker 不在运行（夜间窗口已止，未擅自拉起） |
| 10:04–10:06 | 过期补封存：机械核对 19–25 号 run 原始产物 |
| 10:07:37 | B 显式维护重启 worker=9420，服务恢复 |
| 10:07:39–10:09:09 | run 26（A-J5B-20261106-006）重启后接活通过 |
| 10:12 | 二次封存：把 run 26 并入 summary/清单/回执，生成最终清单 |
