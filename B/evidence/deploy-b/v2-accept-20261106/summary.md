# STRICT-V2-ACCEPT-20261106 — B 侧阶段总结

- 角色: B（Magicbook14-zz / worker `b-magicbook14`）
- 时间: 2026-11-06T12:08→12:36+08:00（A 侧 hard_stop 12:53；时间按本机 date 校正）
- 分派方: A（唯一中心派发者）；本阶段 B 只做工具准备、应用与日志取证，不自派测试
- 机器可读回执: `B-status.json`（seq1 PREPARED → seq2 APPLIED → seq3 STARTED → seq4 EXEC_DONE → seq5 状态归一与 run27 审计）

## 1. 本阶段实际做了什么

| 步骤 | 动作 | 结果 |
| --- | --- | --- |
| 1 | 把官方 0.166 完整 package **并列**复制到 `C:\Users\19082\AppData\Local\agent-autoloop\tools\codex\0.166.0-alpha.5.1\package\` | 47/47 文件、逐文件 sha256 全等；主程序 368970544B `6ca87057…c302c` |
| 2 | 单次 `CREATE_SUSPENDED` 查初始完整性（未 Resume、未执行） | PID 16864 → **S-1-16-8192 Medium**，随即终止并确认消失 |
| 3 | 单次 `--version` 预检 | exit 0，`codex-cli 0.166.0-alpha.5.1` |
| 4 | 核对 v2 包（main `73781d8`）整包/成员/runtime before | 包 14201B `5ff21499…4e23`；三成员与 PATCH after 全等；before 命中 `v1-applied` 分支 |
| 5 | 等 A 的 seq4=GO（idle 确认） | 12:20 收到；此前不动 worker、不切路由 |
| 6 | 重新采样 worker → 备份 → 只停该 PID → 覆盖 → 核 after | PID 9420（创建 10:07:37，cmdline 与 up.pid 均核对）→ taskkill 仅此 PID → agent.ts `c077041d` 6141B、worker.ts `8416191f` 17436B，agents.ts 已等于 after 跳过 |
| 7 | 写 seq2=APPLIED，保持 worker 停止 | 12:21 |
| 8 | 等 A 的 seq5=ROUTE_READY（12:28）后启动一次 | PID 33640，12:29:15 启动，`up.pid=33640`，单实例，长轮询 198.18.1.108:443 ESTABLISHED，stderr 0 字节 |
| 9 | 只执行 A 派发的两条正式 exec 并取证 | run 29（12:31:55 收尾）、run 30（12:32:33 收尾）均 exit 0、0 条非 JSON，node_repl 真实返回 2 / 4 |

## 2. 实际修复

本阶段 B 侧唯一字节级修复：`runtime/d504e4876d07` 下两文件从 v1 宽松解析升级为**严格 v2**（每行必须是协议 JSON，无终态后白名单）：

| 文件 | before | after |
| --- | --- | --- |
| `plugins/command/agent.ts` | 6268B `1b8933c0d1f8976b5afe7cc9fbdcd9021549a1057e68ae96f35ed85fd0bcd4f1` | 6141B `c077041d0f2ac21b774ba546d203c16a81e2954b44770b27dedc7d5b831c4f74` |
| `worker/worker.ts` | 17335B `9899c23219722532f4d42b13106cde224ec890287d66027910106150dcac6cbb` | 17436B `8416191f470f6320c7ad058af61ea13232b1662b2768a234d4fc9a295baeef82` |
| `worker/agents.ts` | 2328B `6c150fc0…b471` | 未改（已等于 after） |

原始两份文件备份在 `evidence/deploy-b/v2-accept-20261106/apply-v2-20261106T122100/backup`，可回滚。

## 3. 当前版本完整哈希

- 入口（钉值/标准名并列安装）: `C:\Users\19082\AppData\Local\agent-autoloop\tools\codex\0.166.0-alpha.5.1\package\vendor\x86_64-pc-windows-msvc\bin\codex.exe` — 368970544B `6ca87057d80648f18f8cba0db224ae3e885b25326c07dcc798d38caef22c302c`，完整性 Medium
- 原 0.130（未动）: `C:\Users\19082\AppData\Local\OpenAI\Codex\bin\codex.exe` — 245812016B `dd4adf302b112fdc30fce509a5e261a0a6f1118dc58ac2da636eb84e0a6b3e3e`
- runtime: `d504e4876d07501e0a5288242a4575ae60dea685c1191c0598949bd9f9c99ebc`（目录名基准）
- 适配器/worker 三文件: 见上表 after 列
- `codex-medium.exe`（旧 Medium 副本）: 368970544B `6ca87057…c302c`，**本阶段未使用、未提升、未删除**
- 未改: `config.toml` `4b76035688a5edf7a1aa9ccf757de2096f2a14c133ac8167edfbeafbe9762393`、启动项 `agent-autoloop.cmd` `aa2cfb4207edb8e3e67a0268d82fa19dddd0a1397374742052d17b45a40f28a6`

## 4. 调用次数与通过/失败

- A 中心正式 exec: **2/2 已用**（run 29、run 30），attempts 均为 0，**2 通过 / 0 失败**
- B 本阶段自行发起的 exec: **0 次**；模型调用: **0 次**
- B 重启: **1/1**（12:21 停止 + 12:29 启动，同一次维护）
- CLI 探针: 挂起查询 1/1、`--version` 1/1（均已用尽，未重复）
- 原生退出码: run 29 = 0、run 30 = 0（worker `exit-1`）

## 5. 六项联调当前状态（本阶段未新增，沿用夜间封存口径）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 1 派发/执行/回传+严格协议/session/usage | 通过 | 夜间 run 19；本阶段 run 29/30 再次以严格 v2 复验，0 条非 JSON |
| 2 合成临时目录增删列清 | 通过 | 夜间 run 20 |
| 3 回执→卡片→回答→resume | 通过 | 夜间 run 21/22；本阶段 run 29→30 同 session `01a1af1f-…` 再验 |
| 4 运行中取消 | 通过 | 夜间 run 23（在跑 21.7s 取消，无 exit 文件） |
| 5 断线/重启/恢复 | 通过 | 夜间 run 25 + run 26（排队任务在重启后领取） |
| 6 登录启动项/真机重登 | **未验证** | 登记与路径已核对；真机重登未执行，不凑 6/6 |

对**新组合（0.166 + 严格 v2）**，仅第 1、3 项在本阶段重测通过；第 2、4、5 项仍是旧 0.130 上的证据，第 6 项仍未验证。

## 6. 本阶段异常与偏差

1. **并发写入事件**：run 27（A 侧 V2-准备回合）的模型进程在我提交后改写了工作区 `B-status.json`（10140B `966e7634bb5063d716afbb8252086529e892f29704390a4793fb75f3ac02bf44`，内容含 `blocked: true` 与「Remote single-file commit was cancelled」）。该内容**未采用、未发布**，已 checkout 恢复权威回执，原文留本机 `incident-20261106T1217-run27stray/`。
2. **启动早于 ROUTE_READY 约 1 分钟**（12:29:15 启动，A 12:28 已完成 command[0] 切换）→ 启动时路由已是 0.166，未产生旧入口执行；b_restart 仍只算 1 次。
3. 卡片回答为 `choice=1`（乙），与阶段文字示例「选甲」不同；续接语义不受影响，按事实记录。

## 7. 未解决事项（交统筹）

- 第 6 项真机登录触发仍未验证；不声称 6/6。
- 第 2、4、5 项未在 0.166 + v2 组合上重测（本阶段预算仅 2 条 exec，且已用尽）。
- 旧 v1 包已撤销，本机不保留为「可用」；如需回退只能回滚到 v1 之前的 0.130 路由 + `ac23aa9b` 适配器（有备份）。
- `C:\Users\19082\.codex-nighttest-20261106`（657MB，含 `codex-medium.exe` 与库副本）仍在，待统筹决定清理。

## 8. 合规声明

本阶段未改判分逻辑以外的任何规则内容、未过滤非 JSON、未关 MCP、未重装、未改身份/标签/权限/PATH/ACL/登录项、未重启 A 中心、未推送原始日志或环境。发布侧只含脱敏哈希、计数与脚本。

## 9. 状态归一与 run27 执行次数审计（seq5，2026-11-06T13:06+08:00）

准备期字段（`route_not_switched=true`、`waiting_for=等 A 派发两条正式执行`、`plan_on_go`）描述的是 12:11 时点，已被 GO_maintenance(12:19) → APPLIED(12:21) → ROUTE_READY(12:28) → STARTED(12:29) → EXEC_DONE(12:34) 依次取代。本轮把这些字段整体移入 `B-status.json.historical_states`（每项带 `at` 时间与 `superseded_by`），顶层改为 `current_state`：路由已由 A 切换（`route_switched=true`）、v2 已应用、worker PID 33640 单实例存活、正式两轮 2/2 完成、`waiting_for=null`。

**run 27 原生执行次数 = 1**（只读核对，未重跑）：

| 核对项 | 结果 |
| --- | --- |
| 匹配 `27*` 的 run 目录 | 仅 `C:\Users\19082\.agent-autoloop\worker\runs\27-1` |
| command / stdout / stderr / exit 文件数 | 1 / 1 / 1 / 1（`exit-1` = `0`） |
| worker 日志 started 行 | 1 条：`04:08:47.309Z run 27 (V2-准备) turn 1 started, pid 28596`；`04:17:49.391Z run 27: failed`（542 s） |
| 事件计数 | thread.started 1 / turn.started 1 / turn.completed 1 / 218 JSON 行 + 3 条非 JSON |
| 73 条 command_execution 中的嵌套 codex 调用 | 0 |
| 模型 turn 结果 | turn.completed，usage 7951169 / 7772544 / 45430 / reasoning 19284 |
| 失败阶段 | 回执**远端提交**环节（worker 判 failed），非模型 turn 失败 |

`attempts=1` 是中心在提交被取消后排队重试的计数，**没有落到本机执行**（被 A 取消），因此不构成第二次原生执行。3 条非 JSON 是该轮模型自己 `taskkill` 其子进程（PID 32488/31376/4004）的 SUCCESS 行，处于终态之后。

**冲突文件处置复核**：工作树干净，`git status` 无改动；当前 `B-status.json` 的 sha256 与 HEAD 版本一致（`725b34b3…`，seq4 版），两份原始冲突副本都保留——仓库外 `incident-20261106T1217-run27stray/stray-B-status.json`（10140B `966e7634…`）与模型中间稿 `_verify/v2-accept-20261106-B-status.json`（9906B `225c20fd…`）。相关进程 PID 28596/14480/31376/32488/4004 均已消失，worker 33640 存活。

审计产物（本机）：`evidence/deploy-b/v2-accept-20261106/audit-run27-20261106T1306/run27-execution-audit.json` 3424B `57373d8328ec34581f628441133082c8b8da2e383356451ea88e5b5ae3d7e508`。
本轮零模型调用、零新 run、未重启 worker、未改 runtime/配置/路由/身份/权限，未清理旧实验目录。
