# FINAL-ACCEPT-20261106-B 执行总账（summary）

- 夜次：FINAL-ACCEPT-20261106（承接 NIGHT-20261106）
- 角色：B（唯一 B 侧写入者 / worker 维护者）；A 为唯一中心派发者
- A 侧最后读取：main `04c0ef1` = seq5 LOGOFF_NOW（item5 accepted、queue empty、授权一次注销）
- B 侧最后发布：b 分支 `f5cb5f7` = seq8 LOGON_VERIFIED；本文件与清单为最后封存
- 交付主机：Magicbook14-zz（用户会话 chs），工作目录 D:\AutoAgentloop，Windows 11 26200，node v24.12.0
- 结论：**证据完整（EVIDENCE_COMPLETE），不自报 6/6**。六项中 5 项有 A 派发的 test_id 与本地实测证据，item6 有实测但触发登录事件的性质如实标注（见 §6）。

## 1. 本次夜间实际修复/改动（B 侧）

| # | 改动 | 性质 | 证据 |
|---|---|---|---|
| 1 | 生产适配器 `runtime/d504e4876d07/plugins/command/agent.ts` 由 A 授权整包替换（`ac23aa9b…` 5691B → `1b8933c0…` → 现值 `c077041d…` 6141B） | 非 B 手改，按 A 补充包应用 | `v2-accept-20261106/apply-v2-20261106T122100/apply-result.json`、`runtime-after.json` |
| 2 | worker 维护重启（仅 B worker）：旧 33640/30208 → 停 33160/33640 后由 `_probe/start-worker-v2.ps1` 拉起 30208 | 维护性，单实例 | `v2-accept-20261106/worker.stdout.v2-20261106T134021.log`；`up.pid` |
| 3 | 注销一次（用户当场确认，A 授权）→ 登录后启动项自动拉起 worker 28452 | 授权口径内 | `logs-item6-shot-20261106T1445.log`、`logs-item6-logon-events-20261106T1445.log` |
| 4 | 本地只读探针脚本（不改被测系统）：`_probe/{item6-shot.ps1,item6-logon-events.ps1,item6-autologon-read.ps1,final-item6-observe*.ps1,do-logoff.ps1,start-worker-v2.ps1,final-item5-stop.ps1,final-item5-recover.ps1}` | 取证工具 | 本机 `D:\AutoAgentloop\_probe\` |

未做（严格保持）：未重装、未改身份、未提权、未解除任何 Deny、未扩大 ACL、未改 MCP 配置、未放宽判分、未动其他进程；启动项 430B 字节未变。

## 2. 当前版本完整哈希（本机实测，2026-11-06 14:47 前后）

| 对象 | 字节 | sha256 |
|---|---|---|
| 候选 `codex.exe`（0.166.0-alpha.5.1） | 368970544 | `6ca87057d80648f18f8cba0db224ae3e885b25326c07dcc798d38caef22c302c` |
| 生产适配器 `plugins/command/agent.ts` | 6141 | `c077041d0f2ac21b774ba546d203c16a81e2954b44770b27dedc7d5b831c4f74` |
| 运行入口 `bin/agent-autoloop.ts`（薄加载器） | 88 | `614b0eec293d93df9f23e3664cbbb692214aefbdab2344f932ae9adabd90043d` |
| 登录启动项 `Startup\agent-autoloop.cmd` | 430 | `aa2cfb4207edb8e3e67a0268d82fa19dddd0a1397374742052d17b45a40f28a6`（未变） |
| 候选版本串 | — | `codex-cli 0.166.0-alpha.5.1` |
| b 分支交付 HEAD（本文件前） | — | `f5cb5f77c9e18f036f20ff588fc33c016d82b2a7` |

注：契约初始钉值 `agent.ts = ac23aa9b…（5691B）` 已被 A 授权的补充包替换为 `c077041d…（6141B）`，上表为**现值**。

## 3. 调用次数与通过/失败/原生退出码

### 3.1 夜间段 NIGHT-20261106（B 侧）
- 候选 0.166 真实 exec：**4/6**（run-01 exit 11 协议失败 / diag-02 exit 1 / run-02 **exit 0 通过** / run-03 exit 11）
- 正式 0.130 运行：**8 条**（run 19/20/21/22/23/24/25/26）= 7 通过 + 1 设计取消（run 23）
- 该段 B 真实模型运行合计 **12**；原生退出码仅在有 `exit-1` 文件处计：run19/20/21/22/25/26 皆 0；run 23 无 exit 文件（设计取消）

### 3.2 最终验收段 FINAL-ACCEPT-20261106（A 派发、B 本地执行）
| run | test_id | 原生退出 | 结果 |
|---|---|---|---|
| 31 | ITEM2-20261106-1320 | exit-1 = `0` | PASS（7/7 命令 exit 0，目录已删净） |
| 32 | FA-NET-ITEM4-20261106-001 | 无 exit 文件（A 取消） | PASS（取消生效、无晚到产物） |
| 33 | FA-NET-ITEM5-20261106-001 | 无 exit 文件（B 停 worker） | 设计终止；孤儿晚到写 exit 0，**不作通过证据** |
| 34 | ITEM5OFF-20261106-1320 | exit-1 = `0` | PASS（离线排队恰 1 条） |
- 该段 exec 预算 10，用 **4**；通过 2（run31/run34），设计终止 2（run32/run33）
- **本夜合计真实模型运行 16 次**（12 + 4），B 维护重启 1/2，注销 1/1

## 4. 六项配合证据

1. **派发/执行/回传 + 严格协议 + session + 实际 usage** — test_id `A-J1-20261106-001`，run 19，native exit 0，session `01a1ace2-4837-7952-b034-af2a049766b0`，usage 673864/665600/1819，产物 `b-ping.txt` 21B（sha256 `fcd7cde2…`）。**pass**
2. **合成临时目录增删列清** — test_id `ITEM2-20261106-1320`，run 31，session `01a1af4e-3805-7513-84ab-684d0652f8b7`，37 行 stdout、`turn.completed` 在第 37 行、非 JSON 0 条，usage 1705975/3951/1696128，7 条 command_execution 全 exit 0，标记逐字 `FA-ITEM2-OK-ITEM2-20261106-1320`，B 独立复核 `NO_ITEM2_DIR`。**pass**
3. **同会话 回执→卡片→回答→resume** — test_id `A-J3-20261106-003`，run 21→22，轮 2 session 与轮 1 相同（`01a1ace6-40d4-72c3-8d63-306059611b9e`），轮 2 usage 1376520/1364224/3235，回答 `甲`，产物 `resume-mark.txt` 54B（`c73b859b…` 含 ROUND2 甲）。**pass**
4. **运行中取消** — test_id `A-J4-20261106-004`（run 23，18:14:55.943Z→18:14:56.386Z，in-flight 21.7s，无 exit 文件，b-ping.txt mtime 未变 ⇒ 非排队重试）+ 最终验收段 run 32（A 取消 13:29:52，B 2 秒轮询 66 样本：最后存活 13:29:54.116、首次全灭 13:29:56.811，runner/cli/shell/MCP helper 全 gone，无 exit、无 turn.completed）。**pass**
5. **断线/重启/恢复** — test_id `A-J5-20261106-005`：run 25（STOP 33160 @03:05:22.909、START workerPid=3600 @03:07:23.069，该进程未存活）+ 段 2 `A-J5B-20261106-006` run 26（workerPid 9420，10:07:37 起、10:09:09 完成，native exit 0，session `01a1ae9c-96f3-7bf1-afea-8026e0684aef`）；最终验收段补测 run 33（仅停 worker 不级联：13:33:52 存活 6 个孤儿进程，A 已取消）→ 恢复 attempt1 因工具 120s 回收进程树失败 → attempt2 `start-worker-v2.ps1` 驻留成功 → run 34 离线排队恰 1 条执行完成。**pass（含不级联发现）**
6. **登录启动项登记与路径核对** — 启动项 `C:\Users\19082\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\agent-autoloop.cmd` 430B（`aa2cfb42…`，未变）；注销事件 7002 = 13:48:30.179、winlogon 新实例 13:48:30.996（PID 20648）、登录事件 7001 = 13:48:44.509；启动项由 explorer.exe 22368 拉起 cmd.exe 31892，再创建 worker **28452**（13:49:08.058，cmdline 为 `node … agent-autoloop.ts up`），`up.pid`=28452 一致，`up.log` 创建于 13:49:08.055（145B，两次记录：started 与一次 `中转返回 503`），hub 443 Established 至 `13.158.194.126:443`，观察窗内**恒为单实例**，B 未手工启动。**pass，附如实说明**（见 §6）

## 5. 关键证据文件（本包内）

- `B-status.json`（seq1–seq8 递进状态，含逐项哈希）
- `item5-local-recovery.md`（断线恢复前置文档 781B）
- `logs-item6-shot-20261106T1445.log`（登录后进程/父链/up.pid/up.log 快照）
- `logs-item6-logon-events-20261106T1445.log`（7002/7001 事件 + 启动项正文 + 4624 读取被拒）
- `logs-item6-winlogon-read-20261106T1445.log`（Winlogon 键值名与 AutoAdminLogon 读取，只读）
- `logs-item6-observe.jsonl`（登录后首轮 3 样本，内含过滤串缺陷说明）
- `logs-item6-logoff-marker.json`（注销请求时刻/单次计数）

## 6. 未解决事项与如实说明

1. **item6 触发点性质**：注销后仅 14.3 秒即出现新的 7001 登录通知，早于用户回话约 48 分钟，因此该自动启动由**系统/会话层面的重新登录事件**触发，不能断言为用户亲手输入凭据；HKLM Winlogon `AutoAdminLogon` 为空、`DefaultUserName` 未设置（键内存在 `AutoLogonSID`），B 未做任何修改；安全日志 4624 读取被拒，无法用登录类型进一步区分。原因未定论，**不凑 6/6**。
2. **0.166 路由切换**：候选已具备完整证据（run31/run34 正常完成、显式 `-m deepseek-v4.1-flash-1017`、真实 MCP `node_repl` 返回 2 见夜间段 run-02），但正式切换仍由 A 统一控制，B 未自行切换。
3. **exec 路径 `os error 5` 历史根因**：夜间段证明 Medium 完整性下 `mcp list` 正常、exec 卡在 in-process app-server 初始化；后续 v2 适配器更新后 run31/run34 可正常跑通，但**未做单变量证明**该阻塞已消除，仅记录“现态可跑”。
4. **worker 停止不级联**：仅停 worker 不会终止 runner/codex/等待子进程（item5 run 33 实证，6 个孤儿自然跑完并写 exit 0），需产品侧处理；本夜只记录不改。
5. **工具调用 120s 回收子进程树**：以工具调用启动常驻进程会被宿主回收（恢复 attempt1 PID 10784 消失，与夜间 run 25 的 3600 同源），已用 `start-worker-v2.ps1` 规避，机制未改。
6. **队列中三处无 exit 目录**：`runs/23-1`（A-J4 取消）、`runs/32-1`（A 取消 item4）、`runs/9001-1`（空探针目录），均与 A 的取消记录一致，无未完成派发。

## 7. 交接时状态

- worker：**PID 28452**，单实例，由登录启动项拉起，hub 443 Established；`up.log` 145B
- 队列：空闲（21 个 run 目录，无待执行条目）
- b 分支：本包提交即为交付点；原点已同步
- 待办：等 A（统筹）最终审核；如需切换 0.166 路由或复测，请给唯一 test_id 与预算
